/**
 * CAPA INFRASTRUCTURE — el SQL del check-in.
 *
 * Dos consultas por ingreso, las dos por índice (`membresias_cliente_fin_idx`
 * e inserción en `ingresos`). Es lo que tiene que responder en menos de 100ms.
 */

import { and, eq, ne } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { ingresos, membresias, planes } from '@/lib/db/schema';

export type IngresoFila = typeof ingresos.$inferSelect;

export function crearRepoCheckin(db: DB) {
  return {
    /** Las membresías que cuentan: todas menos las canceladas. */
    membresiasDe(clienteId: number) {
      return db
        .select({
          id: membresias.id,
          fechaInicio: membresias.fechaInicio,
          fechaFin: membresias.fechaFin,
          esPaseDiario: planes.esPaseDiario,
        })
        .from(membresias)
        .innerJoin(planes, eq(planes.id, membresias.planId))
        .where(
          and(eq(membresias.clienteId, clienteId), ne(membresias.estado, 'cancelada')),
        )
        .all();
    },

    registrarIngreso(datos: {
      clienteId: number;
      membresiaId: number | null;
      fecha: string;
      resultado: IngresoFila['resultado'];
    }): IngresoFila {
      return db.insert(ingresos).values(datos).returning().get();
    },
  };
}

export type RepoCheckin = ReturnType<typeof crearRepoCheckin>;
