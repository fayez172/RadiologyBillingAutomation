import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';
import { testConnection } from '@/lib/mssql';
import { success, error } from '@/lib/api-response';
import { audit } from '@/lib/audit';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return error('UNAUTHORIZED', 'Admin access required', 403);
    }

    const { id } = params;
    const body = await req.json();
    const { name, ip, port, username, password, reporting_db, radiology_db, owner_ids, auto_sync, sync_time, is_active } = body;

    const existing = await prisma.dbInstance.findUnique({ where: { id } });
    if (!existing) return error('NOT_FOUND', 'Instance not found', 404);

    let password_encrypted = existing.password_encrypted;
    
    // If password provided, encrypt and test new connection
    if (password) {
      password_encrypted = encrypt(password);
    }

    const testConfig = {
      id,
      ip: ip || existing.ip,
      port: Number(port || existing.port),
      username: username || existing.username,
      password_encrypted,
      reporting_db: reporting_db || existing.reporting_db,
      radiology_db: radiology_db || existing.radiology_db,
    };

    const testResult = await testConnection(testConfig);
    if (!testResult.success) {
      return error('CONNECTION_FAILED', testResult.error || 'Connection test failed with new settings', 400);
    }

    // Normalize owner_ids: "3, 4" -> "[3,4]"
    const normalizedOwnerIds = typeof owner_ids === 'string'
      ? JSON.stringify(owner_ids.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)))
      : (Array.isArray(owner_ids) ? JSON.stringify(owner_ids) : undefined);

    const instance = await prisma.dbInstance.update({
      where: { id },
      data: {
        name,
        ip,
        port: port ? Number(port) : undefined,
        username,
        password_encrypted,
        reporting_db,
        radiology_db,
        owner_ids: normalizedOwnerIds || existing.owner_ids,
        auto_sync: auto_sync !== undefined ? Boolean(auto_sync) : existing.auto_sync,
        sync_time: sync_time || existing.sync_time,
        is_active,
      },
    });

    await audit({
      userId: session.user.id,
      action: 'UPDATE',
      entity: 'DbInstance',
      entityId: instance.id,
      details: { name: instance.name, is_active: instance.is_active },
    });

    const { password_encrypted: _, ...safeInstance } = instance;
    return success(safeInstance);

  } catch (e: any) {
    return error('UPDATE_FAILED', e.message);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return error('UNAUTHORIZED', 'Admin access required', 403);
    }

    const { id } = params;

    const instance = await prisma.dbInstance.update({
      where: { id },
      data: { is_active: false }, // Soft delete
    });

    await audit({
      userId: session.user.id,
      action: 'SOFT_DELETE',
      entity: 'DbInstance',
      entityId: id,
    });

    return success({ success: true, id });
  } catch (e: any) {
    return error('DELETE_FAILED', e.message);
  }
}
