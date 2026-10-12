/**
 * Datos de clientes para la UI. ESTE es el patrón a copiar en cada feature.
 *
 * Reglas:
 *   - Todo lo que viene del servidor pasa por vue-query. Nada de `ref([])` +
 *     `onMounted(fetch)`: eso te deja sin caché, sin reintentos y con dos
 *     pantallas mostrando datos distintos.
 *   - Los tipos NO se escriben acá: se infieren del servidor vía RPC.
 *   - Las queries se nombran con un array jerárquico (`['clientes', 'lista']`)
 *     para poder invalidar un grupo entero de una.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import type { z } from 'zod';
import type { ClienteVista, clienteInputSchema } from '@/modules/clientes';
import { api, pedir } from '@/web/shared/lib/api';

export const clavesClientes = {
  todo: ['clientes'] as const,
  lista: (filtros: unknown) => ['clientes', 'lista', filtros] as const,
  uno: (id: number) => ['clientes', 'uno', id] as const,
};

/** Lo que envía el formulario: la salida del mismo esquema que valida la ruta. */
export type DatosCliente = z.output<typeof clienteInputSchema>;

export interface FiltrosLista {
  texto?: string;
  tipo?: 'socio' | 'eventual';
  /** 'baja' = los dados de baja. Pide el acceso "Dar de baja y reactivar". */
  estado?: 'activos' | 'baja';
  pagina?: number;
  porPagina?: number;
}

interface RespuestaLista {
  clientes: ClienteVista[];
  total: number;
  pagina: number;
  porPagina: number;
  paginas: number;
}

export function useListaClientes(filtros: MaybeRefOrGetter<FiltrosLista>) {
  const query = computed(() => toValue(filtros));

  return useQuery({
    queryKey: computed(() => clavesClientes.lista(query.value)),
    queryFn: () =>
      pedir<RespuestaLista>(
        api.clientes.$get({
          query: {
            texto: query.value.texto || undefined,
            tipo: query.value.tipo,
            estado: query.value.estado === 'baja' ? 'baja' : undefined,
            pagina: String(query.value.pagina ?? 1),
            porPagina: String(query.value.porPagina ?? 25),
          },
        }),
      ),
    // Mientras se carga la página siguiente, se sigue viendo la anterior en vez
    // de parpadear a vacío.
    placeholderData: (anterior) => anterior,
  });
}

export function useCliente(id: MaybeRefOrGetter<number>) {
  return useQuery({
    queryKey: computed(() => clavesClientes.uno(toValue(id))),
    queryFn: () =>
      pedir<ClienteVista>(
        api.clientes[':id'].$get({ param: { id: String(toValue(id)) } }),
      ),
    enabled: computed(() => toValue(id) > 0),
  });
}

export function useRegistrarCliente() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (datos: DatosCliente) =>
      pedir<ClienteVista>(api.clientes.$post({ json: datos })),

    // Una sola invalidación: cualquier lista de clientes se recarga sola.
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesClientes.todo }),
  });
}

export function useActualizarCliente() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: DatosCliente }) =>
      pedir<ClienteVista>(
        api.clientes[':id'].$put({ param: { id: String(id) }, json: datos }),
      ),

    // Invalida listas y fichas: el nombre editado aparece en las dos.
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesClientes.todo }),
  });
}

/**
 * Las acciones sobre el estado de un cliente: bloquear, desbloquear, dar de
 * baja y reactivar. Todas refrescan listas y fichas.
 */
export function useEstadoDeCliente() {
  const qc = useQueryClient();
  const refrescar = () => qc.invalidateQueries({ queryKey: clavesClientes.todo });

  return {
    bloquear: useMutation({
      mutationFn: ({ id, motivo }: { id: number; motivo: string }) =>
        pedir<ClienteVista>(
          api.clientes[':id'].bloqueo.$put({
            param: { id: String(id) },
            json: { motivo },
          }),
        ),
      retry: false,
      onSuccess: refrescar,
    }),

    desbloquear: useMutation({
      mutationFn: (id: number) =>
        pedir<ClienteVista>(
          api.clientes[':id'].bloqueo.$delete({ param: { id: String(id) } }),
        ),
      retry: false,
      onSuccess: refrescar,
    }),

    /** Dar de baja. No borra nada: el cliente queda guardado con su historial. */
    darDeBaja: useMutation({
      mutationFn: async (id: number) => {
        const res = await api.clientes[':id'].$delete({ param: { id: String(id) } });
        // 204 sin cuerpo si salió bien; si no, `pedir` arma el error de siempre.
        if (!res.ok) await pedir<never>(Promise.resolve(res));
      },
      retry: false,
      onSuccess: refrescar,
    }),

    reactivar: useMutation({
      mutationFn: (id: number) =>
        pedir<ClienteVista>(
          api.clientes[':id'].reactivacion.$post({ param: { id: String(id) } }),
        ),
      retry: false,
      onSuccess: refrescar,
    }),
  };
}

/** Búsqueda del check-in y de la venta rápida de pases. */
export function useBuscarPorIdentificador() {
  return useMutation({
    mutationFn: (identificador: string) =>
      pedir<{ cliente: ClienteVista | null }>(
        api.clientes.buscar[':identificador'].$get({ param: { identificador } }),
      ),
  });
}
