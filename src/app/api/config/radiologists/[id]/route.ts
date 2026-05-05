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
    const { name, email, is_active, total_billed, total_paid, current_due, reason } = body;

    const existing = await prisma.radiologist.findUnique({
      where: { id: params.id }
    });

    if (!existing) return apiError('NOT_FOUND', 'Radiologist not found', 404);

    if (name && name.trim() !== existing.name) {
      const nameCheck = await prisma.radiologist.findUnique({ where: { name: name.trim() } });
      if (nameCheck) return apiError('BAD_REQUEST', 'Radiologist name already exists', 400);
    }

    // Check if we are doing a balance adjustment
    const isBalanceAdjust = total_billed !== undefined || total_paid !== undefined || current_due !== undefined;
    if (isBalanceAdjust && !reason) {
      return apiError('BAD_REQUEST', 'Reason is required for balance adjustment', 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Sync aliases
      if (body.aliases && Array.isArray(body.aliases)) {
        await tx.radiologistAlias.deleteMany({ where: { radiologist_id: params.id } });
        await tx.radiologistAlias.createMany({
          data: body.aliases.map((a: any) => ({
            radiologist_id: params.id,
            alias_name: (typeof a === 'string' ? a : a.alias_name).trim(),
            instance_id: a.instance_id || null,
            remote_id: a.remote_id ? Number(a.remote_id) : null
          }))
        });
      }

      const radUpdate = await tx.radiologist.update({
        where: { id: params.id },
        data: {
          name: name ? name.trim() : undefined,
          email: email !== undefined ? (email?.trim() || null) : undefined,
          is_active: is_active !== undefined ? is_active : undefined,
          total_billed: total_billed !== undefined ? Number(total_billed) : undefined,
          total_paid: total_paid !== undefined ? Number(total_paid) : undefined,
          current_due: current_due !== undefined ? Number(current_due) : undefined
        }
      });

      if (isBalanceAdjust) {
        await tx.auditLog.create({
          data: {
            user_id: session.user.id,
            action: 'BALANCE_ADJUSTMENT',
            entity: 'RADIOLOGIST',
            entity_id: params.id,
            details: JSON.stringify({
              reason,
              old: { 
                billed: existing.total_billed, 
                paid: existing.total_paid, 
                due: existing.current_due 
              },
              new: { 
                billed: total_billed ?? existing.total_billed, 
                paid: total_paid ?? existing.total_paid, 
                due: current_due ?? existing.current_due 
              }
            })
          }
        });
      }

      return radUpdate;
    });
    
    return success(updated);
  } catch (err: any) {
    console.error('[RADIOLOGISTS_PUT]', err);
    return apiError('INTERNAL_ERROR', 'Failed to update radiologist', 500);
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const radiologist = await prisma.radiologist.findUnique({
      where: { id: params.id }
    });

    if (!radiologist) return apiError('NOT_FOUND', 'Not found', 404);

    // Delete aliases first, then radiologist
    await prisma.$transaction([
      prisma.radiologistAlias.deleteMany({ where: { radiologist_id: params.id } }),
      prisma.radiologistPrice.deleteMany({ where: { radiologist_id: params.id } }),
      prisma.radiologist.delete({ where: { id: params.id } })
    ]);

    return success({ deleted: true });
  } catch (err: any) {
    console.error('[RADIOLOGISTS_DELETE]', err);
    return apiError('INTERNAL_ERROR', 'Failed to delete radiologist', 500);
  }
}
