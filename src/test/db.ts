/**
 * Base SQLite en memoria para los tests de API.
 *
 * Usa las MIGRACIONES REALES de ./drizzle, no un CREATE TABLE escrito a mano.
 * Es la diferencia entre un test que valida tu sistema y uno que valida una
 * base paralela que se parece: si una migración rompe algo, los tests tienen
 * que enterarse.
 *
 * `:memory:` hace que cada test arranque limpio y corra en milisegundos.
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '@/lib/db/schema';
import type { DB } from '@/lib/db';

export function dbDePrueba(): DB {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: './drizzle' });

  return db;
}

/** Planes mínimos para los tests que tocan membresías. */
export function sembrarPlanes(db: DB) {
  return db
    .insert(schema.planes)
    .values([
      { nombre: 'Mensual', diasDuracion: 30, esPaseDiario: false },
      { nombre: 'Pase por sesión', diasDuracion: 1, esPaseDiario: true },
    ])
    .returning()
    .all();
}
