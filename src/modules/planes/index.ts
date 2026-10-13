/**
 * API PÚBLICA del módulo planes: administrar planes, precios y promociones.
 *
 * Los demás módulos importan SOLO desde acá: `@/modules/planes`.
 */

import type { DB } from '@/lib/db';
import { crearServicioPlanes } from './application/planes.service';
import { rutasGestionDePlanes } from './http/routes';
import { crearRepoPlanes } from './infrastructure/planes.repo';

export function moduloPlanes(db: DB) {
  const servicio = crearServicioPlanes(crearRepoPlanes(db));
  return { servicio, rutas: rutasGestionDePlanes(servicio) };
}

export type {
  ListaDePlanes,
  PlanAdministrable,
  ServicioPlanes,
  SimulacionDePrecio,
} from './application/planes.service';
export type { EstadoDePrecio } from './domain/plan';
export { nombreDePlanSchema, planNuevoSchema, precioInputSchema } from './http/schemas';
