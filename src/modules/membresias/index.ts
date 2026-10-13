/**
 * API PÚBLICA del módulo membresias.
 *
 * Los demás módulos importan SOLO desde acá: `@/modules/membresias`.
 */

import type { Context } from 'hono';
import type { DB } from '@/lib/db';
import type { ServicioClientes } from '@/modules/clientes';
import { crearServicioMembresias } from './application/membresias.service';
import { rutasMembresias, rutasPlanes } from './http/routes';
import { crearRepoMembresias } from './infrastructure/membresias.repo';

export function moduloMembresias(
  db: DB,
  deps: {
    clientes: Pick<ServicioClientes, 'obtener'>;
    /** id del usuario que opera; queda en creado_por y registrado_por. */
    operadorActual: (c: Context) => number;
    /** Con cuántos días de anticipación se avisa que renueve. */
    diasDeAviso?: number;
  },
) {
  const servicio = crearServicioMembresias(crearRepoMembresias(db), deps.clientes, {
    diasDeAviso: deps.diasDeAviso,
  });
  return {
    servicio,
    rutas: rutasMembresias(servicio, deps.operadorActual),
    rutasPlanes: rutasPlanes(servicio),
  };
}

export type {
  CotizacionVista,
  HistorialMembresias,
  PlanesConPrecio,
  ServicioMembresias,
  VentaRegistrada,
} from './application/membresias.service';
export type { Cobertura, EstadoMembresia, SituacionCliente } from './domain/estado';
export { coberturaDelCliente, estadoMembresia } from './domain/estado';
export type { PrecioResuelto, PrecioVigencia } from './domain/precios';
export { SinPrecioVigenteError, precioBase, resolverPrecio } from './domain/precios';
export type { EntradaRenovacion, PeriodoMembresia } from './domain/renovacion';
export { calcularPeriodo } from './domain/renovacion';
export { cotizarVenta } from './domain/venta';
export { METODOS_PAGO, ventaInputSchema } from './http/schemas';
export type { CoberturasDeClientes } from './application/membresias.service';
