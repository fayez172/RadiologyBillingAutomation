import { prisma } from './prisma';

/**
 * Get the effective price for a Client based on study type and report date.
 * Fallback order: ClientPrice -> BillingType (Default) -> GlobalPrice -> 0
 */
export async function getClientPrice(clientId: string, studyType: string, reportDate: Date): Promise<number | null> {
  // 1. Check Client specific price
  const clientPrice = await prisma.clientPrice.findFirst({
    where: {
      client_id: clientId,
      type: studyType,
      effective_from: { lte: reportDate },
      OR: [
        { effective_to: null },
        { effective_to: { gte: reportDate } }
      ]
    },
    orderBy: { effective_from: 'desc' }
  });

  if (clientPrice) return Number(clientPrice.price);

  // 2. Check BillingType Default price
  const billingType = await prisma.billingType.findUnique({
    where: { name: studyType }
  });
  if (billingType && billingType.is_active && billingType.default_hospital_price !== null) {
    return Number(billingType.default_hospital_price);
  }

  // 3. Check Global Fallback price (Legacy)
  const globalPrice = await prisma.globalPrice.findFirst({
    where: {
      type: studyType,
      effective_from: { lte: reportDate },
      OR: [
        { effective_to: null },
        { effective_to: { gte: reportDate } }
      ]
    },
    orderBy: { effective_from: 'desc' }
  });

  if (globalPrice) return Number(globalPrice.price);

  // 4. Not found
  return null;
}

/**
 * Get the effective fee for a Radiologist based on study type and report date.
 * Fallback order: RadiologistPrice -> BillingType (Default) -> null
 */
export async function getRadiologistPrice(radiologistId: string, typeDr: string, reportDate: Date): Promise<number | null> {
  // 1. Check Radiologist specific price
  const radPrice = await prisma.radiologistPrice.findFirst({
    where: {
      radiologist_id: radiologistId,
      type_dr: typeDr,
      effective_from: { lte: reportDate },
      OR: [
        { effective_to: null },
        { effective_to: { gte: reportDate } }
      ]
    },
    orderBy: { effective_from: 'desc' }
  });

  if (radPrice) return Number(radPrice.price);

  // 2. Check BillingType Default price
  const billingType = await prisma.billingType.findUnique({
    where: { name: typeDr }
  });
  if (billingType && billingType.is_active && billingType.default_radiologist_price !== null) {
    return Number(billingType.default_radiologist_price);
  }

  return null;
}
