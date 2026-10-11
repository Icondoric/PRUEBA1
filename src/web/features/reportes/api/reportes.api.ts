/**
 * Datos de reportes para la UI. Una sola consulta trae todo el reporte.
 */

import { useQuery } from '@tanstack/vue-query';
import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import type { Reporte } from '@/modules/reportes';
import { api, pedir } from '@/web/shared/lib/api';

export type { Reporte };

export const clavesReportes = {
  todo: ['reportes'] as const,
  resumen: (mes: string) => ['reportes', 'resumen', mes] as const,
};

export function useReporte(mes: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => clavesReportes.resumen(toValue(mes))),
    queryFn: () =>
      pedir<Reporte>(api.reportes.$get({ query: { mes: toValue(mes) || undefined } })),
    placeholderData: (anterior) => anterior,
    // Son números del negocio: al abrir la pantalla se piden de nuevo.
    staleTime: 0,
  });
}
