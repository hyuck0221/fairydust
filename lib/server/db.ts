import mysql from "mysql2/promise";
import { requiredEnv } from "./env.js";

let pool: mysql.Pool | undefined;

function databaseEndpoint(): { host: string; port: number } {
  const rawHost = requiredEnv("DB_HOST");
  const [host, inlinePort] = rawHost.split(":");

  return {
    host,
    port: Number(inlinePort || process.env.DB_PORT || 3306)
  };
}

export function getPool(): mysql.Pool {
  if (!pool) {
    const endpoint = databaseEndpoint();

    pool = mysql.createPool({
      host: endpoint.host,
      port: endpoint.port,
      user: requiredEnv("DB_USER"),
      password: requiredEnv("DB_PASSWORD"),
      database: requiredEnv("DB_NAME"),
      waitForConnections: true,
      connectionLimit: 5,
      namedPlaceholders: true,
      timezone: "Z"
    });
  }

  return pool;
}

export async function queryRows<T>(sql: string, params: Record<string, unknown> = {}): Promise<T[]> {
  const [rows] = await getPool().execute(sql, params as never);
  return rows as T[];
}

export async function queryOne<T>(sql: string, params: Record<string, unknown> = {}): Promise<T | null> {
  const rows = await queryRows<T>(sql, params);
  return rows[0] || null;
}

export async function execute(sql: string, params: Record<string, unknown> = {}): Promise<mysql.ResultSetHeader> {
  const [result] = await getPool().execute(sql, params as never);
  return result as mysql.ResultSetHeader;
}

export async function withTransaction<T>(callback: (connection: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
