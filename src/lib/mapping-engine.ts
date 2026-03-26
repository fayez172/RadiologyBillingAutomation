import { prisma } from '@/lib/prisma';


export interface NormalizedInput {
  modality: string | null;
  procedure: string | null;
}

export async function normalize(modality: string | null, procedure: string | null): Promise<NormalizedInput> {
  let mod = modality?.trim().toUpperCase() || null;
  let proc = procedure?.trim().toUpperCase() || null;
  
  if (proc) {
    // Collapse spaces
    proc = proc.replace(/\s+/g, ' ');
    
    // Fetch rules - in production this would be memory-cached
    const rules = await prisma.normalizationRule.findMany();
    
    // Apply rules
    for (const rule of rules) {
      // Simple string replace for now; can be enhanced to word boundaries
      proc = proc.replaceAll(rule.raw_term.toUpperCase(), rule.normalized.toUpperCase());
    }
    
    // Remove punctuation except hyphens
    proc = proc.replace(/[^\w\s-]/g, '');
    proc = proc.trim();
  }
  
  return { modality: mod, procedure: proc };
}

export async function resolveClientAlias(rawName: string | null, instanceId: string): Promise<string | null> {
  if (!rawName) return null;
  const name = rawName.trim();
  
  // 1. Check exact client match first
  const exactClient = await prisma.client.findUnique({ where: { name } });
  if (exactClient) return exactClient.id;
  
  // 2. Check instance-specific alias
  const instanceAlias = await prisma.clientAlias.findUnique({
    where: { alias_name_instance_id: { alias_name: name, instance_id: instanceId } }
  });
  if (instanceAlias) return instanceAlias.client_id;
  
  // 3. Check global alias
  const globalAlias = await prisma.clientAlias.findFirst({
    where: { alias_name: name, instance_id: null }
  });
  if (globalAlias) return globalAlias.client_id;
  
  return null;
}

export async function resolveRadiologistAlias(rawName: string | null, instanceId: string): Promise<string | null> {
  if (!rawName) return null;
  const name = rawName.trim();
  
  // 1. Check exact rad match first
  const exactRad = await prisma.radiologist.findUnique({ where: { name } });
  if (exactRad) return exactRad.id;
  
  // 2. Check instance-specific alias
  const instanceAlias = await prisma.radiologistAlias.findUnique({
    where: { alias_name_instance_id: { alias_name: name, instance_id: instanceId } }
  });
  if (instanceAlias) return instanceAlias.radiologist_id;
  
  // 3. Check global alias
  const globalAlias = await prisma.radiologistAlias.findFirst({
    where: { alias_name: name, instance_id: null }
  });
  if (globalAlias) return globalAlias.radiologist_id;
  
  return null;
}

export async function mapStudy(studyId: string): Promise<boolean> {
  const study = await prisma.study.findUnique({ where: { id: studyId } });
  if (!study || study.is_duplicate) return false;

  // 1. Resolve Aliases
  const clientId = await resolveClientAlias(study.hospital_name, study.instance_id);
  const radiologistId = await resolveRadiologistAlias(study.final_rad_name, study.instance_id);

  // 2. Normalize
  const { modality, procedure } = await normalize(study.modality, study.procedure_raw);
  
  if (!modality || !procedure) {
    await prisma.study.update({
      where: { id: studyId },
      data: {
        type: null,
        type_dr: null,
        mapping_confidence: 'UNMAPPED'
      }
    });
    return false;
  }

  // 3. Exact Match (is_regex = false)
  // Find where modality matches and procedure_pattern equals exact normalized string
  const exactMappings = await prisma.mapping.findMany({
    where: { 
      modality: { equals: modality, mode: 'insensitive' },
      is_active: true,
      is_regex: false
    }
  });

  const exactMatch = exactMappings.find((m: any) => m.procedure_pattern.toUpperCase() === procedure);
  
  if (exactMatch) {
    await prisma.study.update({
      where: { id: studyId },
      data: {
        type: exactMatch.type,
        type_dr: exactMatch.type_dr,
        mapping_confidence: 'EXACT'
      }
    });
    return true;
  }

  // 4. Fuzzy / Regex Match
  const fuzzyMappings = await prisma.mapping.findMany({
    where: {
      modality: { equals: modality, mode: 'insensitive' },
      is_active: true,
      is_regex: true
    },
    orderBy: { priority: 'desc' }
  });

  for (const mapping of fuzzyMappings) {
    try {
      const regex = new RegExp(mapping.procedure_pattern, 'i');
      if (regex.test(procedure)) {
        await prisma.study.update({
          where: { id: studyId },
          data: {
            type: mapping.type,
            type_dr: mapping.type_dr,
            mapping_confidence: 'FUZZY'
          }
        });
        return true;
      }
    } catch (e) {
      console.warn(`[MAPPING] Invalid regex in mapping ${mapping.id}: ${mapping.procedure_pattern}`);
    }
  }

  // 5. No Match -> Manual
  await prisma.study.update({
    where: { id: studyId },
    data: {
      type: null,
      type_dr: null,
      mapping_confidence: 'MANUAL'
    }
  });
  
  return false;
}

export async function mapUnmappedStudies(instanceId?: string) {
  const whereArgs: any = {
    mapping_confidence: { in: ['UNMAPPED', 'MANUAL'] },
    is_duplicate: false
  };
  
  if (instanceId) {
    whereArgs.instance_id = instanceId;
  }

  const studies = await prisma.study.findMany({
    where: whereArgs,
    select: { id: true }
  });

  let mappedCount = 0;
  for (const study of studies) {
    const success = await mapStudy(study.id);
    if (success) mappedCount++;
  }

  return { total_processed: studies.length, mapped: mappedCount };
}
