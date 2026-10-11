/**
 * QUIÉN PUEDE LLAMAR A CADA RUTA DE LA API. Una sola tabla, para leerla de
 * corrido.
 *
 *   'publico'  sin sesión (solo entrar, salir y el chequeo de salud)
 *   'sesion'   cualquiera que haya entrado
 *   'dueno'    solo el dueño; no se delega
 *   [accesos]  quien tenga AL MENOS UNO de esos accesos (el dueño, siempre)
 *
 * Gana la primera regla que coincide. **Una ruta que no está en la tabla queda
 * cerrada para todos**: si agregás un endpoint y te olvidás de anotarlo acá,
 * falla cerrado en vez de quedar abierto. Hay un test que revisa que todas las
 * rutas registradas tengan su regla.
 *
 * Los accesos se definen en `src/modules/usuarios/domain/permisos.ts`.
 */

import type { Permiso } from '@/modules/usuarios';

export type Acceso = 'publico' | 'sesion' | 'dueno' | readonly Permiso[];

type Metodo = 'GET' | 'POST' | 'PUT' | 'DELETE' | '*';

const REGLAS: ReadonlyArray<readonly [Metodo, RegExp, Acceso]> = [
  ['GET', /^\/api\/salud$/, 'publico'],

  // sesión
  ['POST', /^\/api\/sesion$/, 'publico'], // entrar
  ['DELETE', /^\/api\/sesion$/, 'publico'], // salir: tiene que andar aunque ya haya vencido
  ['GET', /^\/api\/sesion$/, 'sesion'], // quién soy

  // usuarios y accesos
  ['*', /^\/api\/usuarios(\/.*)?$/, 'dueno'],

  // clientes: los ve quien los necesita para vender, cobrar o dejar pasar
  ['GET', /^\/api\/clientes(\/.*)?$/, ['clientes.gestionar', 'membresias.vender', 'checkin.pases', 'pagos.caja_hoy']],
  ['POST', /^\/api\/clientes$/, ['clientes.gestionar']],
  ['PUT', /^\/api\/clientes\/\d+$/, ['clientes.gestionar']],
  ['DELETE', /^\/api\/clientes\/\d+$/, ['clientes.baja']],

  // planes y membresías
  ['GET', /^\/api\/planes$/, ['membresias.vender', 'planes.gestionar', 'checkin.pases']],
  ['GET', /^\/api\/membresias$/, ['clientes.gestionar', 'membresias.vender']],
  ['GET', /^\/api\/membresias\/cotizacion$/, ['membresias.vender']],
  ['POST', /^\/api\/membresias$/, ['membresias.vender']],

  // mostrador
  ['POST', /^\/api\/checkin$/, ['checkin.usar']],
  ['*', /^\/api\/checkin\/pase$/, ['checkin.pases']],

  // pagos. Ver otras fechas se controla además adentro (pagos.service).
  ['GET', /^\/api\/pagos$/, ['pagos.caja_hoy', 'pagos.otras_fechas']],
  ['GET', /^\/api\/pagos\/de-cliente$/, ['clientes.gestionar', 'pagos.caja_hoy']],
  ['POST', /^\/api\/pagos\/\d+\/anulacion$/, ['pagos.anular']],

  ['*', /^\/api\/visitas$/, ['visitas.gestionar']],

  ['GET', /^\/api\/reportes$/, ['reportes.ver']],
]; // prettier-ignore

/** La regla de una ruta, o `undefined` si nadie la anotó (queda cerrada). */
export function reglaPara(metodo: string, ruta: string): Acceso | undefined {
  return REGLAS.find(
    ([m, patron]) => (m === '*' || m === metodo) && patron.test(ruta),
  )?.[2];
}
