import { DbInstance } from "@prisma/client";

export type AgentStatus = 'ONLINE' | 'STALE' | 'OFFLINE' | 'INACTIVE';

/**
 * Calculates the health status of an agent based on its last seen timestamp.
 */
export function getAgentStatus(instance: Partial<DbInstance>): AgentStatus {
  if (!instance.is_active) return 'INACTIVE';
  
  if (!instance.agent_mode || !instance.agent_last_seen_at) {
    return 'OFFLINE';
  }

  const now = new Date();
  const lastSeen = new Date(instance.agent_last_seen_at);
  const diffMs = now.getTime() - lastSeen.getTime();
  const diffMin = diffMs / 60000;

  if (diffMin < 5) return 'ONLINE';
  if (diffMin < 30) return 'STALE';
  return 'OFFLINE';
}
