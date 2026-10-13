/**
 * API PÚBLICA del módulo usuarios: quién usa el sistema y qué puede hacer.
 *
 * Los demás módulos importan SOLO desde acá: `@/modules/usuarios`.
 */

import type { DB } from '@/lib/db';
import { crearServicioUsuarios } from './application/usuarios.service';
import { type DepsDeRutas, rutasSesion, rutasUsuarios } from './http/routes';
import { crearRepoUsuarios } from './infrastructure/usuarios.repo';

export function moduloUsuarios(db: DB, config: { horasDeSesion: number }) {
  const servicio = crearServicioUsuarios(crearRepoUsuarios(db), config);
  return {
    servicio,
    /** Las rutas se arman aparte porque necesitan al guardia del servidor. */
    rutas: (deps: DepsDeRutas) => ({
      sesion: rutasSesion(servicio, deps),
      usuarios: rutasUsuarios(servicio, deps),
    }),
  };
}

export { hashInutilizable } from './application/password';
export type {
  CatalogoDeAccesos,
  ServicioUsuarios,
  UsuarioSesion,
  UsuarioVista,
} from './application/usuarios.service';
export type { Permiso, Rol } from './domain/permisos';
export {
  CATALOGO_DE_ACCESOS,
  PERMISOS_BASICOS,
  TODOS_LOS_PERMISOS,
  esDueno,
  esPermiso,
  puede,
  puedeAlguno,
} from './domain/permisos';
export { COOKIE_SESION } from './http/routes';
export {
  loginInputSchema,
  passwordInputSchema,
  usuarioNuevoSchema,
} from './http/schemas';
