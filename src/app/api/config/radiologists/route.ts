import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { error as apiError, success } from '@/lib/api-response';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';

    const radiologists = await prisma.radiologist.findMany({
      where: search ? {
        OR: [
          { name: { contains: search } },
          { aliases: { some: { alias_name: { contains: search } } } }
        ]
      } : undefined,
      include: {
        aliases: true,
        _count: {
          select: { aliases: true, prices: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return success(radiologists);
  } catch (err: any) {
    console.error('[RADIOLOGISTS_GET]', err);
    return apiError('INTERNAL_ERROR', 'Failed to fetch radiologists', 500);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const body = await req.json();
    const { name, email, aliases } = body;

    if (!name?.trim()) {
      return apiError('BAD_REQUEST', 'Radiologist name is required', 400);
    }

    // Check if radiologist exists
    const existing = await prisma.radiologist.findUnique({
      where: { name: name.trim() }
    });

    if (existing) {
      return apiError('BAD_REQUEST', 'Radiologist with this name already exists', 400);
    }

    const radiologist = await prisma.radiologist.create({
      data: {
        name: name.trim(),
        email: email?.trim() || null,
        is_active: body.is_active !== undefined ? body.is_active : true,
        aliases: aliases && Array.isArray(aliases) ? {
          create: aliases.map((alias: any) => ({ 
            alias_name: (typeof alias === 'string' ? alias : alias.alias_name).trim(),
            instance_id: alias.instance_id || null,
            remote_id: alias.remote_id ? Number(alias.remote_id) : null
          }))
        } : undefined
      },
      include: {
        aliases: true
      }
    });

    return success(radiologist);
  } catch (err: any) {
    console.error('[RADIOLOGISTS_POST]', err);
    return apiError('INTERNAL_ERROR', 'Failed to create radiologist', 500);
  }
}
