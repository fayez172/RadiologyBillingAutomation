import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { error as apiError, success } from '@/lib/api-response';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const payments = await prisma.payment.findMany({
      where: { client_id: params.id },
      orderBy: { payment_date: 'desc' },
      take: 100 // Get latest 100 payments for the ledger view
    });

    return success(payments);
  } catch (err: any) {
    console.error('[PAYMENTS_GET]', err);
    return apiError('INTERNAL_ERROR', 'Failed to fetch payments', 500);
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const body = await req.json();
    const { amount, payment_date, reference, note } = body;

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return apiError('BAD_REQUEST', 'Valid positive amount is required', 400);
    }
    if (!payment_date) {
      return apiError('BAD_REQUEST', 'Payment date is required', 400);
    }

    const client = await prisma.client.findUnique({
      where: { id: params.id }
    });

    if (!client) {
      return apiError('NOT_FOUND', 'Client not found', 404);
    }

    // Execute in transaction: 1. Create Payment, 2. Update Client Ledger
    const result = await prisma.$transaction(async (tx) => {
      const paymentAmount = Number(amount);
      const paymentDate = new Date(payment_date);

      // Create payment record
      const payment = await tx.payment.create({
        data: {
          client_id: params.id,
          amount: paymentAmount,
          payment_date: paymentDate,
          reference: reference?.trim() || null,
          note: note?.trim() || null,
          created_by: session.user.id
        }
      });

      // Update Client Ledger
      const newTotalPaid = Number(client.total_paid) + paymentAmount;
      const newCurrentDue = Number(client.total_billed) - newTotalPaid;

      // Ensure last_payment_at logic
      let newLastPaymentAt = client.last_payment_at;
      if (!newLastPaymentAt || paymentDate > newLastPaymentAt) {
        newLastPaymentAt = paymentDate;
      }

      const updatedClient = await tx.client.update({
        where: { id: params.id },
        data: {
          total_paid: newTotalPaid,
          current_due: newCurrentDue,
          last_payment_at: newLastPaymentAt
        }
      });

      return { payment, client: updatedClient };
    });

    return success(result);
  } catch (err: any) {
    console.error('[PAYMENTS_POST]', err);
    return apiError('INTERNAL_ERROR', 'Failed to record payment', 500);
  }
}
