/**
 * CAPA INFRASTRUCTURE — SQL de usuarios, accesos y sesiones.
 *
 * Los usuarios no se borran (se desactivan): sus ventas y pagos siguen
 * apuntando a ellos. Las sesiones sí se borran: no son historia, son llaves.
 */

import { asc, eq, lt } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { sesiones, usuarioPermisos, usuarios } from '@/lib/db/schema';

export type UsuarioFila = typeof usuarios.$inferSelect;
export type SesionFila = typeof sesiones.$inferSelect;

export function crearRepoUsuarios(db: DB) {
  return {
    porId(id: number): UsuarioFila | undefined {
      return db.select().from(usuarios).where(eq(usuarios.id, id)).get();
    },

    porUsuario(usuario: string): UsuarioFila | undefined {
      return db.select().from(usuarios).where(eq(usuarios.usuario, usuario)).get();
    },

    listar(): UsuarioFila[] {
      return db.select().from(usuarios).orderBy(asc(usuarios.nombre)).all();
    },

    insertar(datos: typeof usuarios.$inferInsert): UsuarioFila {
      return db.insert(usuarios).values(datos).returning().get();
    },

    actualizar(
      id: number,
      cambios: Partial<Pick<UsuarioFila, 'nombre' | 'activo' | 'passwordHash' | 'rol'>>,
    ): UsuarioFila | undefined {
      return db
        .update(usuarios)
        .set(cambios)
        .where(eq(usuarios.id, id))
        .returning()
        .get();
    },

    // ── accesos ──

    permisosDe(usuarioId: number): string[] {
      return db
        .select({ permiso: usuarioPermisos.permiso })
        .from(usuarioPermisos)
        .where(eq(usuarioPermisos.usuarioId, usuarioId))
        .all()
        .map((fila) => fila.permiso);
    },

    todosLosPermisos(): Array<{ usuarioId: number; permiso: string }> {
      return db
        .select({
          usuarioId: usuarioPermisos.usuarioId,
          permiso: usuarioPermisos.permiso,
        })
        .from(usuarioPermisos)
        .all();
    },

    /** Deja al usuario exactamente con estos accesos. Todo o nada. */
    reemplazarPermisos(
      usuarioId: number,
      permisos: string[],
      otorgadoPor: number | null,
    ) {
      db.transaction((tx) => {
        tx.delete(usuarioPermisos).where(eq(usuarioPermisos.usuarioId, usuarioId)).run();
        if (permisos.length > 0) {
          tx.insert(usuarioPermisos)
            .values(permisos.map((permiso) => ({ usuarioId, permiso, otorgadoPor })))
            .run();
        }
      });
    },

    // ── sesiones ──

    crearSesion(datos: {
      tokenHash: string;
      usuarioId: number;
      ultimoUso: Date;
    }): SesionFila {
      return db.insert(sesiones).values(datos).returning().get();
    },

    sesionPorToken(tokenHash: string): SesionFila | undefined {
      return db.select().from(sesiones).where(eq(sesiones.tokenHash, tokenHash)).get();
    },

    tocarSesion(id: number, ahora: Date): void {
      db.update(sesiones).set({ ultimoUso: ahora }).where(eq(sesiones.id, id)).run();
    },

    borrarSesion(id: number): void {
      db.delete(sesiones).where(eq(sesiones.id, id)).run();
    },

    /** Las que nadie usa desde antes de `limite` ya vencieron: no sirven a nadie. */
    borrarSesionesSinUsoDesde(limite: Date): void {
      db.delete(sesiones).where(lt(sesiones.ultimoUso, limite)).run();
    },

    /** Echa al usuario de todos lados: al desactivarlo o cambiarle la contraseña. */
    borrarSesionesDe(usuarioId: number): void {
      db.delete(sesiones).where(eq(sesiones.usuarioId, usuarioId)).run();
    },
  };
}

export type RepoUsuarios = ReturnType<typeof crearRepoUsuarios>;
