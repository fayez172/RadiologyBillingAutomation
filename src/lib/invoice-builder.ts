import { prisma } from './prisma';
import { getClientPrice, getRadiologistPrice } from './pricing';

export interface InvoiceLineDraft {
  type: string;
  qty: number;
  unit_price: number | null;
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
 * Expands a study type string into individual billing units.
 * "MRI_Angiogram*2" -> ["MRI_Angiogram", "MRI_Angiogram"]
 * "CT_Angiogram+CT_Scan_Brain" -> ["CT_Angiogram", "CT_Scan_Brain"]
 */
export function expandStudyTypes(typeStr: string): string[] {
  if (!typeStr) return [];
  
  // Split by '+' first
  const parts = typeStr.split('+').map(p => p.trim());
  const finalTypes: string[] = [];
  
  for (const part of parts) {
    if (part.includes('*')) {
      const [type, countStr] = part.split('*');
      const count = parseInt(countStr) || 1;
      for (let i = 0; i < count; i++) {
        finalTypes.push(type.trim());
      }
    } else {
      finalTypes.push(part);
    }
  }
  
  return finalTypes;
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

  // Fetch all active billing types for display name resolution and default pricing
  const billingTypes = await prisma.billingType.findMany({
    where: { is_active: true }
  });
  const typeMap = new Map<string, any>(billingTypes.map((t: any) => [t.name, t]));

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

  // Group by study type, expanding multi-unit types
  const grouped = new Map<string, { qty: number; study_ids: string[] }>();
  
  for (const study of studies) {
    if (!study.type) continue;
    
    const expanded = expandStudyTypes(study.type);
    for (const rawType of expanded) {
      // Use display_name if available, otherwise fallback to the raw type name
      const bType = typeMap.get(rawType);
      const displayName = bType ? bType.display_name : rawType;
      
      if (!grouped.has(displayName)) {
        grouped.set(displayName, { qty: 0, study_ids: [] });
      }
      const group = grouped.get(displayName)!;
      group.qty += 1;
      // Note: We associate the study ID once, but it might contribute multiple units to different display categories
      if (!group.study_ids.includes(study.id)) {
        group.study_ids.push(study.id);
      }
    }
  }

  // Build the invoice lines and calculate pricing
  const lines: InvoiceLineDraft[] = [];
  let subtotal = 0;

  for (const [displayName, data] of Array.from(grouped.entries())) {
    // We need the internal 'name' for price lookup. 
    // If displayName was matched from BillingType, we use that name.
    const bType = billingTypes.find((t: any) => t.display_name === displayName || t.name === displayName);
    const lookupKey = bType ? bType.name : displayName;

    // Determine the price using the billing utility based on the period end date
    const unitPrice = await getClientPrice(clientId, lookupKey, periodEnd);
    const lineTotal = data.qty * (unitPrice || 0);

    lines.push({
      type: displayName,
      qty: data.qty,
      unit_price: unitPrice,
      total: lineTotal,
      study_ids: data.study_ids
    });

    subtotal += lineTotal;
  }

  // Sort lines alphabetically
  lines.sort((a, b) => a.type.localeCompare(b.type));

  // Accounts Receivable
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

export interface RadiologistBillingDraft {
  radiologist_id: string;
  radiologist_name: string;
  period_start: Date;
  period_end: Date;
  lines: InvoiceLineDraft[];
  subtotal: number;
  previous_due: number;
  total_due: number;
}

/**
 * Builds a Billing Draft for a given radiologist and date range.
 */
export async function buildRadiologistBillingDraft(radiologistId: string, periodStart: Date, periodEnd: Date): Promise<RadiologistBillingDraft> {
  const radiologist = await prisma.radiologist.findUnique({
    where: { id: radiologistId },
    include: { aliases: true }
  });

  if (!radiologist) throw new Error('Radiologist not found');

  // Fetch all active billing types for display name resolution
  const billingTypes = await prisma.billingType.findMany({
    where: { is_active: true }
  });
  const typeMap = new Map<string, any>(billingTypes.map((t: any) => [t.name, t]));

  // Collect all acceptable radiologist name strings
  const validNames = [radiologist.name, ...radiologist.aliases.map((a: any) => a.alias_name)];

  // Fetch all non-duplicate mapped studies for these names in the date range
  const studies = await prisma.study.findMany({
    where: {
      final_rad_name: { in: validNames },
      report_dt: {
        gte: periodStart,
        lte: periodEnd
      },
      is_duplicate: false,
      type_dr: { not: null } // Only include studies where a radiologist billing type was assigned
    },
    select: {
      id: true,
      type_dr: true
    }
  });

  // Group by study type (radiologist fee type), expanding multi-unit types
  const grouped = new Map<string, { qty: number; study_ids: string[] }>();
  
  for (const study of studies) {
    if (!study.type_dr) continue;
    
    const expanded = expandStudyTypes(study.type_dr);
    for (const rawType of expanded) {
      const bType = typeMap.get(rawType);
      const displayName = bType ? bType.display_name : rawType;
      
      if (!grouped.has(displayName)) {
        grouped.set(displayName, { qty: 0, study_ids: [] });
      }
      const group = grouped.get(displayName)!;
      group.qty += 1;
      if (!group.study_ids.includes(study.id)) {
        group.study_ids.push(study.id);
      }
    }
  }

  // Build the billing lines and calculate pricing
  const lines: InvoiceLineDraft[] = [];
  let subtotal = 0;

  for (const [displayName, data] of Array.from(grouped.entries())) {
    const bType = billingTypes.find((t: any) => t.display_name === displayName || t.name === displayName);
    const lookupKey = bType ? bType.name : displayName;

    const unitPrice = await getRadiologistPrice(radiologistId, lookupKey, periodEnd);
    const lineTotal = data.qty * (unitPrice || 0);

    lines.push({
      type: displayName,
      qty: data.qty,
      unit_price: unitPrice,
      total: lineTotal,
      study_ids: data.study_ids
    });

    subtotal += lineTotal;
  }

  lines.sort((a, b) => a.type.localeCompare(b.type));

  const previousDue = Number(radiologist.current_due);
  const totalDue = subtotal + previousDue;

  return {
    radiologist_id: radiologist.id,
    radiologist_name: radiologist.name,
    period_start: periodStart,
    period_end: periodEnd,
    lines,
    subtotal,
    previous_due: previousDue,
    total_due: totalDue
  };
}
