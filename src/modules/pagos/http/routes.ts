/**
 * CAPA HTTP — rutas de pagos. Finas y sin try/catch.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { hoyEnZona } from '@/lib/fechas';
import type { ServicioPagos } from '../application/pagos.service';
import {
  anulacionInputSchema,
  idParamSchema,
  listarPagosQuerySchema,
  pagosDeClienteQuerySchema,
} from './schemas';

export interface DepsDePagos {
  /** El id de quien inició sesión; queda como quien anuló. */
  operadorActual: (c: Context) => number;
  /** ¿Quien pide tiene acceso a ver la caja de otras fechas? */
  puedeVerOtrasFechas: (c: Context) => boolean;
  /** La hora real, para registrar cuándo se anuló. */
  ahora: () => Date;
}

export function rutasPagos(servicio: ServicioPagos, deps: DepsDePagos) {
  return new Hono()
    .get('/', zValidator('query', listarPagosQuerySchema), (c) =>
      c.json(
        servicio.listar(c.req.valid('query'), hoyEnZona(), deps.puedeVerOtrasFechas(c)),
      ),
    )

    .get('/de-cliente', zValidator('query', pagosDeClienteQuerySchema), (c) =>
      c.json(servicio.deCliente(c.req.valid('query').clienteId)),
    )

    .post(
      '/:id/anulacion',
      zValidator('param', idParamSchema),
      zValidator('json', anulacionInputSchema),
      (c) =>
        c.json(
          servicio.anular(
            c.req.valid('param').id,
            c.req.valid('json').motivo,
            deps.operadorActual(c),
            deps.ahora(),
          ),
        ),
    );
}
