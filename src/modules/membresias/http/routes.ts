/**
 * CAPA HTTP — rutas de planes y membresías.
 *
 * Finas: validan la entrada, llaman al servicio, devuelven. Sin try/catch: los
 * errores suben al middleware único.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { hoyEnZona } from '@/lib/fechas';
import type { ServicioMembresias } from '../application/membresias.service';
import { cotizacionQuerySchema, historialQuerySchema, ventaInputSchema } from './schemas';

export function rutasPlanes(servicio: ServicioMembresias) {
  return new Hono().get('/', (c) => c.json(servicio.planesConPrecio(hoyEnZona())));
}

/**
 * @param operadorActual id del usuario que está operando. Hoy lo resuelve el
 *   servidor de forma provisoria; cuando exista el login saldrá de la sesión.
 */
export function rutasMembresias(
  servicio: ServicioMembresias,
  operadorActual: () => number,
) {
  return new Hono()
    .get('/', zValidator('query', historialQuerySchema), (c) =>
      c.json(servicio.historial(c.req.valid('query').clienteId, hoyEnZona())),
    )

    .get('/cotizacion', zValidator('query', cotizacionQuerySchema), (c) =>
      c.json(servicio.cotizar(c.req.valid('query'), hoyEnZona())),
    )

    .post('/', zValidator('json', ventaInputSchema), (c) =>
      c.json(servicio.vender(c.req.valid('json'), hoyEnZona(), operadorActual()), 201),
    );
}
