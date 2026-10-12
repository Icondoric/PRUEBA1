/**
 * CAPA INFRASTRUCTURE — el SQL para administrar planes y precios.
 *
 * `quitarPrecio` es el único lugar donde se borra un dato del negocio, y el
 * dominio lo permite solo para un precio que todavía no empezó a regir y que
 * nadie usó: deshacer un error de carga, no reescribir lo que ya pasó.
 */

import { asc, count, desc, eq, max } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { membresias, planPrecios, planes } from '@/lib/db/schema';

export type PlanFila = typeof planes.$inferSelect;
export type PrecioFila = typeof planPrecios.$inferSelect;

export function crearRepoPlanes(db: DB) {
  return {
    /** Todos, también los dados de baja. */
    planes(): PlanFila[] {
      return db.select().from(planes).orderBy(asc(planes.orden), asc(planes.id)).all();
    },

    planPorId(id: number): PlanFila | undefined {
      return db.select().from(planes).where(eq(planes.id, id)).get();
    },

    precios(): PrecioFila[] {
      return db
        .select()
        .from(planPrecios)
        .orderBy(desc(planPrecios.vigenteDesde), desc(planPrecios.id))
        .all();
    },

    preciosDePlan(planId: number): PrecioFila[] {
      return db.select().from(planPrecios).where(eq(planPrecios.planId, planId)).all();
    },

    precioPorId(id: number): PrecioFila | undefined {
      return db.select().from(planPrecios).where(eq(planPrecios.id, id)).get();
    },

    /** Los ids de los precios con los que ya se vendió algo. */
    preciosUsados(): Set<number> {
      const filas = db
        .select({ id: membresias.planPrecioId, ventas: count() })
        .from(membresias)
        .groupBy(membresias.planPrecioId)
        .all();
      return new Set(filas.flatMap((f) => (f.id === null ? [] : [f.id])));
    },

    /** Crea el plan y su primer precio, o ninguno de los dos. */
    insertarPlanConPrecio(
      plan: { nombre: string; diasDuracion: number; esPaseDiario: boolean },
      precio: Omit<typeof planPrecios.$inferInsert, 'planId'>,
    ): PlanFila {
      return db.transaction((tx) => {
        const ultimo = tx
          .select({ orden: max(planes.orden) })
          .from(planes)
          .get();
        const creado = tx
          .insert(planes)
          .values({ ...plan, orden: (ultimo?.orden ?? -1) + 1 })
          .returning()
          .get();
        tx.insert(planPrecios)
          .values({ ...precio, planId: creado.id })
          .run();
        return creado;
      });
    },

    actualizarPlan(
      id: number,
      cambios: Partial<Pick<PlanFila, 'nombre' | 'activo'>>,
    ): PlanFila | undefined {
      return db.update(planes).set(cambios).where(eq(planes.id, id)).returning().get();
    },

    insertarPrecio(datos: typeof planPrecios.$inferInsert): PrecioFila {
      return db.insert(planPrecios).values(datos).returning().get();
    },

    quitarPrecio(id: number): void {
      db.delete(planPrecios).where(eq(planPrecios.id, id)).run();
    },
  };
}

export type RepoPlanes = ReturnType<typeof crearRepoPlanes>;
