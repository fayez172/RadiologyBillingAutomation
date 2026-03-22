import { prisma } from './prisma';

/**
 * Get the effective price for a Client based on study type and report date.
 * Fallback order: ClientPrice -> GlobalPrice -> 0
 */
export async function getClientPrice(clientId: string, studyType: string, reportDate: Date): Promise<number> {
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

  // 2. Check Global Fallback price
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

  // 3. Not found
  return 0;
}

/**
 * Get the effective fee for a Radiologist based on study type and report date.
 * Fallback order: RadiologistPrice -> 0 (No global fallback for radiologists currently defined, could be added later if needed)
 */
export async function getRadiologistPrice(radiologistId: string, typeDr: string, reportDate: Date): Promise<number> {
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

  return 0;
}
