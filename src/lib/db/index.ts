/**
 * Conexión a la base. Un archivo SQLite en disco.
 *
 * `WAL` deja que el check-in lea mientras alguien guarda un pago, en vez de
 * esperar. Sin eso, con dos pestañas abiertas vas a ver "database is locked"
 * justo cuando hay cola en el mostrador.
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

export type DB = ReturnType<typeof crearDb>;

export function crearDb(ruta: string) {
  const sqlite = new Database(ruta);

  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON'); // SQLite las ignora si no lo pedís
  sqlite.pragma('busy_timeout = 5000');

  return drizzle(sqlite, { schema });
}

export function migrar(db: DB, carpeta = './drizzle') {
  migrate(db, { migrationsFolder: carpeta });
}

export { schema };
