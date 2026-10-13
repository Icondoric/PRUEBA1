/**
 * API PÚBLICA del módulo reportes.
 *
 * Los demás módulos importan SOLO desde acá: `@/modules/reportes`.
 */

import type { DB } from '@/lib/db';
import { crearServicioReportes } from './application/reportes.service';
import { rutasReportes } from './http/routes';
import { crearRepoReportes } from './infrastructure/reportes.repo';

export function moduloReportes(db: DB) {
  const servicio = crearServicioReportes(crearRepoReportes(db));
  return { servicio, rutas: rutasReportes(servicio) };
}

export type { Reporte, ServicioReportes } from './application/reportes.service';
export type { MesISO } from './domain/calendario';
