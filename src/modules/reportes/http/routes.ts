/**
 * CAPA HTTP — rutas de reportes. Solo lectura.
 *
 * SOLO PARA EL DUEÑO (rol admin). Cuando exista el login, la restricción se
 * aplica donde se montan estas rutas (src/server/index.ts).
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { hoyEnZona } from '@/lib/fechas';
import type { ServicioReportes } from '../application/reportes.service';
import { reporteQuerySchema } from './schemas';

export function rutasReportes(servicio: ServicioReportes) {
  return new Hono().get('/', zValidator('query', reporteQuerySchema), (c) =>
    c.json(servicio.resumen(c.req.valid('query'), hoyEnZona())),
  );
}
