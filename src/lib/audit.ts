import { prisma } from '@/lib/prisma';

interface AuditParams {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
}

export async function audit({
  userId,
  action,
  entity,
  entityId,
  details,
}: AuditParams) {
  try {
    await prisma.auditLog.create({
      data: {
        user_id: userId || null,
        action,
        entity,
        entity_id: entityId || null,
        details: details ? JSON.stringify(details) : null,
      },
    });
  } catch (e) {
    // Never let audit failures break the main flow
    console.error('[AUDIT] Failed to write audit log:', e);
  }
}
