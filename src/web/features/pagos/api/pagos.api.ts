/**
 * Datos de pagos para la UI. Mismo patrón que clientes.api.ts.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import type { ListaDePagos, Metodo, PagoVista, PagosDeCliente } from '@/modules/pagos';
import { clavesClientes } from '@/web/features/clientes/api/clientes.api';
import { clavesMembresias } from '@/web/features/membresias/api/membresias.api';
import { api, pedir } from '@/web/shared/lib/api';

export type { PagoVista };

export const clavesPagos = {
  todo: ['pagos'] as const,
  lista: (filtros: unknown) => ['pagos', 'lista', filtros] as const,
  deCliente: (clienteId: number) => ['pagos', 'cliente', clienteId] as const,
};

export interface FiltrosPagos {
  desde?: string;
  hasta?: string;
  metodo?: Metodo;
}

/** Los pagos de un rango (sin fechas: hoy) con los totales de caja. */
export function usePagos(filtros: MaybeRefOrGetter<FiltrosPagos>) {
  const actual = computed(() => toValue(filtros));

  return useQuery({
    queryKey: computed(() => clavesPagos.lista(actual.value)),
    queryFn: () =>
      pedir<ListaDePagos>(
        api.pagos.$get({
          query: {
            desde: actual.value.desde || undefined,
            hasta: actual.value.hasta || undefined,
            metodo: actual.value.metodo,
          },
        }),
      ),
    placeholderData: (anterior) => anterior,
    // Es la caja: al volver a la pantalla tiene que mostrar lo último.
    staleTime: 0,
  });
}

export function usePagosDeCliente(clienteId: MaybeRefOrGetter<number>) {
  return useQuery({
    queryKey: computed(() => clavesPagos.deCliente(toValue(clienteId))),
    queryFn: () =>
      pedir<PagosDeCliente>(
        api.pagos['de-cliente'].$get({
          query: { clienteId: String(toValue(clienteId)) },
        }),
      ),
    enabled: computed(() => toValue(clienteId) > 0),
  });
}

export function useAnularPago() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo: string }) =>
      pedir<{ anulado: boolean; membresiaCancelada: boolean }>(
        api.pagos[':id'].anulacion.$post({ param: { id: String(id) }, json: { motivo } }),
      ),
    retry: false,
    // Cambia la caja, la membresía (queda cancelada) y quizá el tipo de cliente.
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: clavesPagos.todo }),
        qc.invalidateQueries({ queryKey: clavesMembresias.todo }),
        qc.invalidateQueries({ queryKey: clavesClientes.todo }),
      ]),
  });
}
