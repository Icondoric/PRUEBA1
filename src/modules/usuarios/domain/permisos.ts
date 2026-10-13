/**
 * CAPA DOMAIN — el catálogo de accesos.
 *
 * ESTE ARCHIVO ES LA LISTA DE LO QUE SE PUEDE DAR O QUITAR. La pantalla de
 * usuarios dibuja sus casillas con esto, y el servidor decide con esto.
 *
 * Cómo funciona:
 *   - El dueño (rol `admin`) tiene TODO, siempre. No se le marca nada.
 *   - A los demás, el dueño les da accesos sueltos, agrupados por módulo.
 *   - `basico: true` = viene marcado al crear un usuario (lo de recepción).
 *   - Administrar usuarios y accesos NO está en el catálogo a propósito: es
 *     solo del dueño y no se delega.
 *
 * Para agregar una función nueva que no sea para todos: una línea acá, y la
 * regla correspondiente en `src/server/acceso.ts`.
 */

export const CATALOGO_DE_ACCESOS = [
  {
    modulo: 'Clientes',
    accesos: [
      { clave: 'clientes.gestionar', nombre: 'Ver, registrar y editar clientes', basico: true },
      { clave: 'clientes.bloquear', nombre: 'Bloquear y desbloquear clientes', basico: false },
      { clave: 'clientes.baja', nombre: 'Dar de baja y reactivar clientes', basico: false },
    ],
  },
  {
    modulo: 'Membresías',
    accesos: [
      { clave: 'membresias.vender', nombre: 'Vender y renovar membresías', basico: true },
    ],
  },
  {
    modulo: 'Check-in',
    accesos: [
      { clave: 'checkin.usar', nombre: 'Usar la pantalla de check-in', basico: true },
      { clave: 'checkin.pases', nombre: 'Vender pases por sesión', basico: true },
    ],
  },
  {
    modulo: 'Pagos',
    accesos: [
      { clave: 'pagos.caja_hoy', nombre: 'Ver lo cobrado hoy', basico: true },
      { clave: 'pagos.otras_fechas', nombre: 'Ver lo cobrado en otras fechas', basico: false },
      { clave: 'pagos.anular', nombre: 'Anular pagos', basico: false },
    ],
  },
  {
    modulo: 'Visitas',
    accesos: [
      { clave: 'visitas.gestionar', nombre: 'Registrar y ver visitas gratis', basico: true },
    ],
  },
  {
    modulo: 'Reportes',
    accesos: [{ clave: 'reportes.ver', nombre: 'Ver los reportes', basico: false }],
  },
  {
    modulo: 'Planes y precios',
    accesos: [
      { clave: 'planes.gestionar', nombre: 'Crear y cambiar planes, precios y promociones', basico: false },
    ],
  },
] as const; // prettier-ignore

export type Permiso = (typeof CATALOGO_DE_ACCESOS)[number]['accesos'][number]['clave'];

export const TODOS_LOS_PERMISOS: readonly Permiso[] = CATALOGO_DE_ACCESOS.flatMap((m) =>
  m.accesos.map((a) => a.clave),
);

/** Con lo que arranca un usuario nuevo: lo que necesita recepción. */
export const PERMISOS_BASICOS: readonly Permiso[] = CATALOGO_DE_ACCESOS.flatMap((m) =>
  m.accesos.filter((a) => a.basico).map((a) => a.clave),
);

export function esPermiso(valor: unknown): valor is Permiso {
  return TODOS_LOS_PERMISOS.some((p) => p === valor);
}

export type Rol = 'admin' | 'recepcion';

export interface ConAccesos {
  rol: Rol;
  permisos: readonly Permiso[];
}

export const esDueno = (usuario: Pick<ConAccesos, 'rol'>) => usuario.rol === 'admin';

/** ¿Puede? El dueño siempre; los demás, si se lo dieron. */
export function puede(usuario: ConAccesos, permiso: Permiso): boolean {
  return esDueno(usuario) || usuario.permisos.includes(permiso);
}

/** Con tener uno de la lista alcanza. */
export function puedeAlguno(usuario: ConAccesos, permisos: readonly Permiso[]): boolean {
  return permisos.some((p) => puede(usuario, p));
}

/** Lo que de verdad tiene: el dueño, todo; el resto, lo guardado que siga existiendo. */
export function permisosEfectivos(rol: Rol, guardados: readonly string[]): Permiso[] {
  if (rol === 'admin') return [...TODOS_LOS_PERMISOS];
  return TODOS_LOS_PERMISOS.filter((p) => guardados.includes(p));
}
