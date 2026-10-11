/**
 * Datos de visitas (entradas gratis) para la UI.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { z } from 'zod';
import type {
  ListaDeVisitas,
  VisitaRegistrada,
  visitaInputSchema,
} from '@/modules/visitas';
import { api, pedir } from '@/web/shared/lib/api';

export const clavesVisitas = {
  todo: ['visitas'] as const,
  lista: ['visitas', 'lista'] as const,
};

export type DatosVisita = z.output<typeof visitaInputSchema>;

/** Las visitas del último mes. */
export function useVisitas() {
  return useQuery({
    queryKey: clavesVisitas.lista,
    queryFn: () => pedir<ListaDeVisitas>(api.visitas.$get({ query: {} })),
  });
}

export function useRegistrarVisita() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (datos: DatosVisita) =>
      pedir<VisitaRegistrada>(api.visitas.$post({ json: datos })),
    retry: false,
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesVisitas.todo }),
  });
}
