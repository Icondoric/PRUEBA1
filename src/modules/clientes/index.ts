/**
 * API PÚBLICA del módulo clientes.
 *
 * Los demás módulos importan SOLO desde acá: `@/modules/clientes`.
 * Nunca `@/modules/clientes/infrastructure/clientes.repo`.
 *
 * Es la regla que sostiene la arquitectura cuando el proyecto crezca, y la
 * verifica el linter de límites en el pre-commit: si alguien importa un
 * internals, el commit falla. No depende de que nos acordemos.
 */

import type { DB } from '@/lib/db';
import { NoAutenticadoError } from '@/lib/errors';
import { crearServicioClientes } from './application/clientes.service';
import { crearRepoClientes } from './infrastructure/clientes.repo';
import { type DepsDeClientes, rutasClientes } from './http/routes';

/** Sin servidor (un script, un test de servicio) no hay sesión: nadie puede nada. */
const SIN_SESION: DepsDeClientes = {
  puedeVerBajas: () => false,
  operadorActual: () => {
    throw new NoAutenticadoError();
  },
  ahora: () => new Date(),
};

/**
 * @param deps lo que las rutas necesitan saber del pedido: quién es y qué
 *   puede. Los scripts usan solo el servicio y no lo pasan.
 */
export function moduloClientes(db: DB, deps: DepsDeClientes = SIN_SESION) {
  const servicio = crearServicioClientes(crearRepoClientes(db), {
    diasDeAviso: deps.diasDeAviso,
  });
  return { servicio, rutas: rutasClientes(servicio, deps) };
}

export type {
  ClienteVista,
  DatosDeCliente,
  ServicioClientes,
} from './application/clientes.service';
export type { TipoCliente } from './domain/cliente';
export { EXTENSIONES, nombreCompleto, normalizarIdentificador } from './domain/cliente';
export {
  bloqueoInputSchema,
  clienteInputSchema,
  listarQuerySchema,
} from './http/schemas';
