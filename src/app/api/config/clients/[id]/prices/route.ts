import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { error as apiError, success } from '@/lib/api-response';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const prices = await prisma.clientPrice.findMany({
      where: { client_id: params.id },
      orderBy: [
        { type: 'asc' },
        { effective_from: 'desc' }
      ]
    });

    return success(prices);
  } catch (err: any) {
    console.error('[CLIENT_PRICES_GET]', err);
    return apiError('INTERNAL_ERROR', 'Failed to fetch client prices', 500);
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const body = await req.json();
    const { type, price, effective_from, effective_to } = body;

    if (!type?.trim()) return apiError('BAD_REQUEST', 'Price type is required', 400);
    if (price === undefined || isNaN(Number(price))) return apiError('BAD_REQUEST', 'Valid price is required', 400);
    if (!effective_from) return apiError('BAD_REQUEST', 'Effective from date is required', 400);

    const newPrice = await prisma.clientPrice.create({
      data: {
        client_id: params.id,
        type: type.trim(),
        price: Number(price),
        effective_from: new Date(effective_from),
        effective_to: effective_to ? new Date(effective_to) : null
      }
    });

    return success(newPrice);
  } catch (err: any) {
    console.error('[CLIENT_PRICES_POST]', err);
    return apiError('INTERNAL_ERROR', 'Failed to create client price', 500);
  }
}
