import { prisma } from './prisma';
import { getClientPrice } from './pricing';

export interface InvoiceLineDraft {
  type: string;
  qty: number;
  unit_price: number;
  total: number;
  study_ids: string[];
}

export interface InvoiceDraft {
  client_id: string;
  client_name: string;
  period_start: Date;
  period_end: Date;
  lines: InvoiceLineDraft[];
  subtotal: number;
  previous_due: number;
  total_due: number;
}

/**
 * Builds an Invoice Draft for a given client and date range.
 * This does NOT save to the database. It generates the data needed for the preview UI.
 */
export async function buildInvoiceDraft(clientId: string, periodStart: Date, periodEnd: Date): Promise<InvoiceDraft> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { aliases: true }
  });

  if (!client) throw new Error('Client not found');

  // Collect all acceptable hospital_name strings for this client
  const validNames = [client.name, ...client.aliases.map((a: any) => a.alias_name)];

  // Fetch all non-duplicate mapped studies for these names in the date range
  const studies = await prisma.study.findMany({
    where: {
      hospital_name: { in: validNames },
      report_dt: {
        gte: periodStart,
        lte: periodEnd
      },
      is_duplicate: false,
      type: { not: null } // Only include successfully mapped studies
    },
    select: {
      id: true,
      type: true
    }
  });

  // Group by study type
  const grouped = new Map<string, { qty: number; study_ids: string[] }>();
  for (const study of studies) {
    if (!study.type) continue; // safety check
    
    if (!grouped.has(study.type)) {
      grouped.set(study.type, { qty: 0, study_ids: [] });
    }
    const group = grouped.get(study.type)!;
    group.qty += 1;
    group.study_ids.push(study.id);
  }

  // Build the invoice lines and calculate pricing
  const lines: InvoiceLineDraft[] = [];
  let subtotal = 0;

  for (const [type, data] of Array.from(grouped.entries())) {
    // Determine the price using the billing utility based on the period end date
    const unitPrice = await getClientPrice(clientId, type, periodEnd);
    const lineTotal = data.qty * unitPrice;

    lines.push({
      type,
      qty: data.qty,
      unit_price: unitPrice,
      total: lineTotal,
      study_ids: data.study_ids
    });

    subtotal += lineTotal;
  }

  // Sort lines alphabetically by type
  lines.sort((a, b) => a.type.localeCompare(b.type));

  // Accounts Receivable: current_due is what they owe BEFORE this invoice.
  // We use client.current_due as the "previous_due" for the new invoice.
  const previousDue = Number(client.current_due);
  const totalDue = subtotal + previousDue;

  return {
    client_id: client.id,
    client_name: client.name,
    period_start: periodStart,
    period_end: periodEnd,
    lines,
    subtotal,
    previous_due: previousDue,
    total_due: totalDue
  };
}
