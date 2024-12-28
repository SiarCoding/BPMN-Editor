import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from "./schema";
import 'dotenv/config';

// Erstelle die Verbindungsoptionen
const connectionConfig = {
  host: process.env.PGHOST || 'ep-late-pine-a4arhd49.us-east-1.aws.neon.tech',
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'neondb',
  user: process.env.PGUSER || 'neondb_owner',
  password: process.env.PGPASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
};

// Erstelle den Connection Pool
const pool = new Pool(connectionConfig);

// Test die Verbindung
pool.connect((err, client, release) => {
  if (err) {
    console.error('Fehler bei der Datenbankverbindung:', err.message);
    return;
  }
  console.log('Erfolgreich mit der Datenbank verbunden!');
  release();
});

// Erstelle den Drizzle Client
export const db = drizzle(pool, { schema });
