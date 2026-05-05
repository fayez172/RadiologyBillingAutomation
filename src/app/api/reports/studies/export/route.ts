import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return new Response('Unauthorized', { status: 401 });

    const body = await req.json();
    const { 
      entityType, // 'radiologist' | 'hospital'
      entityIds,  // Array of IDs or 'all'
      startDate, 
      endDate, 
      format: exportFormat // 'xlsx' | 'pdf' (pdf handled elsewhere or here)
    } = body;

    if (!entityType || !startDate || !endDate) {
      return new Response('Missing required parameters', { status: 400 });
    }

    const where: any = {
      report_dt: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      },
      mapping_confidence: { not: 'UNMAPPED' }
    };

    let namePart = 'Bulk_Report';

    if (entityIds && entityIds !== 'all') {
      const ids = Array.isArray(entityIds) ? entityIds : [entityIds];
      if (entityType === 'radiologist') {
        const rads = await prisma.radiologist.findMany({
          where: { id: { in: ids } },
          select: { name: true }
        });
        const names = rads.map(r => r.name);
        where.final_rad_name = { in: names };
        if (names.length === 1) namePart = names[0];
        else namePart = 'Multiple_Radiologists';
      } else {
        const clients = await prisma.client.findMany({
          where: { id: { in: ids } },
          select: { name: true }
        });
        const names = clients.map(c => c.name);
        where.hospital_name = { in: names };
        if (names.length === 1) namePart = names[0];
        else namePart = 'Multiple_Hospitals';
      }
    } else {
      namePart = entityType === 'radiologist' ? 'All_Radiologists' : 'All_Hospitals';
    }

    const studies = await prisma.study.findMany({
      where,
      orderBy: { report_dt: 'asc' },
      take: 50000 
    });

    if (exportFormat === 'xlsx') {
      const data = studies.map(s => {
        const row: any = {
          'Date (BDT)': s.report_dt ? format(new Date(s.report_dt), 'dd-MMM-yyyy HH:mm') : 'N/A',
          'MRN': s.mrn || 'N/A',
          'Patient Name': s.patient_name || 'Unknown',
          'Modality': s.modality,
          'Procedure Name': s.procedure_raw,
        };

        if (entityType === 'radiologist') {
          // Radiologist Report: MRN, Patient Name, Hospital, Modality, Procedure Name, Date. NO TYPE.
          row['Hospital'] = s.hospital_name;
        } else {
          // Hospital Report: MRN, Patient Name, Modality, Procedure Name, Type (Billing Type), Date. NO RADIOLOGIST.
          row['Billing Type'] = s.type;
        }

        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Studies');

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      // Filename: radiologistName_(startDate - EndDate)  (DDMMYYYY)
      const fmtDate = (d: string) => format(new Date(d), 'ddMMyyyy');
      const fileName = `${namePart.replace(/\s+/g, '_')}_(${fmtDate(startDate)}-${fmtDate(endDate)}).xlsx`;

      return new Response(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileName}"`
        }
      });
    }

    return NextResponse.json({ success: true, count: studies.length });

  } catch (err: any) {
    console.error('[REPORT_EXPORT]', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
