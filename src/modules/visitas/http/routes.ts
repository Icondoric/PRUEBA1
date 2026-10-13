/**
 * CAPA HTTP — rutas de visitas. Finas y sin try/catch.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { hoyEnZona } from '@/lib/fechas';
import type { ServicioVisitas } from '../application/visitas.service';
import { listarVisitasQuerySchema, visitaInputSchema } from './schemas';

/**
 * @param operadorActual el id de quien inició sesión; queda como quien lo registró.
 */
export function rutasVisitas(
  servicio: ServicioVisitas,
  operadorActual: (c: Context) => number,
) {
  return new Hono()
    .get('/', zValidator('query', listarVisitasQuerySchema), (c) =>
      c.json(servicio.listar(c.req.valid('query'), hoyEnZona())),
    )

    .post('/', zValidator('json', visitaInputSchema), (c) =>
      c.json(
        servicio.registrar(c.req.valid('json'), hoyEnZona(), operadorActual(c)),
        201,
      ),
    );
}
