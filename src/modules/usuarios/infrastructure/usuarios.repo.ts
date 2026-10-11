/**
 * CAPA INFRASTRUCTURE — SQL de usuarios del sistema.
 */

import { eq } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { usuarios } from '@/lib/db/schema';

export type UsuarioFila = typeof usuarios.$inferSelect;

export function crearRepoUsuarios(db: DB) {
  return {
    porUsuario(usuario: string): UsuarioFila | undefined {
      return db.select().from(usuarios).where(eq(usuarios.usuario, usuario)).get();
    },

    insertar(datos: typeof usuarios.$inferInsert): UsuarioFila {
      return db.insert(usuarios).values(datos).returning().get();
    },
  };
}

export type RepoUsuarios = ReturnType<typeof crearRepoUsuarios>;
