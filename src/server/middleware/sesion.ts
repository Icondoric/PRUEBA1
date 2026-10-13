/**
 * El guardia de la API: identifica a quien hace el pedido y decide si pasa.
 *
 * Corre antes que cualquier ruta. Las rutas no revisan accesos por su cuenta:
 * si un pedido llegó hasta ellas, ya está autorizado. (La única excepción es
 * un dato que depende del contenido del pedido, como "¿este rango de fechas
 * incluye otro día?"; eso se decide en el servicio correspondiente.)
 */

import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { NoAutenticadoError, SinPermisoError } from '@/lib/errors';
import {
  COOKIE_SESION,
  type ServicioUsuarios,
  type UsuarioSesion,
  esDueno,
  puedeAlguno,
} from '@/modules/usuarios';
import { reglaPara } from '../acceso';

export type Entorno = { Variables: { usuario: UsuarioSesion } };

export function guardia(
  usuarios: Pick<ServicioUsuarios, 'sesionDe'>,
  ahora: () => Date,
): MiddlewareHandler<Entorno> {
  return async (c, next) => {
    const regla = reglaPara(c.req.method, c.req.path);

    if (regla === 'publico') return next();

    const usuario = usuarios.sesionDe(getCookie(c, COOKIE_SESION), ahora());
    if (!usuario) throw new NoAutenticadoError();

    // Sin regla = cerrado. Ver src/server/acceso.ts.
    if (regla === undefined) throw new SinPermisoError();
    if (regla === 'dueno' && !esDueno(usuario)) {
      throw new SinPermisoError('Esto solo lo puede hacer el dueño');
    }
    if (typeof regla !== 'string' && !puedeAlguno(usuario, regla)) {
      throw new SinPermisoError('Tu usuario no tiene acceso a esta parte del sistema');
    }

    c.set('usuario', usuario);
    await next();
  };
}

/** El usuario de este pedido. Solo vale en rutas que pasaron por el guardia. */
export function usuarioDe(c: Context): UsuarioSesion {
  const usuario: UsuarioSesion | undefined = c.get('usuario');
  if (!usuario) throw new NoAutenticadoError();
  return usuario;
}
