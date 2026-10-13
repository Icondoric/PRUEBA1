/**
 * CAPA INFRASTRUCTURE — todo el SQL de clientes vive acá y en ningún otro lado.
 *
 * Qué va y qué no:
 *   SÍ  — consultas, inserts, updates, mapeo de filas
 *   NO  — reglas de negocio, validación, códigos HTTP
 *
 * El tipo que infiere Drizzle del esquema ES el tipo del dominio. No hay
 * entidad espejo ni mapper: esa fue la decisión de "clean pragmática".
 */

import { and, count, desc, eq, like, max, or, sql } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { clientes, membresias, planes, usuarios } from '@/lib/db/schema';
import type { ClienteNormalizado } from '../domain/cliente';

export type ClienteFila = typeof clientes.$inferSelect;

export type FiltroDeMembresia = 'al_dia' | 'por_vencer' | 'vencida' | 'sin_membresia';

export interface FiltroBusqueda {
  /** Cómo está su membresía. Necesita `hoy` y `avisoHasta`; sin ellos no filtra. */
  membresia?: FiltroDeMembresia;
  hoy?: string;
  /** Último día que todavía cuenta como "por vencer". */
  avisoHasta?: string;
  texto?: string;
  /** 'socio' | 'eventual' | undefined (todos) */
  tipo?: 'socio' | 'eventual';
  /** true = solo los dados de baja. Por defecto, solo los activos. */
  deBaja?: boolean;
  pagina: number;
  porPagina: number;
}

export function crearRepoClientes(db: DB) {
  return {
    porId(id: number): ClienteFila | undefined {
      return db.select().from(clientes).where(eq(clientes.id, id)).get();
    },

    /** Búsqueda del check-in: por nro de socio o CI ya normalizado. */
    porIdentificador(identificador: string): ClienteFila | undefined {
      const comoNumero = Number(identificador);
      return db
        .select()
        .from(clientes)
        .where(
          and(
            eq(clientes.activo, true),
            or(
              eq(clientes.ci, identificador),
              Number.isInteger(comoNumero) && comoNumero > 0
                ? eq(clientes.nroSocio, comoNumero)
                : undefined,
            ),
          ),
        )
        .get();
    },

    porCi(ci: string, extension: string): ClienteFila | undefined {
      return db
        .select()
        .from(clientes)
        .where(and(eq(clientes.ci, ci), eq(clientes.ciExtension, extension)))
        .get();
    },

    maximoNroSocio(): number | null {
      const fila = db
        .select({ max: max(clientes.nroSocio) })
        .from(clientes)
        .get();
      return fila?.max ?? null;
    },

    insertar(
      datos: ClienteNormalizado & {
        nroSocio: number;
        fechaRegistro: string;
        referidoPorClienteId?: number | null;
      },
    ): ClienteFila {
      return db.insert(clientes).values(datos).returning().get();
    },

    actualizar(
      id: number,
      cambios: Partial<ClienteNormalizado> & { referidoPorClienteId?: number | null },
    ): ClienteFila | undefined {
      return db
        .update(clientes)
        .set({ ...cambios, updatedAt: new Date() })
        .where(eq(clientes.id, id))
        .returning()
        .get();
    },

    bloquear(id: number, motivo: string, bloqueadoPor: number, bloqueadoEn: Date): void {
      db.update(clientes)
        .set({
          bloqueado: true,
          motivoBloqueo: motivo,
          bloqueadoPor,
          bloqueadoEn,
          updatedAt: new Date(),
        })
        .where(eq(clientes.id, id))
        .run();
    },

    desbloquear(id: number): void {
      db.update(clientes)
        .set({
          bloqueado: false,
          motivoBloqueo: null,
          bloqueadoPor: null,
          bloqueadoEn: null,
          updatedAt: new Date(),
        })
        .where(eq(clientes.id, id))
        .run();
    },

    /** El nombre de un usuario del sistema, para decir quién bloqueó. */
    nombreDeUsuario(id: number): string | null {
      return (
        db
          .select({ nombre: usuarios.nombre })
          .from(usuarios)
          .where(eq(usuarios.id, id))
          .get()?.nombre ?? null
      );
    },

    reactivar(id: number): void {
      db.update(clientes)
        .set({ activo: true, updatedAt: new Date() })
        .where(eq(clientes.id, id))
        .run();
    },

    /** Soft delete. Los clientes nunca se borran. */
    desactivar(id: number): void {
      db.update(clientes)
        .set({ activo: false, updatedAt: new Date() })
        .where(eq(clientes.id, id))
        .run();
    },

    /**
     * Listado con filtro por tipo DERIVADO, no guardado:
     * es socio quien tiene al menos una membresía de un plan que no es pase.
     */
    buscar(f: FiltroBusqueda): { filas: ClienteFila[]; total: number } {
      const tieneMensualidad = sql`EXISTS (
        SELECT 1 FROM ${membresias}
        JOIN ${planes} ON ${planes.id} = ${membresias.planId}
        WHERE ${membresias.clienteId} = ${clientes.id}
          AND ${planes.esPaseDiario} = 0
      )`;

      const condiciones = [eq(clientes.activo, !f.deBaja)];

      if (f.texto?.trim()) {
        const patron = `%${f.texto.trim()}%`;
        condiciones.push(
          or(
            like(clientes.nombre, patron),
            like(clientes.apellido, patron),
            like(clientes.ci, patron),
            sql`CAST(${clientes.nroSocio} AS TEXT) LIKE ${patron}`,
          )!,
        );
      }

      if (f.tipo === 'socio') condiciones.push(sql`${tieneMensualidad}`);
      if (f.tipo === 'eventual') condiciones.push(sql`NOT ${tieneMensualidad}`);

      // Situación de la membresía, DERIVADA de las fechas (nunca guardada). Las
      // fechas son texto AAAA-MM-DD: se comparan como texto.
      if (f.membresia && f.hoy && f.avisoHasta) {
        // Hasta cuándo tiene pago, sin contar lo cancelado.
        const pagoHasta = sql`(
          SELECT MAX(${membresias.fechaFin}) FROM ${membresias}
          WHERE ${membresias.clienteId} = ${clientes.id}
            AND ${membresias.estado} <> 'cancelada'
        )`;
        // Lo mismo, pero solo de planes: un pase por sesión no se "renueva".
        const planHasta = sql`(
          SELECT MAX(${membresias.fechaFin}) FROM ${membresias}
          JOIN ${planes} ON ${planes.id} = ${membresias.planId}
          WHERE ${membresias.clienteId} = ${clientes.id}
            AND ${membresias.estado} <> 'cancelada'
            AND ${planes.esPaseDiario} = 0
        )`;
        const porSituacion = {
          al_dia: sql`${pagoHasta} >= ${f.hoy}`,
          vencida: sql`${pagoHasta} < ${f.hoy}`,
          sin_membresia: sql`${pagoHasta} IS NULL`,
          por_vencer: sql`(${planHasta} >= ${f.hoy} AND ${planHasta} <= ${f.avisoHasta})`,
        };
        condiciones.push(porSituacion[f.membresia]);
      }

      const donde = and(...condiciones);

      const filas = db
        .select()
        .from(clientes)
        .where(donde)
        .orderBy(desc(clientes.id))
        .limit(f.porPagina)
        .offset((f.pagina - 1) * f.porPagina)
        .all();

      const total = db.select({ n: count() }).from(clientes).where(donde).get()?.n ?? 0;

      return { filas, total };
    },

    /** Para derivar socio/eventual de UN cliente. */
    membresiasResumen(clienteId: number): Array<{ esPaseDiario: boolean }> {
      return db
        .select({ esPaseDiario: planes.esPaseDiario })
        .from(membresias)
        .innerJoin(planes, eq(planes.id, membresias.planId))
        .where(eq(membresias.clienteId, clienteId))
        .all();
    },
  };
}

export type RepoClientes = ReturnType<typeof crearRepoClientes>;
