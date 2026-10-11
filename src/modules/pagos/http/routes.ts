/**
 * CAPA HTTP — rutas de pagos. Finas y sin try/catch.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { hoyEnZona } from '@/lib/fechas';
import type { ServicioPagos } from '../application/pagos.service';
import {
  anulacionInputSchema,
  idParamSchema,
  listarPagosQuerySchema,
  pagosDeClienteQuerySchema,
} from './schemas';

export function rutasPagos(servicio: ServicioPagos) {
  return new Hono()
    .get('/', zValidator('query', listarPagosQuerySchema), (c) =>
      c.json(servicio.listar(c.req.valid('query'), hoyEnZona())),
    )

    .get('/de-cliente', zValidator('query', pagosDeClienteQuerySchema), (c) =>
      c.json(servicio.deCliente(c.req.valid('query').clienteId)),
    )

    .post(
      '/:id/anulacion',
      zValidator('param', idParamSchema),
      zValidator('json', anulacionInputSchema),
      (c) => c.json(servicio.anular(c.req.valid('param').id, c.req.valid('json').motivo)),
    );
}
