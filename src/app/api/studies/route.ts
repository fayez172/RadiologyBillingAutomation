import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100');
    const search = searchParams.get('search');
    const hospitalName = searchParams.get('hospital');
    const modality = searchParams.get('modality');
    const status = searchParams.get('status'); // 'mapped' | 'unmapped'

    const where: any = {};

    if (startDate && endDate) {
      where.report_dt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    if (search) {
      where.OR = [
        { patient_name: { contains: search, mode: 'insensitive' } },
        { mrn: { contains: search, mode: 'insensitive' } },
        { hospital_name: { contains: search, mode: 'insensitive' } },
        { procedure_raw: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (hospitalName) where.hospital_name = hospitalName;
    if (modality) where.modality = modality;
    
    if (status === 'mapped') {
      where.type = { not: null };
    } else if (status === 'unmapped') {
      where.type = null;
    }

    const studies = await prisma.study.findMany({
      where,
      orderBy: { report_dt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ data: studies });
  } catch (error) {
    console.error('Failed to fetch studies:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
