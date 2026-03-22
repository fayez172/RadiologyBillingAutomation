import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { error as apiError, success } from '@/lib/api-response';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const invoices = await prisma.invoice.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        client: { select: { name: true } },
        _count: { select: { lines: true } }
      }
    });

    return success(invoices);
  } catch (err: any) {
    console.error('[INVOICES_GET]', err);
    return apiError('INTERNAL_ERROR', 'Failed to fetch invoices', 500);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const body = await req.json();
    const { client_id, period_start, period_end, subtotal, previous_due, total_due, lines } = body;

    if (!client_id || !period_start || !period_end || !lines || !Array.isArray(lines)) {
      return apiError('BAD_REQUEST', 'Missing required fields', 400);
    }

    // Generate Invoice Number (e.g., INV-202603-XXXX)
    const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
    const count = await prisma.invoice.count({
      where: { invoice_number: { startsWith: `INV-${yearMonth}` } }
    });
    const invoiceNumber = `INV-${yearMonth}-${String(count + 1).padStart(4, '0')}`;

    // Execute in transaction to save invoice and update client total_billed
    const result = await prisma.$transaction(async (tx: any) => {
      const invoice = await tx.invoice.create({
        data: {
          invoice_number: invoiceNumber,
          client_id,
          period_start: new Date(period_start),
          period_end: new Date(period_end),
          subtotal: Number(subtotal),
          previous_due: Number(previous_due),
          total_due: Number(total_due),
          status: 'FINALIZED' as any,
          finalized_at: new Date(),
          created_by: session.user.id,
          lines: {
            create: lines.map((line: any) => ({
              type: line.type,
              qty: Number(line.qty),
              unit_price: Number(line.unit_price),
              total: Number(line.total)
            }))
          }
        }
      });

      // Update client total_billed and current_due
      const client = await tx.client.findUnique({ where: { id: client_id } });
      if (client) {
        await tx.client.update({
          where: { id: client_id },
          data: {
            total_billed: Number(client.total_billed) + Number(subtotal),
            current_due: Number(client.current_due) + Number(subtotal)
          }
        });
      }

      return invoice;
    });

    return success(result);
  } catch (err: any) {
    console.error('[INVOICES_POST]', err);
    return apiError('INTERNAL_ERROR', 'Failed to create finalized invoice', 500);
  }
}
