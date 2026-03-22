import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { error as apiError, success } from '@/lib/api-response';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const prices = await prisma.globalPrice.findMany({
      orderBy: [
        { type: 'asc' },
        { effective_from: 'desc' }
      ]
    });

    return success(prices);
  } catch (err: any) {
    console.error('[GLOBAL_PRICES_GET]', err);
    return apiError('INTERNAL_ERROR', 'Failed to fetch global prices', 500);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const body = await req.json();
    const { type, price, effective_from, effective_to } = body;

    if (!type?.trim()) return apiError('BAD_REQUEST', 'Price type is required', 400);
    if (price === undefined || isNaN(Number(price))) return apiError('BAD_REQUEST', 'Valid price is required', 400);
    if (!effective_from) return apiError('BAD_REQUEST', 'Effective from date is required', 400);

    const existing = await prisma.globalPrice.findUnique({
      where: { type: type.trim() }
    });

    if (existing) {
      return apiError('BAD_REQUEST', 'Global price for this type already exists. Update it instead.', 400);
    }

    const newPrice = await prisma.globalPrice.create({
      data: {
        type: type.trim(),
        price: Number(price),
        effective_from: new Date(effective_from),
        effective_to: effective_to ? new Date(effective_to) : null
      }
    });

    return success(newPrice);
  } catch (err: any) {
    console.error('[GLOBAL_PRICES_POST]', err);
    return apiError('INTERNAL_ERROR', 'Failed to create global price', 500);
  }
}
