import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { error as apiError, success } from '@/lib/api-response';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const prices = await prisma.radiologistPrice.findMany({
      where: { radiologist_id: params.id },
      orderBy: [
        { type_dr: 'asc' },
        { effective_from: 'desc' }
      ]
    });

    return success(prices);
  } catch (err: any) {
    console.error('[RAD_PRICES_GET]', err);
    return apiError('INTERNAL_ERROR', 'Failed to fetch radiologist prices', 500);
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const body = await req.json();
    const { type_dr, price, effective_from, effective_to } = body;

    if (!type_dr?.trim()) return apiError('BAD_REQUEST', 'Price type_dr is required', 400);
    if (price === undefined || isNaN(Number(price))) return apiError('BAD_REQUEST', 'Valid price is required', 400);
    if (!effective_from) return apiError('BAD_REQUEST', 'Effective from date is required', 400);

    const newPrice = await prisma.radiologistPrice.create({
      data: {
        radiologist_id: params.id,
        type_dr: type_dr.trim(),
        price: Number(price),
        effective_from: new Date(effective_from),
        effective_to: effective_to ? new Date(effective_to) : null
      }
    });

    return success(newPrice);
  } catch (err: any) {
    console.error('[RAD_PRICES_POST]', err);
    return apiError('INTERNAL_ERROR', 'Failed to create radiologist price', 500);
  }
}
