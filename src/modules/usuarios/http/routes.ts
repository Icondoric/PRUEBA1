/**
 * CAPA HTTP — rutas de sesión y de administración de usuarios.
 *
 * Quién puede llamar a cada una no se decide acá: lo decide la tabla de
 * `src/server/acceso.ts`, que corre antes. Estas rutas ya reciben a alguien
 * autorizado.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { zValidator } from '@hono/zod-validator';
import type { ServicioUsuarios, UsuarioSesion } from '../application/usuarios.service';
import {
  idParamSchema,
  loginInputSchema,
  miPasswordSchema,
  passwordInputSchema,
  usuarioCambiosSchema,
  usuarioNuevoSchema,
} from './schemas';

export const COOKIE_SESION = 'gym_sesion';

/**
 * La cookie dura un mes en el navegador, pero quien manda es el servidor: la
 * sesión vence por inactividad (ver `sesionVigente`).
 */
const SEGUNDOS_DE_COOKIE = 60 * 60 * 24 * 30;

export interface DepsDeRutas {
  /** El usuario de este pedido; lo dejó puesto el guardia del servidor. */
  usuarioActual: (c: Context) => UsuarioSesion;
  /** La hora real. Inyectable para los tests. */
  ahora: () => Date;
}

export function rutasSesion(servicio: ServicioUsuarios, deps: DepsDeRutas) {
  return new Hono()
    .post('/', zValidator('json', loginInputSchema), (c) => {
      const { token, usuario } = servicio.iniciarSesion(
        c.req.valid('json'),
        deps.ahora(),
      );

      setCookie(c, COOKIE_SESION, token, {
        // El JavaScript de la página no puede leerla.
        httpOnly: true,
        // No viaja en pedidos que vengan de otro sitio.
        sameSite: 'Strict',
        path: '/',
        maxAge: SEGUNDOS_DE_COOKIE,
      });
      return c.json({ usuario });
    })

    .get('/', (c) => c.json({ usuario: deps.usuarioActual(c) }))

    .put('/password', zValidator('json', miPasswordSchema), (c) => {
      servicio.cambiarMiPassword(deps.usuarioActual(c).id, c.req.valid('json'));
      // Se cerraron todas sus sesiones, también esta.
      deleteCookie(c, COOKIE_SESION, { path: '/' });
      return c.body(null, 204);
    })

    .delete('/', (c) => {
      servicio.cerrarSesion(getCookie(c, COOKIE_SESION));
      deleteCookie(c, COOKIE_SESION, { path: '/' });
      return c.body(null, 204);
    });
}

/** Solo el dueño. */
export function rutasUsuarios(servicio: ServicioUsuarios, deps: DepsDeRutas) {
  return new Hono()
    .get('/', (c) => c.json({ usuarios: servicio.listar(), ...servicio.catalogo() }))

    .get('/:id', zValidator('param', idParamSchema), (c) =>
      c.json(servicio.obtener(c.req.valid('param').id)),
    )

    .post('/', zValidator('json', usuarioNuevoSchema), (c) =>
      c.json(servicio.crear(c.req.valid('json'), deps.usuarioActual(c).id), 201),
    )

    .put(
      '/:id',
      zValidator('param', idParamSchema),
      zValidator('json', usuarioCambiosSchema),
      (c) =>
        c.json(
          servicio.actualizar(
            c.req.valid('param').id,
            c.req.valid('json'),
            deps.usuarioActual(c).id,
          ),
        ),
    )

    .put(
      '/:id/password',
      zValidator('param', idParamSchema),
      zValidator('json', passwordInputSchema),
      (c) => {
        servicio.cambiarPassword(c.req.valid('param').id, c.req.valid('json').password);
        return c.body(null, 204);
      },
    );
}
