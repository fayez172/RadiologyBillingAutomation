import { prisma } from "./prisma";

const MAX_CLOCK_SKEW_SECONDS = 300; // 5 minutes

export class NonceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonceError";
  }
}

/**
 * Validates the timestamp and nonce for a request.
 * Throws NonceError if validation fails.
 */
export async function validateNonce(instanceId: string, nonce: string, timestampStr: string) {
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) {
    throw new NonceError("Invalid timestamp");
  }

  const now = Math.floor(Date.now() / 1000);
  const diff = Math.abs(now - timestamp);

  if (diff > MAX_CLOCK_SKEW_SECONDS) {
    throw new NonceError(`Request timestamp is outside the allowed window. Skew: ${diff}s`);
  }

  // Store the new nonce with an expiration
  // We expire nonces after 10 minutes (skew window + buffer)
  const expiresAt = new Date((now + 600) * 1000);

  try {
    await prisma.agentNonce.create({
      data: {
        instance_id: instanceId,
        nonce: nonce,
        expires_at: expiresAt,
      },
    });

    // Background cleanup (optional, but good practice)
    if (Math.random() < 0.05) {
      void cleanupNonces();
    }

  } catch (error: any) {
    if (error.code === 'P2002') {
      throw new NonceError("Replay attack detected: Nonce already used");
    }
    console.error("Nonce validation DB error:", error);
    throw new Error("Internal security service error");
  }
}

async function cleanupNonces() {
  try {
    await prisma.agentNonce.deleteMany({
      where: {
        expires_at: {
          lt: new Date(),
        },
      },
    });
  } catch (err) {
    console.error("Failed to cleanup nonces:", err);
  }
}
