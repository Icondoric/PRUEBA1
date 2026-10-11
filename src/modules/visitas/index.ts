/**
 * API PÚBLICA del módulo visitas.
 *
 * Los demás módulos importan SOLO desde acá: `@/modules/visitas`.
 */

import type { DB } from '@/lib/db';
import type { ServicioClientes } from '@/modules/clientes';
import { crearServicioVisitas } from './application/visitas.service';
import { rutasVisitas } from './http/routes';
import { crearRepoVisitas } from './infrastructure/visitas.repo';

export function moduloVisitas(
  db: DB,
  deps: {
    clientes: Pick<ServicioClientes, 'buscarPorIdentificador'>;
    /** id del usuario que opera; queda en registrado_por. */
    operadorActual: () => number;
  },
) {
  const servicio = crearServicioVisitas(crearRepoVisitas(db), deps.clientes);
  return { servicio, rutas: rutasVisitas(servicio, deps.operadorActual) };
}

export type {
  ListaDeVisitas,
  ServicioVisitas,
  VisitaRegistrada,
} from './application/visitas.service';
export type { MotivoVisita } from './domain/visita';
export { MOTIVOS_VISITA, prepararVisita } from './domain/visita';
export { visitaInputSchema } from './http/schemas';
