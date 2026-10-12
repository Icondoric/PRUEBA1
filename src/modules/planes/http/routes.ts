/**
 * CAPA HTTP — rutas para administrar planes y precios. Finas y sin try/catch.
 *
 * Solo para quien tiene el acceso "Planes y precios" (ver src/server/acceso.ts).
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { hoyEnZona } from '@/lib/fechas';
import type { ServicioPlanes } from '../application/planes.service';
import {
  estadoDePlanSchema,
  idParamSchema,
  nombreDePlanSchema,
  planNuevoSchema,
  precioInputSchema,
} from './schemas';

export function rutasGestionDePlanes(servicio: ServicioPlanes) {
  return new Hono()
    .get('/', (c) => c.json(servicio.listar(hoyEnZona())))

    .post('/', zValidator('json', planNuevoSchema), (c) =>
      c.json(servicio.crearPlan(c.req.valid('json'), hoyEnZona()), 201),
    )

    .put(
      '/:id',
      zValidator('param', idParamSchema),
      zValidator('json', nombreDePlanSchema),
      (c) =>
        c.json(
          servicio.renombrarPlan(c.req.valid('param').id, c.req.valid('json').nombre),
        ),
    )

    .put(
      '/:id/estado',
      zValidator('param', idParamSchema),
      zValidator('json', estadoDePlanSchema),
      (c) =>
        c.json(
          servicio.cambiarEstadoDePlan(
            c.req.valid('param').id,
            c.req.valid('json').activo,
          ),
        ),
    )

    .post(
      '/:id/precios/simulacion',
      zValidator('param', idParamSchema),
      zValidator('json', precioInputSchema),
      (c) =>
        c.json(
          servicio.simularPrecio(
            c.req.valid('param').id,
            c.req.valid('json'),
            hoyEnZona(),
          ),
        ),
    )

    .post(
      '/:id/precios',
      zValidator('param', idParamSchema),
      zValidator('json', precioInputSchema),
      (c) =>
        c.json(
          servicio.agregarPrecio(
            c.req.valid('param').id,
            c.req.valid('json'),
            hoyEnZona(),
          ),
          201,
        ),
    )

    .delete('/precios/:id', zValidator('param', idParamSchema), (c) => {
      servicio.quitarPrecio(c.req.valid('param').id, hoyEnZona());
      return c.body(null, 204);
    });
}
