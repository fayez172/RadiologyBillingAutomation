import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { success, error } from '@/lib/api-response';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return error('UNAUTHORIZED', 'Admin access required', 403);
    }

    const tasks = await prisma.agentCommand.findMany({
      include: {
        instance: {
          select: { name: true }
        }
      },
      orderBy: { created_at: 'desc' },
      take: 50
    });

    return success(tasks);
  } catch (e: any) {
    return error('INTERNAL_ERROR', e.message);
  }
}

/**
 * Patch to cancel or retry a task
 */
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return error('UNAUTHORIZED', 'Admin access required', 403);
    }

    const { id, action } = await req.json();

    const task = await prisma.agentCommand.findUnique({ where: { id } });
    if (!task) return error('NOT_FOUND', 'Task not found', 404);

    if (action === 'CANCEL') {
      await prisma.agentCommand.update({
        where: { id },
        data: { status: 'CANCELLED' }
      });
      return success({ message: 'Task marked for cancellation' });
    }

    if (action === 'RETRY') {
      // Create a new task based on the old one
      const newTask = await prisma.agentCommand.create({
        data: {
          instance_id: task.instance_id,
          command_type: task.command_type,
          payload: task.payload || {},
          status: 'PENDING',
          retry_count: task.retry_count + 1
        }
      });
      return success(newTask);
    }

    return error('BAD_REQUEST', 'Invalid action');
  } catch (e: any) {
    return error('INTERNAL_ERROR', e.message);
  }
}
