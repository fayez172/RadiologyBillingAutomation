/**
 * POST /api/ingest/[instanceId]
 *
 * Receives study data pushed by the TeleRad Edge Agent.
 * - Validates HMAC-SHA256 signature (timestamp + nonce + body)
 * - Replay protection via X-Timestamp and X-Nonce
 * - Upserts studies (handles insert, update, delete)
 * - Upserts reference data if present
 * - Triggers mapping engine for new/updated studies
 * - Handles remote backfill commands from billing admin
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { mapUnmappedStudies } from "@/lib/mapping-engine";
import { validateNonce, NonceError } from "@/lib/nonce-service";

// ── Validation Schemas ────────────────────────────────────────────────────────

const StudySchema = z.object({
  op: z.enum(["insert", "update", "delete"]),
  workflow_id: z.union([z.number(), z.string()]),
  mrn: z.string().optional().nullable(),
  procedure_name: z.string().optional().nullable(),
  report_completed_at: z.string().optional().nullable(),
  hospital_name: z.string().optional().nullable(),
  radiologist: z.string().optional().nullable(),
  modality: z.string().optional().nullable(),
  image_count: z.number().optional().nullable(),
  patient_name: z.string().optional().nullable(),

  // Remote IDs for precedence logic and tracking
  reported_by_remote_id: z.number().optional().nullable(),
  add1_rad_remote_id: z.number().optional().nullable(),
  add2_rad_remote_id: z.number().optional().nullable(),
  add3_rad_remote_id: z.number().optional().nullable(),
  modality_remote_id: z.number().optional().nullable(),
  procedure_remote_id: z.number().optional().nullable(),
  study_source_remote_id: z.number().optional().nullable(),
});

const RefDataSchema = z.object({
  radiologists: z.array(z.record(z.any())).optional(),
  modalities: z.array(z.record(z.any())).optional(),
  studysource: z.array(z.record(z.any())).optional(),
  procedure: z.array(z.record(z.any())).optional(),
}).optional();

const IngestSchema = z.object({
  payload_version: z.string(),
  instance_id: z.string(),
  message_id: z.string().uuid(),
  pushed_at: z.string(),
  is_backfill: z.boolean().optional(),
  is_heartbeat: z.boolean().optional(),
  studies: z.array(StudySchema).optional(),
  ref_data: RefDataSchema,
  backfill_progress: z.object({
    total_pushed: z.number().optional(),
    batch_offset: z.number().optional(),
    is_complete: z.boolean().optional(),
  }).optional(),
  command_id: z.string().optional(),
  command_status: z.enum(["SUCCESS", "FAILED", "IN_PROGRESS", "CANCELLED"]).optional(),
  command_error: z.string().optional(),
});

type IngestBody = z.infer<typeof IngestSchema>;

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { instanceId: string } }
) {
  const { instanceId } = params;
  
  try {
    const rawBody = await req.arrayBuffer();
    const bodyBytes = Buffer.from(rawBody);

    // 1. Security Headers
    const signature = req.headers.get("X-Signature") ?? "";
    const timestamp = req.headers.get("X-Timestamp") ?? "";
    const nonce = req.headers.get("X-Nonce") ?? "";

    if (!signature || !timestamp || !nonce) {
      return NextResponse.json({ error: "Missing security headers" }, { status: 401 });
    }

    // 2. Load instance and validate
    const instance = await prisma.dbInstance.findUnique({
      where: { id: instanceId },
      select: { id: true, agent_api_key: true, is_active: true },
    });

    if (!instance || !instance.is_active || !instance.agent_api_key) {
      return NextResponse.json({ error: "Unauthorized or inactive instance" }, { status: 403 });
    }

    // 3. Replay Protection
    try {
      await validateNonce(instanceId, nonce, timestamp);
    } catch (err) {
      if (err instanceof NonceError) {
        return NextResponse.json({ error: err.message }, { status: 401 });
      }
      throw err;
    }

    // 4. Verify HMAC signature
    // Base = timestamp + nonce + body
    const hmacBase = Buffer.concat([
      Buffer.from(timestamp),
      Buffer.from(nonce),
      bodyBytes
    ]);
    const expected = createHmac("sha256", instance.agent_api_key)
      .update(hmacBase)
      .digest("hex");

    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 5. Parse and Validate Body
    let body: IngestBody;
    try {
      const parsed = JSON.parse(bodyBytes.toString("utf-8"));
      body = IngestSchema.parse(parsed);
    } catch (err) {
      return NextResponse.json({ error: "Invalid payload schema", details: err }, { status: 400 });
    }

    // 5.5 Idempotency Check
    const existingLog = await prisma.agentPushLog.findUnique({
      where: { 
        instance_id_message_id: { 
          instance_id: instanceId, 
          message_id: body.message_id 
        } 
      },
      select: { id: true }
    });

    if (existingLog) {
      return NextResponse.json({ 
        status: "IDEMPOTENT_OK", 
        message: "Message already processed",
        command: await getPendingCommand(instanceId) 
      });
    }

    // 6. Update agent last seen
    const lastSeenAt = new Date(body.pushed_at);
    await prisma.dbInstance.update({
      where: { id: instanceId },
      data: { 
        agent_last_seen_at: lastSeenAt,
        agent_last_error: body.command_status === "FAILED" ? body.command_error : undefined
      },
    });

    // 7. Update Command Status & Progress
    if (body.command_id) {
      const command = await prisma.agentCommand.findUnique({
        where: { id: body.command_id }
      });

      // Ownership and Transition Guards
      if (command && command.instance_id === instanceId) {
        const terminalStates = ["COMPLETED", "FAILED", "CANCELLED"];
        if (!terminalStates.includes(command.status)) {
          const isComplete = body.command_status === "SUCCESS" || body.backfill_progress?.is_complete;
          const isFailed = body.command_status === "FAILED";
          const isCancelled = body.command_status === "CANCELLED";

          let status: any = "IN_PROGRESS";
          if (isComplete) status = "COMPLETED";
          if (isFailed) status = "FAILED";
          if (isCancelled) status = "CANCELLED";

          await prisma.agentCommand.update({
            where: { id: body.command_id },
            data: {
              status,
              error_message: body.command_error,
              progress: body.backfill_progress?.is_complete ? 100 : undefined,
              started_at: (body.is_backfill && !command.started_at) ? new Date() : undefined,
              completed_at: isComplete || isFailed || isCancelled ? new Date() : undefined,
            },
          });
        }
      }
    }

    const logEntry = {
      instance_id: instanceId,
      message_id: body.message_id,
      pushed_at: lastSeenAt,
      is_backfill: body.is_backfill ?? false,
      is_heartbeat: body.is_heartbeat ?? false,
      studies_count: 0,
      deletes_count: 0,
      ref_data_count: 0,
      status: "OK",
      error_message: null as string | null,
    };

    // 8. Heartbeat — no study processing needed
    if (body.is_heartbeat) {
      await prisma.agentPushLog.create({ data: logEntry });
      return NextResponse.json({ accepted: 0, command: await getPendingCommand(instanceId) });
    }

    // 9. Upsert reference data
    if (body.ref_data) {
      const refCount = await upsertRefData(instanceId, body.ref_data);
      logEntry.ref_data_count = refCount;
    }

    // 10. Upsert studies
    const { upserted, deleted } = await upsertStudies(instanceId, body.studies || []);
    logEntry.studies_count = upserted;
    logEntry.deletes_count = deleted;

    // 11. Trigger mapping engine
    if (!body.is_backfill && upserted > 0) {
      mapUnmappedStudies(instanceId).catch(err => console.error("[ingest] Background mapping failed", err));
    } else if (body.is_backfill && body.backfill_progress?.is_complete) {
      mapUnmappedStudies(instanceId).catch(err => console.error("[ingest] Post-backfill mapping failed", err));
    }

    await prisma.agentPushLog.create({ data: logEntry });

    return NextResponse.json({
      accepted: upserted,
      deleted,
      command: await getPendingCommand(instanceId),
    });

  } catch (err) {
    console.error("[ingest] Critical error processing push from", instanceId, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── Helper Functions (Logic copied and hardened from original) ────────────────

async function upsertStudies(instanceId: string, studies: any[]) {
  let upserted = 0;
  let deleted = 0;

  const toUpsert = studies.filter((s) => s.op === "insert" || s.op === "update");
  const toDelete = studies.filter((s) => s.op === "delete");

  const CHUNK = 200; // Smaller chunks for better reliability
  for (let i = 0; i < toUpsert.length; i += CHUNK) {
    const chunk = toUpsert.slice(i, i + CHUNK);
    
    // We process in a transaction per chunk for better atomicity and performance
    await prisma.$transaction(async (tx: any) => {
      for (const s of chunk) {
        const compositeKey = `${instanceId}:${s.workflow_id}`;
        
        // Addendum Logic: Add3 > Add2 > Add1 > ReportedBy
        const finalRadRemoteId = s.add3_rad_remote_id 
          ?? s.add2_rad_remote_id 
          ?? s.add1_rad_remote_id 
          ?? s.reported_by_remote_id;

        let finalRadName = s.radiologist || "Unknown";

        // If precedence picked an addendum rad, try to resolve their name via alias
        if (finalRadRemoteId && finalRadRemoteId !== s.reported_by_remote_id) {
          const radAlias = await tx.radiologistAlias.findFirst({
            where: { remote_id: finalRadRemoteId, instance_id: instanceId }
          });
          if (radAlias) {
            finalRadName = radAlias.alias_name;
          } else {
            finalRadName = `Unknown Rad (ID: ${finalRadRemoteId})`;
          }
        }

        const data = {
          composite_key: compositeKey,
          instance_id: instanceId,
          workflow_id: String(s.workflow_id),
          mrn: s.mrn,
          procedure_raw: s.procedure_name,
          report_dt: s.report_completed_at ? new Date(s.report_completed_at) : null,
          hospital_name: s.hospital_name,
          final_rad_name: finalRadName,
          modality: s.modality,
          image_count: s.image_count,
          patient_name: s.patient_name,
          
          // Store remote IDs
          reported_by_remote_id: s.reported_by_remote_id,
          add1_rad_remote_id: s.add1_rad_remote_id,
          add2_rad_remote_id: s.add2_rad_remote_id,
          add3_rad_remote_id: s.add3_rad_remote_id,
          final_rad_remote_id: finalRadRemoteId,
          modality_remote_id: s.modality_remote_id,
          procedure_remote_id: s.procedure_remote_id,
          study_source_remote_id: s.study_source_remote_id,
        };

        await tx.study.upsert({
          where: { composite_key: compositeKey },
          create: data,
          update: data,
        });
      }
    }, { timeout: 15000 });
    
    upserted += chunk.length;
  }

  if (toDelete.length > 0) {
    const deleteKeys = toDelete.map((s) => `${instanceId}:${s.workflow_id}`);
    await prisma.study.updateMany({
      where: { composite_key: { in: deleteKeys } },
      data: { mapping_confidence: "UNMAPPED" }, 
    });
    deleted = toDelete.length;
  }

  return { upserted, deleted };
}

async function upsertRefData(instanceId: string, ref: any) {
  let count = 0;
  if (ref.radiologists) {
    for (const r of ref.radiologists) {
      const remoteId = r.ID ?? r.id;
      const displayName = r.DisplayName ?? r.display_name ?? "Unknown";
      const firstName = r.FirstName ?? r.first_name ?? null;
      const lastName = r.LastName ?? r.last_name ?? null;
      const isActive = r.Active ?? r.active ?? true;

      await prisma.remoteRadiologist.upsert({
        where: { remote_id_instance_id: { remote_id: remoteId, instance_id: instanceId } },
        create: {
          remote_id: remoteId, instance_id: instanceId, display_name: displayName,
          first_name: firstName, last_name: lastName, is_active: isActive,
        },
        update: { display_name: displayName, is_active: isActive },
      });
    }
    count += ref.radiologists.length;
  }
  if (ref.modalities) {
    for (const m of ref.modalities) {
      const remoteId = m.ID ?? m.id;
      const displayName = m.DisplayName ?? m.display_name ?? "Unknown";
      const code = m.Code ?? m.code ?? "UNK";
      const isActive = m.Active ?? m.active ?? true;

      await prisma.remoteModality.upsert({
        where: { remote_id_instance_id: { remote_id: remoteId, instance_id: instanceId } },
        create: { remote_id: remoteId, instance_id: instanceId, display_name: displayName, code: code, is_active: isActive },
        update: { display_name: displayName, is_active: isActive },
      });
    }
    count += ref.modalities.length;
  }
  if (ref.studysource) {
    for (const s of ref.studysource) {
      const remoteId = s.ID ?? s.id;
      const name = s.Name ?? s.name ?? "Unknown";
      const isActive = s.Active ?? s.active ?? true;

      await prisma.remoteStudySource.upsert({
        where: { remote_id_instance_id: { remote_id: remoteId, instance_id: instanceId } },
        create: { remote_id: remoteId, instance_id: instanceId, name: name, is_active: isActive },
        update: { name: name, is_active: isActive },
      });
    }
    count += ref.studysource.length;
  }
  if (ref.procedure) {
    for (const p of ref.procedure) {
      // Map PascalCase from MSSQL to our schema
      const remoteId = p.ID ?? p.id;
      const name = p.Name ?? p.name ?? "Unknown";
      const code = p.ProcedureCode ?? p.procedure_code;
      const isActive = p.Active ?? p.active ?? true;

      await prisma.remoteProcedure.upsert({
        where: { remote_id_instance_id: { remote_id: remoteId, instance_id: instanceId } },
        create: {
          remote_id: remoteId,
          instance_id: instanceId,
          name: name,
          procedure_code: code,
          is_active: isActive,
        },
        update: {
          name: name,
          procedure_code: code,
          is_active: isActive,
        },
      });
    }
    count += ref.procedure.length;
  }
  return count;
}

async function getPendingCommand(instanceId: string) {
  // 1. Check for cancellation requests
  const cancelCmd = await prisma.agentCommand.findFirst({
    where: { instance_id: instanceId, status: "CANCEL_PENDING" },
    orderBy: { updated_at: "desc" },
  });
  
  if (cancelCmd) {
    await prisma.agentCommand.update({
      where: { id: cancelCmd.id },
      data: { status: "CANCEL_SENT" },
    });
    return { id: cancelCmd.id, type: "cancel" };
  }

  // 2. Check for new commands
  const command = await prisma.agentCommand.findFirst({
    where: { instance_id: instanceId, status: "PENDING" },
    orderBy: { created_at: "asc" },
  });
  
  if (!command) return null;

  await prisma.agentCommand.update({
    where: { id: command.id },
    data: { status: "SENT" },
  });

  return {
    id: command.id,
    type: command.command_type.toLowerCase(),
    ...(command.payload as object),
  };
}
