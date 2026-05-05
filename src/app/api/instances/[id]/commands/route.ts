import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { success, error } from '@/lib/api-response';
import { audit } from '@/lib/audit';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return error('UNAUTHORIZED', 'Admin access required', 403);
    }

    const { id } = params;
    const { command_type, payload } = await req.json();

    if (!command_type) {
      return error('BAD_REQUEST', 'command_type is required', 400);
    }

    // Ensure instance exists
    const instance = await prisma.dbInstance.findUnique({ where: { id } });
    if (!instance) {
      return error('NOT_FOUND', 'Instance not found', 404);
    }

    // Check if there is already an active command of the same type to prevent duplicates
    const activeCommand = await prisma.agentCommand.findFirst({
      where: {
        instance_id: id,
        command_type,
        status: { in: ['PENDING', 'SENT', 'IN_PROGRESS'] }
      }
    });

    if (activeCommand) {
      return error('CONFLICT', `A command of type ${command_type} is already ${activeCommand.status.toLowerCase()}`, 409);
    }

    const command = await prisma.agentCommand.create({
      data: {
        instance_id: id,
        command_type,
        payload: payload || {},
        status: 'PENDING',
      }
    });

    await audit({
      userId: session.user.id,
      action: 'ISSUE_COMMAND',
      entity: 'AgentCommand',
      entityId: command.id,
      details: { command_type, instance_name: instance.name },
    });

    return success(command);
  } catch (e: any) {
    console.error('[API-COMMANDS] Failed to issue command:', e);
    return error('INTERNAL_ERROR', e.message);
  }
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return error('UNAUTHORIZED', 'Access required', 401);
    }

    const { id } = params;
    const commands = await prisma.agentCommand.findMany({
      where: { instance_id: id },
      orderBy: { created_at: 'desc' },
      take: 20
    });

    return success(commands);
  } catch (e: any) {
    return error('INTERNAL_ERROR', e.message);
  }
}
