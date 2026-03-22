import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { error, success } from '@/lib/api-response';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return error('UNAUTHORIZED', 'Unauthorized', 401);

    const rules = await prisma.normalizationRule.findMany({
      orderBy: { raw_term: 'asc' }
    });
    
    return success(rules);
  } catch (err: any) {
    return error('INTERNAL_ERROR', err.message, 500);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return error('FORBIDDEN', 'Must be admin', 403);
    }

    const { raw_term, normalized } = await req.json();

    if (!raw_term || !normalized) {
      return error('BAD_REQUEST', 'Missing fields', 400);
    }

    const rule = await prisma.normalizationRule.create({
      data: {
        raw_term: raw_term.trim(),
        normalized: normalized.trim()
      }
    });

    return success(rule);
  } catch (err: any) {
    if (err.code === 'P2002') {
      return error('CONFLICT', 'A rule for this raw term already exists', 409);
    }
    return error('INTERNAL_ERROR', err.message, 500);
  }
}
