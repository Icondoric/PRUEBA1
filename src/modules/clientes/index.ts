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
import { crearServicioClientes } from './application/clientes.service';
import { crearRepoClientes } from './infrastructure/clientes.repo';
import { type DepsDeClientes, rutasClientes } from './http/routes';

/**
 * @param deps lo que las rutas necesitan saber del pedido. Sin esto (un
 *   script, un test de servicio) nadie ve a los dados de baja.
 */
export function moduloClientes(
  db: DB,
  deps: DepsDeClientes = { puedeVerBajas: () => false },
) {
  const servicio = crearServicioClientes(crearRepoClientes(db));
  return { servicio, rutas: rutasClientes(servicio, deps) };
}

export type { ClienteVista, ServicioClientes } from './application/clientes.service';
export type { TipoCliente } from './domain/cliente';
export { EXTENSIONES, nombreCompleto, normalizarIdentificador } from './domain/cliente';
export {
  bloqueoInputSchema,
  clienteInputSchema,
  listarQuerySchema,
} from './http/schemas';
