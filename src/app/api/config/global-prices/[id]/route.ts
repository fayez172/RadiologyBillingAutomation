import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { error as apiError, success } from '@/lib/api-response';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const body = await req.json();
    const { type, price, effective_from, effective_to } = body;

    const existing = await prisma.globalPrice.findUnique({
      where: { id: params.id }
    });

    if (!existing) return apiError('NOT_FOUND', 'Global price not found', 404);

    if (type && type.trim() !== existing.type) {
      const typeCheck = await prisma.globalPrice.findUnique({ where: { type: type.trim() } });
      if (typeCheck) return apiError('BAD_REQUEST', 'Global price for this type already exists', 400);
    }

    const updated = await prisma.globalPrice.update({
      where: { id: params.id },
      data: {
        type: type ? type.trim() : undefined,
        price: price !== undefined ? Number(price) : undefined,
        effective_from: effective_from ? new Date(effective_from) : undefined,
        effective_to: effective_to ? new Date(effective_to) : (effective_to === null ? null : undefined)
      }
    });

    return success(updated);
  } catch (err: any) {
    console.error('[GLOBAL_PRICES_PUT]', err);
    return apiError('INTERNAL_ERROR', 'Failed to update global price', 500);
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const existing = await prisma.globalPrice.findUnique({
      where: { id: params.id }
    });

    if (!existing) return apiError('NOT_FOUND', 'Global price not found', 404);

    await prisma.globalPrice.delete({
      where: { id: params.id }
    });

    return success({ deleted: true });
  } catch (err: any) {
    console.error('[GLOBAL_PRICES_DELETE]', err);
    return apiError('INTERNAL_ERROR', 'Failed to delete global price', 500);
  }
}
