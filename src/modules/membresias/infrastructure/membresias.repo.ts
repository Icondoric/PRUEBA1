/**
 * CAPA INFRASTRUCTURE — todo el SQL de membresías, planes y precios.
 *
 * Qué va y qué no:
 *   SÍ  — consultas, inserts, la transacción de la venta
 *   NO  — desde cuándo corre una membresía, cuánto cuesta, si está vencida
 *
 * No hay ningún UPDATE de membresías acá, y es a propósito: renovar inserta
 * una fila nueva. El historial es el producto.
 */

import { and, asc, desc, eq, ne } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { membresias, pagos, planPrecios, planes } from '@/lib/db/schema';

export type PlanFila = typeof planes.$inferSelect;
export type PrecioFila = typeof planPrecios.$inferSelect;
export type MembresiaFila = typeof membresias.$inferSelect;
export type PagoFila = typeof pagos.$inferSelect;

export interface NuevaVenta {
  clienteId: number;
  planId: number;
  fechaInicio: string;
  fechaFin: string;
  precioCentavos: number;
  planPrecioId: number;
  fechaPago: string;
  metodo: PagoFila['metodo'];
  nota: string | null;
  /** Quién la registró. Va a `creado_por` y a `registrado_por`. */
  usuarioId: number;
}

export function crearRepoMembresias(db: DB) {
  return {
    planesActivos(): PlanFila[] {
      return db
        .select()
        .from(planes)
        .where(eq(planes.activo, true))
        .orderBy(asc(planes.orden), asc(planes.id))
        .all();
    },

    planPorId(id: number): PlanFila | undefined {
      return db.select().from(planes).where(eq(planes.id, id)).get();
    },

    /** Todas las filas de precio; cuál está vigente lo decide el dominio. */
    precios(): PrecioFila[] {
      return db.select().from(planPrecios).all();
    },

    preciosDePlan(planId: number): PrecioFila[] {
      return db.select().from(planPrecios).where(eq(planPrecios.planId, planId)).all();
    },

    /** La que vence más tarde entre las no canceladas: la misma del check-in. */
    ultimaNoCancelada(clienteId: number): MembresiaFila | undefined {
      return db
        .select()
        .from(membresias)
        .where(
          and(eq(membresias.clienteId, clienteId), ne(membresias.estado, 'cancelada')),
        )
        .orderBy(desc(membresias.fechaFin), desc(membresias.id))
        .limit(1)
        .get();
    },

    deCliente(clienteId: number) {
      return db
        .select({
          id: membresias.id,
          planId: membresias.planId,
          planNombre: planes.nombre,
          esPaseDiario: planes.esPaseDiario,
          fechaInicio: membresias.fechaInicio,
          fechaFin: membresias.fechaFin,
          estado: membresias.estado,
          precioCentavos: membresias.precioCentavos,
          etiquetaPrecio: planPrecios.etiqueta,
        })
        .from(membresias)
        .innerJoin(planes, eq(planes.id, membresias.planId))
        .leftJoin(planPrecios, eq(planPrecios.id, membresias.planPrecioId))
        .where(eq(membresias.clienteId, clienteId))
        .orderBy(desc(membresias.fechaInicio), desc(membresias.id))
        .all();
    },

    /**
     * La venta: membresía + pago, o ninguna de las dos. Una membresía sin pago
     * (o al revés) rompe la única frontera del modelo: "pagó algo → membresía
     * + pago".
     */
    registrarVenta(venta: NuevaVenta): { membresia: MembresiaFila; pago: PagoFila } {
      return db.transaction((tx) => {
        const membresia = tx
          .insert(membresias)
          .values({
            clienteId: venta.clienteId,
            planId: venta.planId,
            fechaInicio: venta.fechaInicio,
            fechaFin: venta.fechaFin,
            precioCentavos: venta.precioCentavos,
            planPrecioId: venta.planPrecioId,
            creadoPor: venta.usuarioId,
          })
          .returning()
          .get();

        const pago = tx
          .insert(pagos)
          .values({
            clienteId: venta.clienteId,
            membresiaId: membresia.id,
            montoCentavos: venta.precioCentavos,
            fechaPago: venta.fechaPago,
            metodo: venta.metodo,
            nota: venta.nota,
            registradoPor: venta.usuarioId,
          })
          .returning()
          .get();

        return { membresia, pago };
      });
    },
  };
}

export type RepoMembresias = ReturnType<typeof crearRepoMembresias>;
