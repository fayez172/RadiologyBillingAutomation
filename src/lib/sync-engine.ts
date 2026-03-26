import { prisma } from '@/lib/prisma';
import { getDbPool } from '@/lib/mssql';
import { mapUnmappedStudies } from '@/lib/mapping-engine';

export async function syncReferenceData(instanceId: string) {
  const instance = await prisma.dbInstance.findUnique({ where: { id: instanceId } });
  if (!instance) throw new Error('Instance not found');

  const pool = await getDbPool(instance);
  const radDb = instance.radiology_db;
  
  // Parse owner IDs safely, fallback to [3] if invalid or empty
  let ownerIds = [3];
  try {
    const parsed = JSON.parse(instance.owner_ids);
    if (Array.isArray(parsed) && parsed.length > 0) {
      ownerIds = parsed;
    }
  } catch (e) {
    console.warn(`[SYNC-REF] Invalid owner_ids format for instance ${instance.name}. Defaulting to [3].`);
  }
  const ownerIdsStr = ownerIds.join(',');

  try {
    // 1. Sync Modalities
    const mods = await pool.request().query(`
      SELECT ID, Code, DisplayName, AlternateNames, OwnerID, Active 
      FROM [${radDb}].dbo.Modality 
      WHERE OwnerID IN (${ownerIdsStr})
    `);
    
    for (const row of mods.recordset) {
      await prisma.remoteModality.upsert({
        where: {
          remote_id_instance_id: { remote_id: Number(row.ID), instance_id: instanceId }
        },
        update: {
          code: row.Code, display_name: row.DisplayName, alt_names: row.AlternateNames, 
          owner_id: Number(row.OwnerID), is_active: row.Active
        },
        create: {
          remote_id: Number(row.ID), instance_id: instanceId,
          code: row.Code, display_name: row.DisplayName, alt_names: row.AlternateNames, 
          owner_id: Number(row.OwnerID), is_active: row.Active
        }
      });
    }

    // 2. Sync Procedures
    const procs = await pool.request().query(`
      SELECT ID, Name, ProcedureCode, ParentModalityID, OwnerID, Active
      FROM [${radDb}].dbo.[Procedure]
      WHERE OwnerID IN (${ownerIdsStr})
    `);

    for (const row of procs.recordset) {
      const parentMod = row.ParentModalityID ? await prisma.remoteModality.findUnique({
        where: { remote_id_instance_id: { remote_id: Number(row.ParentModalityID), instance_id: instanceId } }
      }) : null;

      await prisma.remoteProcedure.upsert({
        where: {
          remote_id_instance_id: { remote_id: Number(row.ID), instance_id: instanceId }
        },
        update: {
          name: row.Name, procedure_code: row.ProcedureCode, 
          parent_modality_id: parentMod?.id, owner_id: Number(row.OwnerID), is_active: row.Active
        },
        create: {
          remote_id: Number(row.ID), instance_id: instanceId,
          name: row.Name, procedure_code: row.ProcedureCode, 
          parent_modality_id: parentMod?.id, owner_id: Number(row.OwnerID), is_active: row.Active
        }
      });
    }

    // 3. Sync Study Sources & Auto-merge to Client
    const studySources = await pool.request().query(`
      SELECT ID, Name, OwnerID, Active 
      FROM [${radDb}].dbo.StudySource 
      WHERE OwnerID IN (${ownerIdsStr})
    `);
    
    for (const row of studySources.recordset) {
      const rawName = row.Name?.trim();
      if (!rawName) continue;

      let clientAlias = await prisma.clientAlias.findUnique({
        where: { alias_name_instance_id: { alias_name: rawName, instance_id: instanceId } }
      });

      let clientId = clientAlias?.client_id;

      if (!clientAlias) {
        let client = await prisma.client.findUnique({ where: { name: rawName } });
        if (!client) {
          client = await prisma.client.create({ data: { name: rawName, is_active: true } });
          console.log(`[SYNC-REF] Created new Client: ${rawName}`);
        }
        clientId = client.id;
        clientAlias = await prisma.clientAlias.create({
          data: { client_id: clientId, alias_name: rawName, instance_id: instanceId, remote_id: Number(row.ID) }
        });
      } else if (!clientAlias.remote_id) {
        await prisma.clientAlias.update({
          where: { id: clientAlias.id },
          data: { remote_id: Number(row.ID) }
        });
      }

      await prisma.remoteStudySource.upsert({
        where: { remote_id_instance_id: { remote_id: Number(row.ID), instance_id: instanceId } },
        update: { name: rawName, owner_id: Number(row.OwnerID), is_active: row.Active, client_id: clientId },
        create: {
          remote_id: Number(row.ID), instance_id: instanceId,
          name: rawName, owner_id: Number(row.OwnerID), is_active: row.Active, client_id: clientId
        }
      });
    }

    // 4. Sync Radiologists & Auto-merge
    const rads = await pool.request().query(`
      SELECT ID, DisplayName, FirstName, MiddleName, LastName, OwnerID, Active
      FROM [${radDb}].dbo.Radiologist 
      WHERE OwnerID IN (${ownerIdsStr})
    `);
    
    for (const row of rads.recordset) {
      const displayName = row.DisplayName 
        ? row.DisplayName.trim() 
        : [row.FirstName, row.MiddleName, row.LastName].filter(Boolean).join(' ').trim();
      
      if (!displayName) continue;

      let radAlias = await prisma.radiologistAlias.findUnique({
        where: { alias_name_instance_id: { alias_name: displayName, instance_id: instanceId } }
      });

      if (!radAlias) {
        let rad = await prisma.radiologist.findUnique({ where: { name: displayName } });
        if (!rad) {
          rad = await prisma.radiologist.create({ data: { name: displayName, is_active: true } });
          console.log(`[SYNC-REF] Created new Radiologist: ${displayName}`);
        }
        radAlias = await prisma.radiologistAlias.create({
          data: { radiologist_id: rad.id, alias_name: displayName, instance_id: instanceId, remote_id: Number(row.ID) }
        });
      } else if (!radAlias.remote_id) {
        await prisma.radiologistAlias.update({
          where: { id: radAlias.id },
          data: { remote_id: Number(row.ID) }
        });
      }

      await prisma.remoteRadiologist.upsert({
        where: { remote_id_instance_id: { remote_id: Number(row.ID), instance_id: instanceId } },
        update: { 
          display_name: displayName, 
          first_name: row.FirstName, middle_name: row.MiddleName, last_name: row.LastName,
          owner_id: Number(row.OwnerID), is_active: row.Active, radiologist_id: radAlias.radiologist_id 
        },
        create: {
          remote_id: Number(row.ID), instance_id: instanceId,
          display_name: displayName, 
          first_name: row.FirstName, middle_name: row.MiddleName, last_name: row.LastName,
          owner_id: Number(row.OwnerID), is_active: row.Active, radiologist_id: radAlias.radiologist_id
        }
      });
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

export async function syncStudies(instanceId: string, customDateFrom?: Date, customDateTo?: Date) {
  const instance = await prisma.dbInstance.findUnique({ where: { id: instanceId } });
  if (!instance) throw new Error('Instance not found');

  const pool = await getDbPool(instance);
  
  // Set incremental date frame or use custom range
  const dateFrom = customDateFrom || (instance.last_synced_at 
    ? new Date(instance.last_synced_at) 
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); // 30 days ago if never synced
  
  const dateTo = customDateTo || new Date(); // now

  const repDb = instance.reporting_db;
  const radDb = instance.radiology_db;

  const query = `
    SELECT
        fr.WorkflowID,
        fr.PatientMRNumber           AS MRN,
        pr.Name                      AS ProcedureName,
        pr.ID                        AS ForProcedureID,
        fr.ForModalityID,
        fr.StudySourceID,
        fr.ReportedByUserID,
        fr.Add1Read1RadiologistID,
        fr.Add2Read1RadiologistID,
        fr.Add3Read1RadiologistID,
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

    const BATCH_SIZE = 100;
    for (let i = 0; i < studies.length; i += BATCH_SIZE) {
      const batch = studies.slice(i, i + BATCH_SIZE);
      
      await prisma.$transaction(async (tx: any) => {
        for (const row of batch) {
          if (!row.WorkflowID) continue;
          
          const compositeKey = `${instanceId}:${row.WorkflowID}`;
          const currentStudy = await tx.study.findUnique({ where: { id: compositeKey } });
          
          // Addendum Logic: Add3 > Add2 > Add1 > ReportedBy
          const finalRadRemoteId = Number(row.Add3Read1RadiologistID 
            ?? row.Add2Read1RadiologistID 
            ?? row.Add1Read1RadiologistID 
            ?? row.ReportedByUserID);

          const reportedByRemoteId = Number(row.ReportedByUserID);

          // Resolve final radiologist name
          let finalRadName = row.Radiologist || "Unknown";
          if (finalRadRemoteId && finalRadRemoteId !== reportedByRemoteId) {
            const radAlias = await tx.radiologistAlias.findFirst({
              where: { remote_id: finalRadRemoteId, instance_id: instanceId }
            });
            if (radAlias) {
              finalRadName = radAlias.alias_name;
            } else {
              // Fallback if not synced
              finalRadName = `Unknown Rad (ID: ${finalRadRemoteId})`;
            }
          }

          const data = {
            instance_id: instanceId,
            workflow_id: row.WorkflowID.toString(),
            composite_key: compositeKey,
            mrn: row.MRN,
            patient_name: row.PatientName,
            procedure_raw: row.ProcedureName,
            hospital_name: row.HospitalName,
            final_rad_name: finalRadName,
            modality: row.Modality,
            image_count: row.ImageCount || 0,
            report_dt: new Date(row.ReportCompletedTime_BDT + " +06:00"),

            // Remote IDs for tracking (Number(..) casting for Prisma Int compatibility)
            reported_by_remote_id: reportedByRemoteId,
            add1_rad_remote_id: row.Add1Read1RadiologistID ? Number(row.Add1Read1RadiologistID) : null,
            add2_rad_remote_id: row.Add2Read1RadiologistID ? Number(row.Add2Read1RadiologistID) : null,
            add3_rad_remote_id: row.Add3Read1RadiologistID ? Number(row.Add3Read1RadiologistID) : null,
            final_rad_remote_id: finalRadRemoteId,
            procedure_remote_id: row.ForProcedureID ? Number(row.ForProcedureID) : null,
            modality_remote_id: row.ForModalityID ? Number(row.ForModalityID) : null,
            study_source_remote_id: row.StudySourceID ? Number(row.StudySourceID) : null,
          };

          if (!currentStudy) {
            const potentialDup = await tx.study.findFirst({
              where: {
                patient_name: row.PatientName,
                hospital_name: row.HospitalName,
                procedure_raw: row.ProcedureName,
                modality: row.Modality,
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
      }, { timeout: 30000 });
    }

    const isFullSync = !customDateFrom && !customDateTo;
    if (isFullSync) {
      await prisma.dbInstance.update({
        where: { id: instanceId },
        data: { last_synced_at: dateTo }
      });
    }

    if (newCount > 0) {
      mapUnmappedStudies(instanceId).catch((err: any) => console.error('[MAPPING BG] Sync trigger failed', err));
    }

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
