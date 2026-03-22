import sql from 'mssql';
import { decrypt } from './encryption';

interface InstanceConfig {
  id: string;
  ip: string;
  port: number;
  username: string;
  password_encrypted: string;
  reporting_db: string;
  radiology_db: string;
}

// Global pool cache to prevent connection exhaustion
const pools: Record<string, sql.ConnectionPool> = {};

export async function getDbPool(instance: InstanceConfig): Promise<sql.ConnectionPool> {
  if (!pools[instance.id]) {
    const password = decrypt(instance.password_encrypted);

    const config: sql.config = {
      server: instance.ip,
      port: instance.port,
      user: instance.username,
      password,
      database: instance.reporting_db,
      options: {
        // CRITICAL: Always true for production safety
        readOnlyIntent: true,
        encrypt: false, // Assuming internal network
        trustServerCertificate: true,
        connectTimeout: 15000,
        requestTimeout: 60000,
      },
      pool: {
        max: 5,
        min: 0,
        idleTimeoutMillis: 30000,
      },
    };

    const pool = new sql.ConnectionPool(config);
    const close = pool.close.bind(pool);
    pool.close = (...args: any[]) => {
      delete pools[instance.id];
      // @ts-ignore
      return close(...args);
    };

    await pool.connect();
    pools[instance.id] = pool;
  }

  return pools[instance.id];
}

export async function testConnection(instance: InstanceConfig): Promise<{ success: boolean; error?: string }> {
  let pool: sql.ConnectionPool | null = null;
  try {
    const password = decrypt(instance.password_encrypted);

    const config: sql.config = {
      server: instance.ip,
      port: instance.port,
      user: instance.username,
      password,
      database: instance.reporting_db,
      options: {
        readOnlyIntent: true, // Always read-only
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 5000, // Short timeout for test
      },
    };

    pool = await new sql.ConnectionPool(config).connect();
    await pool.request().query('SELECT 1 as is_alive');
    
    // Also test Radiology DB
    await pool.request().query(`SELECT 1 as is_alive FROM [${instance.radiology_db}].sys.tables WHERE 1=0`);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Connection failed' };
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}
