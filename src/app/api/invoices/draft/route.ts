import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { buildInvoiceDraft } from '@/lib/invoice-builder';
import { error as apiError, success } from '@/lib/api-response';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const body = await req.json();
    const { client_id, period_start, period_end } = body;

    if (!client_id) return apiError('BAD_REQUEST', 'Client ID required', 400);
    if (!period_start || !period_end) return apiError('BAD_REQUEST', 'Period start and end required', 400);

    const start = new Date(period_start);
    start.setHours(0, 0, 0, 0);

    const end = new Date(period_end);
    end.setHours(23, 59, 59, 999);

    if (start > end) return apiError('BAD_REQUEST', 'Start date must be before end date', 400);

    const draft = await buildInvoiceDraft(client_id, start, end);

    return success(draft);
  } catch (err: any) {
    console.error('[INVOICE_DRAFT_POST]', err);
    return apiError('INTERNAL_ERROR', err.message || 'Failed to generate invoice draft', 500);
  }
}
