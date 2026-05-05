import Redis from 'ioredis';

const globalForRedis = global as unknown as { redis: Redis | undefined };

export const redis =
  globalForRedis.redis ??
  (() => {
    const client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 1, // Minimize build-time retry wait
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 50, 2000)), // Stop after 3 retries during build
    });
    client.on('error', (err: any) => {
      // Suppress connection errors during build-time static generation
      if (process.env.NODE_ENV === 'production' && err.code === 'ECONNREFUSED') {
        // Silent
      } else {
        console.error('[REDIS] Connection error:', err.message);
      }
    });
    return client;
  })();

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

export default redis;
