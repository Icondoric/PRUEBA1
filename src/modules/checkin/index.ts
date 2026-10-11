/**
 * API PÚBLICA del módulo checkin.
 *
 * Los demás módulos importan SOLO desde acá: `@/modules/checkin`.
 */

import type { Context } from 'hono';
import type { DB } from '@/lib/db';
import type { ServicioClientes } from '@/modules/clientes';
import type { ServicioMembresias } from '@/modules/membresias';
import { crearServicioCheckin } from './application/checkin.service';
import { rutasCheckin } from './http/routes';
import { crearRepoCheckin } from './infrastructure/checkin.repo';

export function moduloCheckin(
  db: DB,
  deps: {
    clientes: Pick<ServicioClientes, 'buscarPorIdentificador' | 'obtener' | 'registrar'>;
    membresias: Pick<ServicioMembresias, 'planesConPrecio' | 'vender'>;
    /** id del usuario que opera; queda como quien registró la venta del pase. */
    operadorActual: (c: Context) => number;
  },
) {
  const servicio = crearServicioCheckin(crearRepoCheckin(db), deps);
  return { servicio, rutas: rutasCheckin(servicio, deps.operadorActual) };
}

export type {
  PaseEnVenta,
  PaseVendido,
  ResultadoCheckin,
  ServicioCheckin,
} from './application/checkin.service';
export type { ResultadoAcceso, SocioParaAcceso, Veredicto } from './domain/acceso';
export { DIAS_AVISO_VENCIMIENTO, evaluarAcceso } from './domain/acceso';
export type { MembresiaParaAcceso, VigenciaParaAcceso } from './domain/vigencia';
export { vigenciaParaAcceso } from './domain/vigencia';
export { paseInputSchema } from './http/schemas';
