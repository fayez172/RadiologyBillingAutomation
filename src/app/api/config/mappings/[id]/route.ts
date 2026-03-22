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

    const body = await req.json();
    const mapping = await prisma.mapping.update({
      where: { id: params.id },
      data: {
        modality: body.modality?.trim(),
        procedure_pattern: body.procedure_pattern?.trim(),
        is_regex: body.is_regex !== undefined ? Boolean(body.is_regex) : undefined,
        type: body.type?.trim(),
        type_dr: body.type_dr?.trim(),
        priority: body.priority !== undefined ? parseInt(body.priority) : undefined,
        is_active: body.is_active !== undefined ? Boolean(body.is_active) : undefined
      }
    });

    return success(mapping);
  } catch (err: any) {
    if (err.code === 'P2002') return error('CONFLICT', 'Conflict with existing rule', 409);
    return error('INTERNAL_ERROR', err.message, 500);
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return error('FORBIDDEN', 'Must be admin', 403);
    }

    await prisma.mapping.delete({ where: { id: params.id } });
    return success({ deleted: true });
  } catch (err: any) {
    return error('INTERNAL_ERROR', err.message, 500);
  }
}
