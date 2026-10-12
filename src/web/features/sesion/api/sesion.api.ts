/**
 * Quién está usando el sistema, y qué puede hacer.
 *
 * `useAccesos()` es lo que usan las pantallas para mostrar u ocultar un botón.
 * Es comodidad, no seguridad: aunque alguien fuerce un botón a aparecer, el
 * servidor le va a decir que no.
 */

import { useMutation, useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import type { z } from 'zod';
import type { UsuarioSesion } from '@/modules/usuarios';
import {
  type Permiso,
  type loginInputSchema,
  type miPasswordSchema,
  puede as puedeUsuario,
} from '@/modules/usuarios/contrato';
import { ErrorDeApi, api, pedir } from '@/web/shared/lib/api';
import { queryClient } from '@/web/shared/lib/query';

export type { UsuarioSesion };

export const claveSesion = ['sesion'] as const;

/** La sesión actual, o `null` si no hay nadie adentro. */
export const consultaSesion = {
  queryKey: claveSesion,
  queryFn: async (): Promise<UsuarioSesion | null> => {
    try {
      return (await pedir<{ usuario: UsuarioSesion }>(api.sesion.$get())).usuario;
    } catch (error) {
      // "No hay nadie adentro" no es una falla: es una respuesta.
      if (error instanceof ErrorDeApi && error.status === 401) return null;
      throw error;
    }
  },
  staleTime: 60_000,
  retry: false,
};

export function useSesion() {
  return useQuery(consultaSesion);
}

export function useAccesos() {
  const { data: usuario } = useSesion();

  return {
    usuario,
    esDueno: computed(() => usuario.value?.rol === 'admin'),
    /** ¿Quien está adentro tiene este acceso? */
    puede: (permiso: Permiso) => !!usuario.value && puedeUsuario(usuario.value, permiso),
  };
}

export function useIniciarSesion() {
  return useMutation({
    mutationFn: (datos: z.output<typeof loginInputSchema>) =>
      pedir<{ usuario: UsuarioSesion }>(api.sesion.$post({ json: datos })),
    retry: false,
    onSuccess: ({ usuario }) => {
      // Lo que hubiera en memoria era de otra persona (o de nadie).
      queryClient.clear();
      queryClient.setQueryData(claveSesion, usuario);
    },
  });
}

/**
 * Cambiar la propia contraseña. Al salir bien, el servidor cierra todas las
 * sesiones de la cuenta (también esta): hay que volver a entrar.
 */
export function useCambiarMiPassword() {
  return useMutation({
    mutationFn: async (datos: z.output<typeof miPasswordSchema>) => {
      const res = await api.sesion.password.$put({ json: datos });
      if (!res.ok) await pedir<never>(Promise.resolve(res));
    },
    retry: false,
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(claveSesion, null);
    },
  });
}

export function useCerrarSesion() {
  return useMutation({
    mutationFn: async () => {
      await api.sesion.$delete();
    },
    retry: false,
    // Salga bien o mal el pedido, en este navegador ya no queda nada.
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData(claveSesion, null);
    },
  });
}
