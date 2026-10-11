/**
 * CAPA INFRASTRUCTURE — el SQL de pagos: historial y anulación.
 *
 * Los pagos NACEN con la venta (módulo membresias). Acá se leen y se anulan.
 * No hay DELETE: nada se borra.
 */

import { and, desc, eq, gte, lte } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { clientes, membresias, pagos, planes } from '@/lib/db/schema';

export type PagoFila = typeof pagos.$inferSelect;

export interface FiltroPagos {
  desde: string;
  hasta: string;
  metodo?: PagoFila['metodo'];
  clienteId?: number;
}

export function crearRepoPagos(db: DB) {
  const columnas = {
    id: pagos.id,
    fechaPago: pagos.fechaPago,
    montoCentavos: pagos.montoCentavos,
    metodo: pagos.metodo,
    nota: pagos.nota,
    anulado: pagos.anulado,
    motivoAnulacion: pagos.motivoAnulacion,
    clienteId: pagos.clienteId,
    clienteNombre: clientes.nombre,
    clienteApellido: clientes.apellido,
    nroSocio: clientes.nroSocio,
    membresiaId: pagos.membresiaId,
    planNombre: planes.nombre,
    fechaInicio: membresias.fechaInicio,
    fechaFin: membresias.fechaFin,
  };

  const conDetalle = () =>
    db
      .select(columnas)
      .from(pagos)
      .innerJoin(clientes, eq(clientes.id, pagos.clienteId))
      .leftJoin(membresias, eq(membresias.id, pagos.membresiaId))
      .leftJoin(planes, eq(planes.id, membresias.planId));

  return {
    porId(id: number): PagoFila | undefined {
      return db.select().from(pagos).where(eq(pagos.id, id)).get();
    },

    /** Los pagos de un rango de fechas, lo más nuevo primero. */
    enRango(f: FiltroPagos) {
      return conDetalle()
        .where(
          and(
            gte(pagos.fechaPago, f.desde),
            lte(pagos.fechaPago, f.hasta),
            f.metodo ? eq(pagos.metodo, f.metodo) : undefined,
            f.clienteId ? eq(pagos.clienteId, f.clienteId) : undefined,
          ),
        )
        .orderBy(desc(pagos.fechaPago), desc(pagos.id))
        .all();
    },

    /** Todos los pagos de un cliente, sin límite de fechas. */
    deCliente(clienteId: number) {
      return conDetalle()
        .where(eq(pagos.clienteId, clienteId))
        .orderBy(desc(pagos.fechaPago), desc(pagos.id))
        .all();
    },

    /**
     * Anula el pago y cancela la membresía que pagaba, o ninguna de las dos.
     * Un pago anulado con su membresía dando acceso sería entrar gratis.
     */
    anular(id: number, motivo: string): PagoFila {
      return db.transaction((tx) => {
        const pago = tx
          .update(pagos)
          .set({ anulado: true, motivoAnulacion: motivo })
          .where(eq(pagos.id, id))
          .returning()
          .get();

        if (pago.membresiaId !== null) {
          tx.update(membresias)
            .set({ estado: 'cancelada' })
            .where(eq(membresias.id, pago.membresiaId))
            .run();
        }
        return pago;
      });
    },
  };
}

export type RepoPagos = ReturnType<typeof crearRepoPagos>;
