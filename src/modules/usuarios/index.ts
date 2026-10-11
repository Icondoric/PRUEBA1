/**
 * API PÚBLICA del módulo usuarios.
 *
 * Por ahora solo resuelve quién opera (ver usuarios.service.ts). El login, los
 * roles y las rutas llegan con el módulo de auth.
 */

import type { DB } from '@/lib/db';
import { crearServicioUsuarios } from './application/usuarios.service';
import { crearRepoUsuarios } from './infrastructure/usuarios.repo';

export function moduloUsuarios(db: DB) {
  return { servicio: crearServicioUsuarios(crearRepoUsuarios(db)) };
}

export type { ServicioUsuarios } from './application/usuarios.service';
