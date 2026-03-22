import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { success, error as apiError } from '@/lib/api-response';
import * as XLSX from 'xlsx';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) return apiError('BAD_REQUEST', 'No file provided', 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) return apiError('BAD_REQUEST', 'Excel file is empty', 400);

    // Auto-detect columns (case-insensitive, flexible naming)
    const headers = Object.keys(rows[0]);
    const findCol = (candidates: string[]) => {
      for (const c of candidates) {
        const found = headers.find(h => h.toLowerCase().trim() === c.toLowerCase());
        if (found) return found;
      }
      return null;
    };

    const modalityCol = findCol(['modality', 'mod']);
    const procedureCol = findCol(['procedure', 'procedure_pattern', 'procedure pattern', 'proc']);
    const typeCol = findCol(['type', 'billing type', 'type_client', 'client type']);
    const typeDRCol = findCol(['typedr', 'type_dr', 'type dr', 'rad type', 'radiologist type']);

    if (!modalityCol || !procedureCol || !typeCol || !typeDRCol) {
      return apiError('BAD_REQUEST', `Missing required columns. Expected: Modality, Procedure, Type, TypeDR. Found: ${headers.join(', ')}`, 400);
    }

    let created = 0;
    let skipped = 0;
    let errors: string[] = [];

    for (const row of rows) {
      const modality = String(row[modalityCol]).trim().toUpperCase();
      const procedure_pattern = String(row[procedureCol]).trim();
      const type = String(row[typeCol]).trim();
      const type_dr = String(row[typeDRCol]).trim();

      if (!modality || !procedure_pattern || !type || !type_dr) {
        skipped++;
        continue;
      }

      try {
        await prisma.mapping.upsert({
          where: {
            modality_procedure_pattern: { modality, procedure_pattern }
          },
          update: { type, type_dr },
          create: {
            modality,
            procedure_pattern,
            type,
            type_dr,
            is_regex: false,
            priority: 0,
            is_active: true,
          }
        });
        created++;
      } catch (err: any) {
        errors.push(`Row "${modality}|${procedure_pattern}": ${err.message?.substring(0, 80)}`);
      }
    }

    return success({
      total: rows.length,
      imported: created,
      skipped,
      errors: errors.slice(0, 10),
    });

  } catch (err: any) {
    console.error('[MAPPINGS_IMPORT_POST]', err);
    return apiError('INTERNAL_ERROR', 'Failed to import mappings', 500);
  }
}
