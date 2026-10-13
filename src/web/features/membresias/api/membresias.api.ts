/**
 * Datos de membresías para la UI. Mismo patrón que clientes.api.ts: todo pasa
 * por vue-query y los tipos se infieren del servidor.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import type { z } from 'zod';
import type {
  CoberturasDeClientes,
  CotizacionVista,
  HistorialMembresias,
  PlanesConPrecio,
  VentaRegistrada,
  ventaInputSchema,
} from '@/modules/membresias';
import { clavesClientes } from '@/web/features/clientes/api/clientes.api';
import { api, pedir } from '@/web/shared/lib/api';

export const clavesMembresias = {
  todo: ['membresias'] as const,
  planes: ['membresias', 'planes'] as const,
  historial: (clienteId: number) => ['membresias', 'historial', clienteId] as const,
  coberturas: (clienteIds: number[]) => ['membresias', 'coberturas', clienteIds] as const,
  cotizacion: (params: unknown) => ['membresias', 'cotizacion', params] as const,
};

export type DatosVenta = z.output<typeof ventaInputSchema>;

export interface ParametrosCotizacion {
  clienteId: number;
  /** 0 mientras no se eligió plan: no se consulta. */
  planId: number;
  inicio?: string;
}

/** Lo que se puede vender hoy y a qué precio. */
export function usePlanes() {
  return useQuery({
    queryKey: clavesMembresias.planes,
    queryFn: () => pedir<PlanesConPrecio>(api.planes.$get()),
  });
}

export function useHistorialMembresias(clienteId: MaybeRefOrGetter<number>) {
  return useQuery({
    queryKey: computed(() => clavesMembresias.historial(toValue(clienteId))),
    queryFn: () =>
      pedir<HistorialMembresias>(
        api.membresias.$get({ query: { clienteId: String(toValue(clienteId)) } }),
      ),
    enabled: computed(() => toValue(clienteId) > 0),
  });
}

/**
 * Cómo está la membresía de varios clientes a la vez: los de una página de la
 * lista, en una sola consulta.
 */
export function useCoberturas(clienteIds: MaybeRefOrGetter<number[]>) {
  const ids = computed(() => toValue(clienteIds));
  return useQuery({
    queryKey: computed(() => clavesMembresias.coberturas(ids.value)),
    queryFn: () =>
      pedir<CoberturasDeClientes>(
        api.membresias.coberturas.$get({ query: { clienteIds: ids.value.join(',') } }),
      ),
    enabled: computed(() => ids.value.length > 0),
    // Al cambiar de página se sigue viendo lo anterior hasta que llega lo nuevo.
    placeholderData: (anterior) => anterior,
  });
}

/** Vista previa de una venta: período y precio. No guarda nada. */
export function useCotizacion(params: MaybeRefOrGetter<ParametrosCotizacion>) {
  const actual = computed(() => toValue(params));

  return useQuery({
    queryKey: computed(() => clavesMembresias.cotizacion(actual.value)),
    queryFn: () =>
      pedir<CotizacionVista>(
        api.membresias.cotizacion.$get({
          query: {
            clienteId: String(actual.value.clienteId),
            planId: String(actual.value.planId),
            inicio: actual.value.inicio || undefined,
          },
        }),
      ),
    enabled: computed(() => actual.value.clienteId > 0 && actual.value.planId > 0),
    // Es plata: siempre se vuelve a preguntar, nunca se muestra un precio viejo
    // como si fuera el actual.
    staleTime: 0,
    // Al cambiar de plan se sigue viendo el resumen anterior, atenuado.
    placeholderData: (anterior) => anterior,
  });
}

export function useVenderMembresia() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (datos: DatosVenta) =>
      pedir<VentaRegistrada>(api.membresias.$post({ json: datos })),

    // Cambia el historial y también el cliente: un eventual pasa a ser socio.
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: clavesMembresias.todo }),
        qc.invalidateQueries({ queryKey: clavesClientes.todo }),
      ]),
  });
}
