import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { error, success } from '@/lib/api-response';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return error('FORBIDDEN', 'Must be admin', 403);
    }

    const { raw_term, normalized } = await req.json();
    const rule = await prisma.normalizationRule.update({
      where: { id: params.id },
      data: {
        raw_term: raw_term?.trim(),
        normalized: normalized?.trim()
      }
    });

    return success(rule);
  } catch (err: any) {
    if (err.code === 'P2002') return error('CONFLICT', 'A rule for this raw term already exists', 409);
    return error('INTERNAL_ERROR', err.message, 500);
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return error('FORBIDDEN', 'Must be admin', 403);
    }

    await prisma.normalizationRule.delete({ where: { id: params.id } });
    return success({ deleted: true });
  } catch (err: any) {
    return error('INTERNAL_ERROR', err.message, 500);
  }
}
