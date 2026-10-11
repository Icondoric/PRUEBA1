/**
 * API PÚBLICA del módulo checkin.
 *
 * Los demás módulos importan SOLO desde acá: `@/modules/checkin`.
 */

import type { DB } from '@/lib/db';
import type { ServicioClientes } from '@/modules/clientes';
import { crearServicioCheckin } from './application/checkin.service';
import { rutasCheckin } from './http/routes';
import { crearRepoCheckin } from './infrastructure/checkin.repo';

export function moduloCheckin(
  db: DB,
  deps: { clientes: Pick<ServicioClientes, 'buscarPorIdentificador'> },
) {
  const servicio = crearServicioCheckin(crearRepoCheckin(db), deps.clientes);
  return { servicio, rutas: rutasCheckin(servicio) };
}

export type { ResultadoCheckin, ServicioCheckin } from './application/checkin.service';
export type { ResultadoAcceso, SocioParaAcceso, Veredicto } from './domain/acceso';
export { DIAS_AVISO_VENCIMIENTO, evaluarAcceso } from './domain/acceso';
export type { MembresiaParaAcceso, VigenciaParaAcceso } from './domain/vigencia';
export { vigenciaParaAcceso } from './domain/vigencia';
