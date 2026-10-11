/**
 * CAPA INFRASTRUCTURE — el SQL de visitas.
 */

import { and, desc, eq, gte, lte } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { clientes, visitas } from '@/lib/db/schema';

export type VisitaFila = typeof visitas.$inferSelect;

export function crearRepoVisitas(db: DB) {
  return {
    insertar(datos: typeof visitas.$inferInsert): VisitaFila {
      return db.insert(visitas).values(datos).returning().get();
    },

    /** Las visitas de un rango, lo más nuevo primero, con quién las invitó. */
    enRango(desde: string, hasta: string) {
      return db
        .select({
          id: visitas.id,
          nombre: visitas.nombre,
          telefono: visitas.telefono,
          fecha: visitas.fecha,
          motivo: visitas.motivo,
          nota: visitas.nota,
          invitadoPorClienteId: visitas.invitadoPorClienteId,
          anfitrionNombre: clientes.nombre,
          anfitrionApellido: clientes.apellido,
          anfitrionNroSocio: clientes.nroSocio,
        })
        .from(visitas)
        .leftJoin(clientes, eq(clientes.id, visitas.invitadoPorClienteId))
        .where(and(gte(visitas.fecha, desde), lte(visitas.fecha, hasta)))
        .orderBy(desc(visitas.fecha), desc(visitas.id))
        .all();
    },
  };
}

export type RepoVisitas = ReturnType<typeof crearRepoVisitas>;
