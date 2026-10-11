/**
 * CAPA INFRASTRUCTURE — las consultas de los reportes. Solo lectura.
 *
 * Trae filas simples y deja las cuentas para el dominio. Con ~150 socios son
 * unos cientos de filas: sobra, y las reglas quedan testeables sin base.
 * SQL estándar a propósito, para que valga igual el día que se migre.
 */

import { and, count, eq, gte, lte, ne } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { clientes, ingresos, membresias, pagos, planes } from '@/lib/db/schema';

export function crearRepoReportes(db: DB) {
  return {
    /** Todas las membresías que cuentan (no canceladas) de clientes activos. */
    membresias() {
      return db
        .select({
          id: membresias.id,
          clienteId: membresias.clienteId,
          nroSocio: clientes.nroSocio,
          nombre: clientes.nombre,
          apellido: clientes.apellido,
          telefono: clientes.telefono,
          fechaInicio: membresias.fechaInicio,
          fechaFin: membresias.fechaFin,
          esPaseDiario: planes.esPaseDiario,
          planNombre: planes.nombre,
        })
        .from(membresias)
        .innerJoin(planes, eq(planes.id, membresias.planId))
        .innerJoin(clientes, eq(clientes.id, membresias.clienteId))
        .where(and(ne(membresias.estado, 'cancelada'), eq(clientes.activo, true)))
        .all();
    },

    pagosDesde(desde: string) {
      return db
        .select({
          fechaPago: pagos.fechaPago,
          metodo: pagos.metodo,
          montoCentavos: pagos.montoCentavos,
          anulado: pagos.anulado,
        })
        .from(pagos)
        .where(gte(pagos.fechaPago, desde))
        .all();
    },

    /** Cuántos ingresos hubo por día y por resultado. */
    ingresosEntre(desde: string, hasta: string) {
      return db
        .select({
          fecha: ingresos.fecha,
          resultado: ingresos.resultado,
          cantidad: count(),
        })
        .from(ingresos)
        .where(and(gte(ingresos.fecha, desde), lte(ingresos.fecha, hasta)))
        .groupBy(ingresos.fecha, ingresos.resultado)
        .all();
    },
  };
}

export type RepoReportes = ReturnType<typeof crearRepoReportes>;
