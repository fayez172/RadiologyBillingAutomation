import { prisma } from '@/lib/prisma';
import { getDbPool } from '@/lib/mssql';

export async function syncReferenceData(instanceId: string) {
  const instance = await prisma.dbInstance.findUnique({ where: { id: instanceId } });
  if (!instance) throw new Error('Instance not found');

  const pool = await getDbPool(instance);
  const radDb = instance.radiology_db;

  try {
    // 1. Sync Modalities
    const mods = await pool.request().query(`
      SELECT ID, DisplayName, Code 
      FROM [${radDb}].dbo.Modality 
      WHERE Active = 1
    `);
    
    // We update reference aliases for modalities directly as normalization rules
    // (In production, you'd map these to the NormalizationRule table)

    // 2. Sync StudySources (Hospitals)
    const sources = await pool.request().query(`
      SELECT ID, Name 
      FROM [${radDb}].dbo.StudySource 
      WHERE Active = 1
    `);
    
    // Auto-create client aliases for new unseen hospitals
    for (const row of sources.recordset) {
      if (!row.Name) continue;
      const rawName = String(row.Name).trim();
      
      // Look up alias
      const existingAlias = await prisma.clientAlias.findFirst({
        where: { alias_name: rawName, instance_id: instanceId }
      });

      if (!existingAlias) {
        // If exact name matches a Client, map it automatically
        let client = await prisma.client.findUnique({ where: { name: rawName } });
        
        if (!client) {
          // Check global alias
          const globalAlias = await prisma.clientAlias.findFirst({ where: { alias_name: rawName, instance_id: null }});
          if (globalAlias) {
            client = await prisma.client.findUnique({ where: { id: globalAlias.client_id }});
          }
        }

        // If a client exists, create the local instance alias
        if (client) {
          await prisma.clientAlias.create({
            data: { client_id: client.id, alias_name: rawName, instance_id: instanceId }
          });
        }
      }
    }

    // 3. Sync Radiologists
    const rads = await pool.request().query(`
      SELECT ID, DisplayName, FirstName, MiddleName, LastName 
      FROM [${radDb}].dbo.Radiologist 
      WHERE Active = 1
    `);
    
    for (const row of rads.recordset) {
      const displayName = row.DisplayName 
        ? row.DisplayName.trim() 
        : [row.FirstName, row.MiddleName, row.LastName].filter(Boolean).join(' ').trim();
      
      if (!displayName) continue;

      const existingAlias = await prisma.radiologistAlias.findFirst({
        where: { alias_name: displayName, instance_id: instanceId }
      });

      if (!existingAlias) {
        let rad = await prisma.radiologist.findUnique({ where: { name: displayName } });
        
        if (!rad) {
          const globalAlias = await prisma.radiologistAlias.findFirst({ where: { alias_name: displayName, instance_id: null }});
          if (globalAlias) {
            rad = await prisma.radiologist.findUnique({ where: { id: globalAlias.radiologist_id }});
          }
        }

        if (rad) {
          await prisma.radiologistAlias.create({
            data: { radiologist_id: rad.id, alias_name: displayName, instance_id: instanceId }
          });
        }
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error(`[SYNC-REF] Error syncing instance ${instance.name}:`, error);
    throw error;
  }
}

export async function checkNewStudiesCount(instanceId: string): Promise<number> {
  const instance = await prisma.dbInstance.findUnique({ where: { id: instanceId } });
  if (!instance) return 0;

  if (!instance.last_synced_at) {
    return -1; // -1 means never synced, needs full sync
  }

  try {
    const pool = await getDbPool(instance);
    
    const result = await pool.request()
      .input('lastSync', instance.last_synced_at)
      .query(`
        SELECT COUNT(*) as new_count
        FROM [${instance.reporting_db}].dbo.FinishedReport
        WHERE ReportCompletedTime > @lastSync
      `);
      
    return result.recordset[0]?.new_count || 0;
  } catch (e) {
    console.warn(`[SYNC-CHECK] Could not check new studies on ${instance.name}`, e);
    return 0;
  }
}

export async function syncStudies(instanceId: string) {
  const instance = await prisma.dbInstance.findUnique({ where: { id: instanceId } });
  if (!instance) throw new Error('Instance not found');

  const pool = await getDbPool(instance);
  
  // Set incremental date frame
  const dateFrom = instance.last_synced_at 
    ? new Date(instance.last_synced_at) 
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago if never synced
  
  const dateTo = new Date(); // now

  const repDb = instance.reporting_db;
  const radDb = instance.radiology_db;

  const query = `
    SELECT
        fr.WorkflowID,
        fr.PatientMRNumber           AS MRN,
        pr.Name                      AS ProcedureName,
        fr.ReportCompletedTime AT TIME ZONE 'UTC'
                           AT TIME ZONE 'Bangladesh Standard Time' AS ReportCompletedTime_BDT,
        ss.Name                      AS HospitalName,
        COALESCE(r.DisplayName, LTRIM(RTRIM(CONCAT(r.FirstName, ' ', r.MiddleName, ' ', r.LastName)))) AS Radiologist,
        m.DisplayName                AS Modality,
        fr.TotalImageCount           AS ImageCount,
        LTRIM(RTRIM(CONCAT(
            fr.PatientPrefix, ' ',
            fr.PatientFirstName, ' ',
            fr.PatientMiddleName, ' ',
            fr.PatientLastName, ' ',
            fr.PatientSuffix
        )))                          AS PatientName
    FROM [${repDb}].dbo.FinishedReport fr
    LEFT JOIN [${radDb}].dbo.[Procedure]     pr ON pr.ID = fr.ForProcedureID
    LEFT JOIN [${radDb}].dbo.Radiologist     r  ON r.ID  = fr.ReportedByUserID
    LEFT JOIN [${radDb}].dbo.Modality        m  ON m.ID  = fr.ForModalityID
    LEFT JOIN [${radDb}].dbo.StudySource     ss ON ss.ID = fr.StudySourceID
    WHERE fr.ReportCompletedTime >= @dateFrom
      AND fr.ReportCompletedTime <= @dateTo
    ORDER BY fr.ReportCompletedTime
  `;

  try {
    const result = await pool.request()
      .input('dateFrom', dateFrom)
      .input('dateTo', dateTo)
      .query(query);

    const studies = result.recordset;
    let newCount = 0;
    let updatedCount = 0;

    // Batch process to avoid massive transaction locks
    const BATCH_SIZE = 500;
    for (let i = 0; i < studies.length; i += BATCH_SIZE) {
      const batch = studies.slice(i, i + BATCH_SIZE);
      
      await prisma.$transaction(async (tx) => {
        for (const row of batch) {
          if (!row.WorkflowID) continue;
          
          const compositeKey = `${instanceId}:${row.WorkflowID}`;
          const currentStudy = await tx.study.findUnique({ where: { id: compositeKey } });
          
          const data = {
            instance_id: instanceId,
            workflow_id: row.WorkflowID.toString(),
            composite_key: compositeKey,
            patient_mrn: row.MRN,
            patient_name: row.PatientName,
            procedure_name: row.ProcedureName,
            hospital_name: row.HospitalName,
            radiologist_name: row.Radiologist,
            modality: row.Modality,
            image_count: row.ImageCount || 0,
            report_completed_at: new Date(row.ReportCompletedTime_BDT),
            source_type: 'MSSQL',
            normalized_hospital: null,
            normalized_radiologist: null,
            normalized_procedure: null,
          };

          if (!currentStudy) {
            // Basic duplicate flag by same exact details
            const potentialDup = await tx.study.findFirst({
              where: {
                patient_name: row.PatientName,
                hospital_name: row.HospitalName,
                procedure_raw: row.ProcedureName,
                modality: row.Modality,
                // exclude self
                id: { not: compositeKey }
              }
            });

            await tx.study.create({
              data: {
                ...data,
                id: compositeKey,
                is_duplicate: !!potentialDup,
                duplicate_group_id: potentialDup ? (potentialDup.duplicate_group_id || potentialDup.id) : null,
              }
            });
            newCount++;

            // Update the potential dup to also point to the group
            if (potentialDup && !potentialDup.duplicate_group_id) {
              await tx.study.update({
                where: { id: potentialDup.id },
                data: { is_duplicate: true, duplicate_group_id: potentialDup.id } 
              });
            }

          } else {
            await tx.study.update({
              where: { id: compositeKey },
              data
            });
            updatedCount++;
          }
        }
      });
    }

    // Update instance last_synced_at
    await prisma.dbInstance.update({
      where: { id: instanceId },
      data: { last_synced_at: dateTo }
    });

    return { 
      success: true, 
      fetched: studies.length,
      new: newCount,
      updated: updatedCount,
      timestamp: dateTo
    };

  } catch (error: any) {
    console.error(`[SYNC-STUDIES] Error on ${instance.name}:`, error);
    throw error;
  }
}
