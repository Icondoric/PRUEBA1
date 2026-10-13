/**
 * Las defensas que no dependen de quién sos: corren antes que el guardia, para
 * todo pedido a la API.
 *
 *   cabecerasDeApi    le dicen al navegador que no adivine tipos, que no meta
 *                     el sistema dentro de otra página y que no guarde copias
 *   mismoOrigen       un pedido que cambia algo tiene que venir del propio
 *                     sistema, no de otra página abierta en el mismo navegador
 *   limiteDeCuerpo    nadie manda megas a un sistema que recibe formularios
 *   frenoDeIngreso    tantos intentos de ingreso por minuto desde un mismo
 *                     equipo, sea cual sea el usuario que prueben
 *
 * Todo con lo que trae Hono. Ninguna reemplaza al guardia: lo acompañan.
 */

import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context, MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import {
  DemasiadoGrandeError,
  DemasiadosIntentosError,
  SinPermisoError,
} from '@/lib/errors';

/** Lo más grande que manda el sistema es un formulario: 100 KB sobran. */
export const BYTES_MAXIMOS_POR_PEDIDO = 100 * 1024;

export const INGRESOS_POR_MINUTO = 20;
const MILISEGUNDOS_DE_VENTANA = 60_000;
/** Tope de equipos recordados, para que la cuenta no crezca sin límite. */
const EQUIPOS_RECORDADOS = 2_000;

const opcionesComunes = {
  xFrameOptions: 'DENY',
  referrerPolicy: 'no-referrer',
  // El sistema corre por HTTP (localhost o Tailscale). Prometer HTTPS acá
  // dejaría afuera al navegador si algún día se entra por las dos vías.
  strictTransportSecurity: false,
} as const;

export function cabecerasDeApi(): MiddlewareHandler {
  const comunes = secureHeaders(opcionesComunes);
  return async (c, next) => {
    await comunes(c, next);
    // Datos de clientes y pagos: que no queden guardados en la PC compartida
    // ni reaparezcan con "atrás" después de cerrar sesión.
    c.header('Cache-Control', 'no-store');
  };
}

/**
 * Para las páginas (la versión instalada). Solo se carga código propio: un
 * texto que alguien logre colar no puede traer ni ejecutar nada de afuera.
 * Los estilos en línea se permiten porque los componentes los usan para
 * posicionar menús; no ejecutan código.
 */
export function cabecerasDePagina(): MiddlewareHandler {
  return secureHeaders({
    ...opcionesComunes,
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  });
}

/**
 * Una línea por pedido: método, ruta, resultado y cuánto tardó.
 *
 * Sin lo que viene después del `?` ni el identificador de una búsqueda: ahí
 * viajan nombres y números de CI, y un registro no es lugar para guardarlos.
 */
export function registroDePedidos(): MiddlewareHandler {
  return async (c, next) => {
    const inicio = performance.now();
    await next();
    const ruta = c.req.path.replace(/(\/buscar\/).+$/, '$1…');
    const ms = Math.round(performance.now() - inicio);
    process.stdout.write(`${c.req.method} ${ruta} ${c.res.status} ${ms}ms\n`);
  };
}

const METODOS_QUE_NO_CAMBIAN_NADA = new Set(['GET', 'HEAD', 'OPTIONS']);

function hostDe(origen: string): string | null {
  try {
    return new URL(origen).host;
  } catch {
    // "null" (página en un sandbox, archivo local) u otra cosa que no es una URL.
    return null;
  }
}

/**
 * La cookie de sesión ya no viaja en pedidos desde otro sitio (SameSite), pero
 * para el navegador "el mismo sitio" incluye cualquier otro programa que sirva
 * páginas en esta PC, en otro puerto. Esto cierra ese hueco: si el navegador
 * dice de dónde vino el pedido y no es de acá, no pasa.
 *
 * Un pedido sin `Origin` (el comando de respaldo, un script del dueño) pasa:
 * no viene de un navegador, y sin cookie igual lo frena el guardia.
 */
export function mismoOrigen(): MiddlewareHandler {
  return async (c, next) => {
    if (!METODOS_QUE_NO_CAMBIAN_NADA.has(c.req.method)) {
      const origen = c.req.header('origin');
      const propios = [
        c.req.header('host'),
        c.req.header('x-forwarded-host'),
        new URL(c.req.url).host,
      ];
      const esAjeno =
        c.req.header('sec-fetch-site') === 'cross-site' ||
        (origen !== undefined && !propios.includes(hostDe(origen) ?? ''));

      if (esAjeno) throw new SinPermisoError('Ese pedido no salió de este sistema');
    }
    await next();
  };
}

export function limiteDeCuerpo(): MiddlewareHandler {
  return bodyLimit({
    maxSize: BYTES_MAXIMOS_POR_PEDIDO,
    onError: () => {
      throw new DemasiadoGrandeError();
    },
  });
}

/** La dirección de red de quien hace el pedido. */
export function equipoDe(c: Context): string {
  try {
    return getConnInfo(c).remote.address ?? 'desconocido';
  } catch {
    // Sin conexión real detrás (los tests): todos cuentan como un mismo equipo.
    return 'desconocido';
  }
}

/**
 * El bloqueo por usuario (5 fallos, un minuto) no frena a quien prueba una
 * contraseña común contra muchos usuarios distintos. Esto sí: cuenta los
 * intentos por equipo, acierten o no.
 *
 * En memoria, como el bloqueo por usuario: un solo proceso en una sola PC.
 */
export function frenoDeIngreso(ahora: () => Date): MiddlewareHandler {
  const intentos = new Map<string, { desde: number; cantidad: number }>();

  return async (c, next) => {
    if (c.req.method !== 'POST') return next();

    const momento = ahora().getTime();
    const equipo = equipoDe(c);
    const previo = intentos.get(equipo);
    const enVentana =
      previo !== undefined && momento - previo.desde < MILISEGUNDOS_DE_VENTANA;
    const cuenta = enVentana
      ? { desde: previo.desde, cantidad: previo.cantidad + 1 }
      : { desde: momento, cantidad: 1 };

    if (!previo && intentos.size >= EQUIPOS_RECORDADOS) {
      for (const [clave, valor] of intentos) {
        if (momento - valor.desde >= MILISEGUNDOS_DE_VENTANA) intentos.delete(clave);
      }
      // Si siguen siendo demasiados, se olvida al más viejo.
      const masViejo = intentos.keys().next().value;
      if (intentos.size >= EQUIPOS_RECORDADOS && masViejo !== undefined) {
        intentos.delete(masViejo);
      }
    }
    intentos.set(equipo, cuenta);

    if (cuenta.cantidad > INGRESOS_POR_MINUTO) {
      const espera = Math.ceil((cuenta.desde + MILISEGUNDOS_DE_VENTANA - momento) / 1000);
      throw new DemasiadosIntentosError(
        `Demasiados intentos de ingreso desde este equipo. Esperá ${espera} segundos.`,
      );
    }
    await next();
  };
}
