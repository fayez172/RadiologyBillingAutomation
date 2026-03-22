import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { error, success } from '@/lib/api-response';
import * as xlsx from 'xlsx';

// Required columns setup per data-import skill
const HEADER_VARIANTS = {
  workflow_id: ['workflow id', 'workflowid', 'workflow_id'],
  mrn: ['mrn', 'patientmrnumber'],
  procedure_raw: ['procedure', 'procedurename'],
  report_comp_time: ['report comp time', 'reportcompletedtime', 'reportcompletedtime_bdt'],
  final_rad_name: ['final rad', 'radiologist', 'finalrad'],
  modality: ['modality'],
  hospital_name: ['hospital', 'hospitalname', 'site'],
  image_count: ['image count', 'imagecount', 'totalimagecount'],
  patient_name: ['patient', 'patientname']
};

function normalizeHeader(header: string): string | null {
  if (!header) return null;
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  for (const [canonical, variants] of Object.entries(HEADER_VARIANTS)) {
    for (const variant of variants) {
      const v = variant.replace(/[^a-z0-9]/g, '');
      // Strict subset or exactly equal for faster "fuzzy" matching
      if (h === v || h.includes(v)) {
        return canonical;
      }
    }
  }
  return null; // unmapped
}

function parseDate(dateStr: string | number): Date | null {
  if (!dateStr) return null;
  
  // Handle Excel numeric dates
  if (typeof dateStr === 'number') {
    return new Date((dateStr - 25569) * 86400 * 1000); // Excel serial to JS date
  }

  // Handle standard Date object parsed by sheetjs
  if ((dateStr as any) instanceof Date) {
    return dateStr as any as Date;
  }

  const str = String(dateStr).trim();
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;
  return null;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return error('UNAUTHORIZED', 'Unauthorized', 401);

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const instanceId = formData.get('instanceId') as string;

    if (!file || !instanceId) {
      return error('BAD_REQUEST', 'Missing required fields: file and instanceId', 400);
    }

    const instance = await prisma.dbInstance.findUnique({ where: { id: instanceId } });
    if (!instance) return error('INVALID_INSTANCE', 'Invalid instanceId', 400);

    const buffer = await file.arrayBuffer();
    
    // Parse the file
    // Note: stream parsing is ideal, but here we read to array for MVP simplicity within vercel limits.
    const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    if (rawData.length < 2) {
      return error('EMPTY_FILE', 'File contains no data rows', 400);
    }

    const headers = rawData[0] as string[];
    const dataRows = rawData.slice(1);

    // Map headers
    const columnMap: Record<number, string> = {};
    headers.forEach((h, idx) => {
      const canonical = normalizeHeader(String(h));
      if (canonical) columnMap[idx] = canonical;
    });

    const mappedColumns = Object.values(columnMap);
    
    // Enforce requirements
    if (!mappedColumns.includes('workflow_id') || !mappedColumns.includes('report_comp_time')) {
      return NextResponse.json({
        error: {
          code: 'MISSING_COLUMN',
          message: "Required columns 'workflow_id' and/or 'report_comp_time' not found",
          details: { detectedHeaders: headers, missingColumns: ['workflow_id', 'report_comp_time'].filter(c => !mappedColumns.includes(c)) }
        }
      }, { status: 400 });
    }

    // Create UploadJob
    const uploadJob = await prisma.uploadJob.create({
      data: {
        instance_id: instanceId,
        filename: file.name,
        status: 'PROCESSING',
        total_rows: dataRows.length
      }
    });

    let newCount = 0;
    let updatedCount = 0;
    let duplicateFlaggedCount = 0;
    let parsedRowsCount = 0;

    const BATCH_SIZE = 500;
    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
      const batch = dataRows.slice(i, i + BATCH_SIZE);
      
      await prisma.$transaction(async (tx: any) => {
        for (const rawRow of batch) {
          const row = rawRow as any[];
          // Skip empty rows
          if (!row || row.length === 0) continue;

          // Build object from the row map
          const mappedData: any = {};
          for (const [idx, colName] of Object.entries(columnMap)) {
            mappedData[colName] = row[Number(idx)];
          }

          if (!mappedData.workflow_id) continue;
          parsedRowsCount++;

          const workflowId = String(mappedData.workflow_id).trim();
          const compositeKey = `${instanceId}:${workflowId}`;
          const reportTime = parseDate(mappedData.report_comp_time);
          
          if (!reportTime) continue; // Skip invalid dates

          const studyData = {
            instance_id: instanceId,
            workflow_id: workflowId,
            composite_key: compositeKey,
            patient_mrn: mappedData.mrn ? String(mappedData.mrn).trim() : null,
            patient_name: mappedData.patient_name ? String(mappedData.patient_name).trim() : null,
            procedure_raw: mappedData.procedure_raw ? String(mappedData.procedure_raw).trim() : null,
            hospital_name: mappedData.hospital_name ? String(mappedData.hospital_name).trim() : null,
            final_rad_name: mappedData.final_rad_name ? String(mappedData.final_rad_name).trim() : null,
            modality: mappedData.modality ? String(mappedData.modality).trim() : null,
            image_count: Number(mappedData.image_count) || null,
            report_dt: reportTime,
            upload_job_id: uploadJob.id,
          };

          const currentStudy = await tx.study.findUnique({ where: { id: compositeKey } });

          if (!currentStudy) {
            // Post-Import Duplicate Check equivalent:
            const potentialDup = await tx.study.findFirst({
              where: {
                patient_name: studyData.patient_name,
                hospital_name: studyData.hospital_name,
                procedure_raw: studyData.procedure_raw,
                modality: studyData.modality,
                id: { not: compositeKey }
              }
            });

            await tx.study.create({
              data: {
                ...studyData,
                id: compositeKey,
                is_duplicate: !!potentialDup,
                duplicate_group_id: potentialDup ? (potentialDup.duplicate_group_id || potentialDup.id) : null,
              }
            });
            newCount++;

            if (potentialDup) {
              duplicateFlaggedCount++;
              if (!potentialDup.duplicate_group_id) {
                await tx.study.update({
                  where: { id: potentialDup.id },
                  data: { is_duplicate: true, duplicate_group_id: potentialDup.id }
                });
              }
            }
          } else {
            await tx.study.update({
              where: { id: compositeKey },
              data: studyData
            });
            updatedCount++;
          }
        }
      });
    }

    // Mark job done
    await prisma.uploadJob.update({
      where: { id: uploadJob.id },
      data: {
        status: 'DONE',
        parsed_rows: parsedRowsCount,
        duplicate_rows: duplicateFlaggedCount
      }
    });

    return success({
      total_rows: dataRows.length,
      parsed_rows: parsedRowsCount,
      new_studies: newCount,
      updated_studies: updatedCount,
      duplicates_flagged: duplicateFlaggedCount
    }, { message: 'File processed successfully' });

  } catch (err: any) {
    console.error('[UPLOAD API]', err);
    return error('INTERNAL_ERROR', err.message || 'Internal server error while processing upload', 500);
  }
}
