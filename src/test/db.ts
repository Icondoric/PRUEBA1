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

import { createHash, randomBytes, scryptSync } from 'node:crypto';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '@/lib/db/schema';
import type { DB } from '@/lib/db';
import { COOKIE_SESION, type Permiso } from '@/modules/usuarios';
import { type OpcionesDeApp, crearApp } from '@/server';

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

// ─── sesión de prueba ────────────────────────────────────────────────────────

const PASSWORD_DE_PRUEBA = 'clave-de-prueba';
// El hash se calcula una vez por archivo de tests: scrypt es lento a propósito.
let hashDePrueba: string | undefined;

export interface OpcionesDeSesion {
  /**
   * Con qué accesos entra. Sin esto, entra el dueño (puede todo).
   * Con una lista, entra un usuario de recepción con exactamente esos accesos.
   */
  permisos?: readonly Permiso[];
  app?: OpcionesDeApp;
}

/**
 * La app con alguien ya adentro: `request()` manda la cookie de sesión sola.
 *
 * La sesión se inserta directo en la base (sin pasar por el login) para no
 * pagar un hash de contraseña en cada test. El login de verdad tiene sus
 * propios tests.
 */
export function appConSesion(db: DB, opciones: OpcionesDeSesion = {}) {
  const app = crearApp(db, opciones.app);
  hashDePrueba ??= hashearPasswordDePrueba();

  const dueno = db
    .insert(schema.usuarios)
    .values({
      usuario: 'dueno',
      nombre: 'Dueña de Prueba',
      passwordHash: hashDePrueba,
      rol: 'admin',
    })
    .returning()
    .get();

  let usuario = dueno;
  if (opciones.permisos) {
    usuario = db
      .insert(schema.usuarios)
      .values({
        usuario: 'recepcion',
        nombre: 'Recepción de Prueba',
        passwordHash: hashDePrueba,
        rol: 'recepcion',
      })
      .returning()
      .get();
    if (opciones.permisos.length > 0) {
      db.insert(schema.usuarioPermisos)
        .values(
          opciones.permisos.map((permiso) => ({
            usuarioId: usuario.id,
            permiso,
            otorgadoPor: dueno.id,
          })),
        )
        .run();
    }
  }

  const token = randomBytes(32).toString('base64url');
  db.insert(schema.sesiones)
    .values({
      // mismo hash que usa el módulo de usuarios para guardar el token
      tokenHash: createHash('sha256').update(token).digest('hex'),
      usuarioId: usuario.id,
      ultimoUso: (opciones.app?.ahora ?? (() => new Date()))(),
    })
    .run();

  const cookie = `${COOKIE_SESION}=${token}`;

  return {
    /** Igual que `app.request`, pero con la sesión puesta. */
    request(ruta: string, init: RequestInit = {}) {
      const headers = new Headers(init.headers);
      headers.set('cookie', cookie);
      return app.request(ruta, { ...init, headers });
    },
    /** Sin sesión: para probar que la puerta está cerrada. */
    sinSesion: (ruta: string, init: RequestInit = {}) => app.request(ruta, init),
    usuarioId: usuario.id,
    duenoId: dueno.id,
    password: PASSWORD_DE_PRUEBA,
    rutas: app.routes,
  };
}

function hashearPasswordDePrueba(): string {
  const sal = randomBytes(16);
  return `scrypt$${sal.toString('hex')}$${scryptSync(PASSWORD_DE_PRUEBA, sal, 64).toString('hex')}`;
}
