/**
 * API PÚBLICA del módulo pagos.
 *
 * Los demás módulos importan SOLO desde acá: `@/modules/pagos`.
 */

import type { DB } from '@/lib/db';
import type { ServicioClientes } from '@/modules/clientes';
import { crearServicioPagos } from './application/pagos.service';
import { type DepsDePagos, rutasPagos } from './http/routes';
import { crearRepoPagos } from './infrastructure/pagos.repo';

export function moduloPagos(
  db: DB,
  deps: { clientes: Pick<ServicioClientes, 'obtener'> } & DepsDePagos,
) {
  const servicio = crearServicioPagos(crearRepoPagos(db), deps.clientes);
  return { servicio, rutas: rutasPagos(servicio, deps) };
}

export type {
  ListaDePagos,
  PagoVista,
  PagosDeCliente,
  ServicioPagos,
} from './application/pagos.service';
export type { Metodo, TotalPorMetodo } from './domain/pago';
export { METODOS, prepararAnulacion, totalesDeCaja } from './domain/pago';
export { anulacionInputSchema } from './http/schemas';
