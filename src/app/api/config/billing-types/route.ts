import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const CACHE_KEY = 'config:billing_types';

export async function GET() {
  try {
    // 1. Try Cache First (Safe-fail)
    try {
      const cached = await redis.get(CACHE_KEY);
      if (cached) {
        return NextResponse.json(JSON.parse(cached));
      }
    } catch (cacheErr) {
      console.warn('[REDIS] GET failed, falling back to database:', cacheErr);
    }

    // 2. Database Fallback
    const types = await prisma.billingType.findMany({
      orderBy: { sort_order: 'asc' },
    });
    
    // Explicitly serialize Decimal to number to avoid JSON issues
    const serializedTypes = types.map((t: any) => ({
      ...t,
      default_hospital_price: Number(t.default_hospital_price),
      default_radiologist_price: Number(t.default_radiologist_price),
    }));

    // 3. Set Cache (Safe-fail)
    try {
      await redis.set(CACHE_KEY, JSON.stringify(serializedTypes), 'EX', 3600);
    } catch (cacheErr) {
      console.warn('[REDIS] SET failed:', cacheErr);
    }

    return NextResponse.json(serializedTypes);
  } catch (error: any) {
    console.error('API Error [BillingTypes GET]:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch billing types', 
      details: error.message
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const type = await prisma.billingType.create({
      data: {
        name: body.name,
        display_name: body.display_name,
        modalities: body.modalities,
        default_hospital_price: Number(body.default_hospital_price || 0),
        default_radiologist_price: Number(body.default_radiologist_price || 0),
        is_billable: body.is_billable ?? true,
        sort_order: body.sort_order ?? 0,
      },
    });

    await redis.del(CACHE_KEY);

    return NextResponse.json(type);
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to create billing type', details: error.message }, { status: 500 });
  }
}
