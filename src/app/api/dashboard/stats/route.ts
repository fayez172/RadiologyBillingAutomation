import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { error as apiError, success } from '@/lib/api-response';
import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    // 1. Overall AR Summary (from Clients)
    const clients = await prisma.client.findMany({
      select: {
        id: true,
        name: true,
        total_billed: true,
        total_paid: true,
        current_due: true,
      }
    });

    let totalBilled = 0;
    let totalPaid = 0;
    let totalDue = 0;

    clients.forEach(c => {
      totalBilled += Number(c.total_billed);
      totalPaid += Number(c.total_paid);
      totalDue += Number(c.current_due);
    });

    // 2. Top 5 Clients by Revenue (Total Billed)
    const topClients = [...clients]
      .sort((a, b) => Number(b.total_billed) - Number(a.total_billed))
      .slice(0, 5)
      .map(c => ({
        name: c.name,
        billed: Number(c.total_billed)
      }));

    // 3. Last 6 Months Revenue Trend (from Invoices)
    const trend = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      
      const invoicesInMonth = await prisma.invoice.aggregate({
        where: {
          period_end: { gte: start, lte: end },
          status: 'FINALIZED' as any
        },
        _sum: { subtotal: true }
      });
      
      trend.push({
        name: format(date, 'MMM yyyy'),
        revenue: Number(invoicesInMonth._sum?.subtotal || 0)
      });
    }

    // 4. Study Volume (Total all time or recent)
    const studyCount = await prisma.study.count({
      where: { is_duplicate: false }
    });

    return success({
      summary: {
        totalBilled,
        totalPaid,
        totalDue,
        studyCount
      },
      topClients,
      revenueTrend: trend
    });

  } catch (err: any) {
    console.error('[DASHBOARD_STATS_GET]', err);
    return apiError('INTERNAL_ERROR', 'Failed to fetch dashboard stats', 500);
  }
}
