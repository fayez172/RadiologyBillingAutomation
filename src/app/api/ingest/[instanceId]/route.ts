/**
 * POST /api/ingest/[instanceId]
 *
 * Receives study data pushed by the TeleRad Edge Agent.
 * - Validates HMAC-SHA256 signature
 * - Upserts studies (handles insert, update, delete)
 * - Upserts reference data if present
 * - Triggers BullMQ mapping engine for new/updated studies
 * - Handles remote backfill commands from billing admin
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { mapUnmappedStudies } from "@/lib/mapping-engine";

// ── Types ──────────────────────────────────────────────────────────────────────

interface StudyPayload {
  op: "insert" | "update" | "delete";
  workflow_id: number;
  mrn?: string;
  procedure_name?: string;
  report_completed_at?: string;
  hospital_name?: string;
  radiologist?: string;
  modality?: string;
  image_count?: number;
  patient_name?: string;
}

interface RefDataPayload {
  radiologists?: Array<{ ID: number; DisplayName: string; FirstName?: string; LastName?: string; Active: boolean }>;
  modalities?:   Array<{ ID: number; DisplayName: string; Code: string; Active: boolean }>;
  studysource?:  Array<{ ID: number; Name: string; Active: boolean }>;
}

interface IngestBody {
  payload_version: string;
  instance_id: string;
  pushed_at: string;
  is_backfill?: boolean;
  is_heartbeat?: boolean;
  studies: StudyPayload[];
  ref_data?: RefDataPayload;
  backfill_progress?: {
    total_pushed: number;
    batch_offset: number;
    is_complete: boolean;
  };
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { instanceId: string } }
) {
  const { instanceId } = params;
  
  try {
    const rawBody = await req.arrayBuffer();
    const bodyBytes = Buffer.from(rawBody);

    // 1. Load instance and validate
    const instance = await prisma.dbInstance.findUnique({
      where: { id: instanceId },
      select: { id: true, agent_api_key: true, is_active: true, name: true },
    });

    if (!instance || !instance.is_active) {
      console.warn(`[ingest] Instance not found or inactive: ${instanceId}`);
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }
    if (!instance.agent_api_key) {
      console.warn(`[ingest] Agent not configured for instance: ${instanceId}`);
      return NextResponse.json({ error: "Agent not configured for this instance" }, { status: 403 });
    }

    // 2. Verify HMAC signature
    const signature = req.headers.get("X-Signature") ?? "";
    const expected = createHmac("sha256", instance.agent_api_key)
      .update(bodyBytes)
      .digest("hex");

    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      console.warn(`[ingest] Invalid signature for instance: ${instanceId}`);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 3. Parse body
    let body: IngestBody;
    try {
      body = JSON.parse(bodyBytes.toString("utf-8"));
    } catch (err) {
      console.warn(`[ingest] Invalid JSON from instance: ${instanceId}`);
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // 4. Update agent last seen
    await prisma.dbInstance.update({
      where: { id: instanceId },
      data: { agent_last_seen_at: new Date(body.pushed_at) },
    });

    const logEntry = {
      instance_id: instanceId,
      pushed_at: new Date(body.pushed_at),
      is_backfill: body.is_backfill ?? false,
      is_heartbeat: body.is_heartbeat ?? false,
      studies_count: 0,
      deletes_count: 0,
      ref_data_count: 0,
      status: "OK" as string,
      error_message: null as string | null,
    };

    // 5. Heartbeat — no study processing needed
    if (body.is_heartbeat) {
      await prisma.agentPushLog.create({ data: logEntry });
      return NextResponse.json({ accepted: 0, command: await getPendingCommand(instanceId) });
    }

    // 6. Upsert reference data
    if (body.ref_data) {
      const refCount = await upsertRefData(instanceId, body.ref_data);
      logEntry.ref_data_count = refCount;
    }

    // 7. Upsert studies
    const { upserted, deleted } = await upsertStudies(instanceId, body.studies || []);
    logEntry.studies_count = upserted;
    logEntry.deletes_count = deleted;

    // 8. Trigger mapping engine (skip during backfill — run once at end)
    if (!body.is_backfill && upserted > 0) {
      // Direct call instead of queue as BullMQ is not configured
      mapUnmappedStudies(instanceId).catch(err => console.error("[ingest] Background mapping failed", err));
    } else if (body.is_backfill && body.backfill_progress?.is_complete) {
      mapUnmappedStudies(instanceId).catch(err => console.error("[ingest] Post-backfill mapping failed", err));
    }

    // 9. Update last_synced_at on the instance
    await prisma.dbInstance.update({
      where: { id: instanceId },
      data: { last_synced_at: new Date(body.pushed_at) },
    });

    await prisma.agentPushLog.create({ data: logEntry });

    return NextResponse.json({
      accepted: upserted,
      deleted,
      command: await getPendingCommand(instanceId),
    });

  } catch (err) {
    console.error("[ingest] Critical error processing push from", instanceId, err);
    
    // Attempt to log error to database
    try {
      await prisma.agentPushLog.create({
        data: {
          instance_id: instanceId,
          pushed_at: new Date(),
          status: "ERROR",
          error_message: err instanceof Error ? err.message : String(err),
        }
      });
    } catch (dbErr) {
      console.error("[ingest] Failed to log error to database", dbErr);
    }

    return NextResponse.json({ error: "Internal server error", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// ── Study Upsert ──────────────────────────────────────────────────────────────

async function upsertStudies(
  instanceId: string,
  studies: StudyPayload[]
): Promise<{ upserted: number; deleted: number }> {
  let upserted = 0;
  let deleted = 0;

  const toUpsert = studies.filter((s) => s.op === "insert" || s.op === "update");
  const toDelete = studies.filter((s) => s.op === "delete");

  // Batch upserts in chunks of 500
  const CHUNK = 500;
  for (let i = 0; i < toUpsert.length; i += CHUNK) {
    const chunk = toUpsert.slice(i, i + CHUNK);
    await Promise.all(
      chunk.map((s) => {
        const compositeKey = `${instanceId}:${s.workflow_id}`;
        return prisma.study.upsert({
          where: { composite_key: compositeKey },
          create: {
            composite_key: compositeKey,
            instance_id: instanceId,
            workflow_id: String(s.workflow_id),
            mrn: s.mrn,
            procedure_raw: s.procedure_name,
            report_dt: s.report_completed_at ? new Date(s.report_completed_at) : null,
            hospital_name: s.hospital_name,
            final_rad_name: s.radiologist,
            modality: s.modality,
            image_count: s.image_count,
            patient_name: s.patient_name,
          },
          update: {
            mrn: s.mrn,
            procedure_raw: s.procedure_name,
            report_dt: s.report_completed_at ? new Date(s.report_completed_at) : null,
            hospital_name: s.hospital_name,
            final_rad_name: s.radiologist,
            modality: s.modality,
            image_count: s.image_count,
            patient_name: s.patient_name,
          },
        });
      })
    );
    upserted += chunk.length;
  }

  // Mark deleted studies
  if (toDelete.length > 0) {
    const deleteKeys = toDelete.map((s) => `${instanceId}:${s.workflow_id}`);
    await prisma.study.updateMany({
      where: { composite_key: { in: deleteKeys } },
      data: { mapping_confidence: "UNMAPPED" },  // soft-delete marker
    });
    deleted = toDelete.length;
  }

  return { upserted, deleted };
}

// ── Reference Data Upsert ─────────────────────────────────────────────────────

async function upsertRefData(instanceId: string, ref: RefDataPayload): Promise<number> {
  let count = 0;

  if (ref.radiologists) {
    await Promise.all(
      ref.radiologists.map((r) =>
        prisma.remoteRadiologist.upsert({
          where: { remote_id_instance_id: { remote_id: r.ID, instance_id: instanceId } },
          create: {
            remote_id: r.ID,
            instance_id: instanceId,
            display_name: r.DisplayName,
            first_name: r.FirstName ?? null,
            last_name: r.LastName ?? null,
            is_active: r.Active,
          },
          update: {
            display_name: r.DisplayName,
            is_active: r.Active,
          },
        })
      )
    );
    count += ref.radiologists.length;
  }

  if (ref.modalities) {
    await Promise.all(
      ref.modalities.map((m) =>
        prisma.remoteModality.upsert({
          where: { remote_id_instance_id: { remote_id: m.ID, instance_id: instanceId } },
          create: {
            remote_id: m.ID,
            instance_id: instanceId,
            display_name: m.DisplayName,
            code: m.Code,
            is_active: m.Active,
          },
          update: { display_name: m.DisplayName, is_active: m.Active },
        })
      )
    );
    count += ref.modalities.length;
  }

  if (ref.studysource) {
    await Promise.all(
      ref.studysource.map((s) =>
        prisma.remoteStudySource.upsert({
          where: { remote_id_instance_id: { remote_id: s.ID, instance_id: instanceId } },
          create: {
            remote_id: s.ID,
            instance_id: instanceId,
            name: s.Name,
            is_active: s.Active,
          },
          update: { name: s.Name, is_active: s.Active },
        })
      )
    );
    count += ref.studysource.length;
  }

  return count;
}

// ── Remote Command ────────────────────────────────────────────────────────────

/**
 * Check if there's a pending admin command for this instance.
 * Commands are stored as a JSON string in DbInstance (or a separate table).
 * For now we use a simple approach: admin sets a flag in the DB,
 * and we return it once (then clear it).
 */
async function getPendingCommand(instanceId: string): Promise<object | null> {
  // Future: check a commands table. For now, returns null.
  return null;
}
