import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const CACHE_KEY = 'config:billing_types';

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

    // Parse prices safely — reject NaN
    const hospPrice = default_hospital_price !== undefined ? parseFloat(String(default_hospital_price)) : undefined;
    const radPrice = default_radiologist_price !== undefined ? parseFloat(String(default_radiologist_price)) : undefined;

    const type = await prisma.billingType.update({
      where: { id: params.id },
      data: {
        display_name,
        modalities,
        default_hospital_price: hospPrice !== undefined && !isNaN(hospPrice) ? hospPrice : undefined,
        default_radiologist_price: radPrice !== undefined && !isNaN(radPrice) ? radPrice : undefined,
        is_billable,
        is_active,
        sort_order,
      },
    });

    // Invalidate cache so the next GET returns fresh data
    try { await redis.del(CACHE_KEY); } catch (_) {}

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

    // Invalidate cache
    try { await redis.del(CACHE_KEY); } catch (_) {}

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete billing type' }, { status: 500 });
  }
}
