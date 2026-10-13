/**
 * Datos de usuarios y accesos para la UI. Solo los usa el dueño.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { CatalogoDeAccesos, UsuarioVista } from '@/modules/usuarios';
import { api, pedir } from '@/web/shared/lib/api';

export type { UsuarioVista };

export const clavesUsuarios = {
  todo: ['usuarios'] as const,
  lista: ['usuarios', 'lista'] as const,
};

type ListaDeUsuarios = { usuarios: UsuarioVista[] } & CatalogoDeAccesos;

/** Todos los usuarios, con el catálogo de accesos para dibujar las casillas. */
export function useUsuarios() {
  return useQuery({
    queryKey: clavesUsuarios.lista,
    queryFn: () => pedir<ListaDeUsuarios>(api.usuarios.$get()),
    // Son permisos: siempre lo último.
    staleTime: 0,
  });
}

export function useCrearUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: {
      usuario: string;
      nombre: string;
      password: string;
      permisos: string[];
    }) => pedir<UsuarioVista>(api.usuarios.$post({ json: datos })),
    retry: false,
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesUsuarios.todo }),
  });
}

export function useActualizarUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      cambios,
    }: {
      id: number;
      cambios: { nombre?: string; activo?: boolean; permisos?: string[] };
    }) =>
      pedir<UsuarioVista>(
        api.usuarios[':id'].$put({ param: { id: String(id) }, json: cambios }),
      ),
    retry: false,
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesUsuarios.todo }),
  });
}

export function useCambiarPassword() {
  return useMutation({
    mutationFn: async ({ id, password }: { id: number; password: string }) => {
      const res = await api.usuarios[':id'].password.$put({
        param: { id: String(id) },
        json: { password },
      });
      // 204 sin cuerpo si salió bien; si no, `pedir` arma el error de siempre.
      if (!res.ok) await pedir<never>(Promise.resolve(res));
    },
    retry: false,
  });
}
