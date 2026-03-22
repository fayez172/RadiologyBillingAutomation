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
    const { name, contact_email, contact_phone, address, is_active } = body;

    const existing = await prisma.client.findUnique({
      where: { id: params.id }
    });

    if (!existing) return apiError('NOT_FOUND', 'Client not found', 404);

    if (name && name.trim() !== existing.name) {
      const nameCheck = await prisma.client.findUnique({ where: { name: name.trim() } });
      if (nameCheck) return apiError('BAD_REQUEST', 'Client name already exists', 400);
    }

    const updated = await prisma.client.update({
      where: { id: params.id },
      data: {
        name: name ? name.trim() : undefined,
        contact_email: contact_email !== undefined ? (contact_email?.trim() || null) : undefined,
        contact_phone: contact_phone !== undefined ? (contact_phone?.trim() || null) : undefined,
        address: address !== undefined ? (address?.trim() || null) : undefined,
        is_active: is_active !== undefined ? is_active : undefined
      }
    });

    return success(updated);
  } catch (err: any) {
    console.error('[CLIENTS_PUT]', err);
    return apiError('INTERNAL_ERROR', 'Failed to update client', 500);
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    // Ensure client can be deleted (no studies mapped to it ideally, but let's just do a soft delete or cascading delete via Prisma if safe. We will just check if we can delete or fallback to soft delete)
    const client = await prisma.client.findUnique({
      where: { id: params.id },
      include: {
        _count: { select: { invoices: true, payments: true } }
      }
    });

    if (!client) return apiError('NOT_FOUND', 'Not found', 404);

    if (client._count.invoices > 0 || client._count.payments > 0) {
      return apiError('BAD_REQUEST', 'Cannot delete client with existing invoices or payments. Please deactivate instead.', 400);
    }

    // Delete aliases first, then client
    await prisma.$transaction([
      prisma.clientAlias.deleteMany({ where: { client_id: params.id } }),
      prisma.clientPrice.deleteMany({ where: { client_id: params.id } }),
      prisma.client.delete({ where: { id: params.id } })
    ]);

    return success({ deleted: true });
  } catch (err: any) {
    console.error('[CLIENTS_DELETE]', err);
    return apiError('INTERNAL_ERROR', 'Failed to delete client', 500);
  }
}
