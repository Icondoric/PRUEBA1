/**
 * CAPA HTTP — la ruta del check-in.
 *
 * Responde siempre 200 cuando pudo decidir, también si rechaza o si el número
 * no es de nadie: un rebote es un resultado del negocio, no un error.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { hoyEnZona } from '@/lib/fechas';
import type { ServicioCheckin } from '../application/checkin.service';
import { checkinInputSchema } from './schemas';

export function rutasCheckin(servicio: ServicioCheckin) {
  return new Hono().post('/', zValidator('json', checkinInputSchema), (c) =>
    c.json(servicio.registrar(c.req.valid('json').identificador, hoyEnZona())),
  );
}
