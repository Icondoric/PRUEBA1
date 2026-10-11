/**
 * CAPA HTTP — las rutas del mostrador.
 *
 * El check-in responde siempre 200 cuando pudo decidir, también si rechaza o
 * si el número no es de nadie: un rebote es un resultado del negocio, no un
 * error.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { hoyEnZona } from '@/lib/fechas';
import type { ServicioCheckin } from '../application/checkin.service';
import { checkinInputSchema, paseInputSchema } from './schemas';

/**
 * @param operadorActual el id de quien inició sesión; queda como quien lo registró.
 */
export function rutasCheckin(
  servicio: ServicioCheckin,
  operadorActual: (c: Context) => number,
) {
  return new Hono()
    .post('/', zValidator('json', checkinInputSchema), (c) =>
      c.json(servicio.registrar(c.req.valid('json').identificador, hoyEnZona())),
    )

    .get('/pase', (c) => c.json({ pase: servicio.pasePorSesion(hoyEnZona()) }))

    .post('/pase', zValidator('json', paseInputSchema), (c) =>
      c.json(
        servicio.venderPase(c.req.valid('json'), hoyEnZona(), operadorActual(c)),
        201,
      ),
    );
}
