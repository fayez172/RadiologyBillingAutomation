import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';
import { testConnection } from '@/lib/mssql';
import { success, error } from '@/lib/api-response';
import { audit } from '@/lib/audit';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAgentStatus } from '@/lib/agent-utils';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== 'ADMIN') {
      return error('UNAUTHORIZED', 'Admin access required', 403);
    }

    const instances = await prisma.dbInstance.findMany({
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        ip: true,
        port: true,
        reporting_db: true,
        radiology_db: true,
        is_active: true,
        last_synced_at: true,
        username: true,
        owner_ids: true,
        auto_sync: true,
        sync_time: true,
        agent_mode: true,
        agent_last_seen_at: true,
        agent_last_error: true,
      },
    });

    const instancesWithHealth = instances.map(inst => ({
      ...inst,
      status: getAgentStatus(inst as any)
    }));

    return success(instancesWithHealth);
  } catch (e: any) {
    return error('FETCH_FAILED', e.message);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return error('UNAUTHORIZED', 'Admin access required', 403);
    }

    const body = await req.json();
    const { name, ip, port, username, password, reporting_db, radiology_db, owner_ids, auto_sync, sync_time } = body;

    if (!name || !ip || !username || !password) {
      return error('VALIDATION_ERROR', 'Missing required fields', 400);
    }

    // 1. Test connection before saving
    const encryptedPassword = encrypt(password);
    const testResult = await testConnection({
      id: 'test',
      ip,
      port: Number(port || 1433),
      username,
      password_encrypted: encryptedPassword,
      reporting_db: reporting_db || 'RADSpaRISReportingDB',
      radiology_db: radiology_db || 'RADSpaRISRadiologyDB',
    });

    if (!testResult.success) {
      return error('CONNECTION_FAILED', testResult.error || 'Connection failed', 400);
    }

    // Normalize owner_ids: "3, 4" -> "[3,4]"
    const normalizedOwnerIds = typeof owner_ids === 'string' 
      ? JSON.stringify(owner_ids.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)))
      : (Array.isArray(owner_ids) ? JSON.stringify(owner_ids) : '[3]');

    // 2. Save if connection successful
    const instance = await prisma.dbInstance.create({
      data: {
        name,
        ip,
        port: Number(port || 1433),
        username,
        password_encrypted: encryptedPassword,
        reporting_db: reporting_db || 'RADSpaRISReportingDB',
        radiology_db: radiology_db || 'RADSpaRISRadiologyDB',
        owner_ids: normalizedOwnerIds,
        auto_sync: Boolean(auto_sync),
        sync_time: sync_time || '02:00',
      },
    });

    await audit({
      userId: session.user.id,
      action: 'CREATE',
      entity: 'DbInstance',
      entityId: instance.id,
      details: { name: instance.name, ip: instance.ip },
    });

    // Strip password from response
    const { password_encrypted, ...safeInstance } = instance;
    return success(safeInstance);

  } catch (e: any) {
    if (e.code === 'P2002') {
      return error('DUPLICATE', 'Instance name already exists', 409);
    }
    return error('CREATE_FAILED', e.message);
  }
}
