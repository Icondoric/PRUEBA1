/**
 * Las secciones del menú y quién las ve.
 *
 * Una sola lista para el menú y para decidir a dónde va cada uno al entrar.
 * `permisos`: alcanza con tener uno. `soloDueno`: no se delega.
 */

import {
  Banknote,
  ChartColumn,
  ScanLine,
  Tags,
  Ticket,
  UserCog,
  Users,
} from '@lucide/vue';
import type { Component } from 'vue';
import type { UsuarioSesion } from '@/modules/usuarios';
import { type Permiso, esDueno, puedeAlguno } from '@/modules/usuarios/contrato';

export interface Seccion {
  ruta: string;
  etiqueta: string;
  icono: Component;
  permisos?: readonly Permiso[];
  soloDueno?: boolean;
}

export const SECCIONES: readonly Seccion[] = [
  {
    ruta: 'clientes',
    etiqueta: 'Clientes',
    icono: Users,
    permisos: ['clientes.gestionar', 'membresias.vender'],
  },
  {
    ruta: 'pagos',
    etiqueta: 'Pagos',
    icono: Banknote,
    permisos: ['pagos.caja_hoy', 'pagos.otras_fechas'],
  },
  {
    ruta: 'visitas',
    etiqueta: 'Visitas',
    icono: Ticket,
    permisos: ['visitas.gestionar'],
  },
  { ruta: 'checkin', etiqueta: 'Check-in', icono: ScanLine, permisos: ['checkin.usar'] },
  {
    ruta: 'reportes',
    etiqueta: 'Reportes',
    icono: ChartColumn,
    permisos: ['reportes.ver'],
  },
  { ruta: 'planes', etiqueta: 'Planes', icono: Tags, permisos: ['planes.gestionar'] },
  { ruta: 'usuarios', etiqueta: 'Usuarios', icono: UserCog, soloDueno: true },
];

/** ¿Este usuario puede entrar a algo que pide estos accesos? */
export function tieneAcceso(
  usuario: UsuarioSesion,
  requisito: { permisos?: readonly Permiso[]; soloDueno?: boolean },
): boolean {
  if (requisito.soloDueno) return esDueno(usuario);
  if (requisito.permisos) return puedeAlguno(usuario, requisito.permisos);
  return true;
}

export const seccionesDe = (usuario: UsuarioSesion) =>
  SECCIONES.filter((seccion) => tieneAcceso(usuario, seccion));
