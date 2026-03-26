import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { display_name, modalities, default_hospital_price, default_radiologist_price, is_billable, is_active, sort_order } = body;

    const type = await prisma.billingType.update({
      where: { id: params.id },
      data: {
        display_name,
        modalities,
        default_hospital_price: default_hospital_price !== undefined ? parseFloat(default_hospital_price) : undefined,
        default_radiologist_price: default_radiologist_price !== undefined ? parseFloat(default_radiologist_price) : undefined,
        is_billable,
        is_active,
        sort_order,
      },
    });

    return NextResponse.json(type);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update billing type' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await prisma.billingType.delete({
      where: { id: params.id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete billing type' }, { status: 500 });
  }
}
