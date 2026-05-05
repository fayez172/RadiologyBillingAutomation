import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { renderToStream } from '@react-pdf/renderer';
import { StudiesReportPDF } from '@/components/reports/StudiesReportPDF';
import React from 'react';
import { format } from 'date-fns';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return new Response('Unauthorized', { status: 401 });

    const body = await req.json();
    const { 
      entityType, 
      entityIds, 
      startDate, 
      endDate 
    } = body;

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
        else if (names.length > 1) namePart = 'Multiple_Radiologists';
      } else {
        const clients = await prisma.client.findMany({
          where: { id: { in: ids } },
          select: { name: true }
        });
        const names = clients.map(c => c.name);
        where.hospital_name = { in: names };
        if (names.length === 1) namePart = names[0];
        else if (names.length > 1) namePart = 'Multiple_Hospitals';
      }
    } else {
      namePart = entityType === 'radiologist' ? 'All_Radiologists' : 'All_Hospitals';
    }

    const studies = await prisma.study.findMany({
      where,
      orderBy: { report_dt: 'asc' },
      take: 2000 // Limit PDF generation for performance
    });

    const stream = await renderToStream(
      StudiesReportPDF({
        studies,
        entityType,
        name: namePart,
        startDate,
        endDate
      }) as any
    );

    const fmtDate = (d: string) => format(new Date(d), 'ddMMyyyy');
    const fileName = `${namePart.replace(/\s+/g, '_')}_(${fmtDate(startDate)}-${fmtDate(endDate)}).pdf`;

    // Convert stream to standard response
    const response = new Response(stream as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    });

    return response;

  } catch (err: any) {
    console.error('[REPORT_PDF]', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
