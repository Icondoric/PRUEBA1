/**
 * Datos del mostrador para la UI.
 *
 * El check-in y la venta del pase son mutaciones y no queries: cada Enter
 * registra algo nuevo en el servidor, así que no hay nada que cachear ni que
 * reintentar solo.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import type { z } from 'zod';
import type {
  AsistenciaDeCliente,
  PaseEnVenta,
  PaseVendido,
  ResultadoCheckin,
  paseInputSchema,
} from '@/modules/checkin';
import { clavesClientes } from '@/web/features/clientes/api/clientes.api';
import { clavesMembresias } from '@/web/features/membresias/api/membresias.api';
import { clavesPagos } from '@/web/features/pagos/api/pagos.api';
import { api, pedir } from '@/web/shared/lib/api';

export type { PaseVendido, ResultadoCheckin };
export type DatosPase = z.output<typeof paseInputSchema>;

export function useRegistrarIngreso() {
  return useMutation({
    mutationFn: (identificador: string) =>
      pedir<ResultadoCheckin>(api.checkin.$post({ json: { identificador } })),
    // Reintentar un check-in duplicaría el ingreso.
    retry: false,
  });
}

/** Cuándo vino por última vez y cuánto viene. Para la ficha. */
export function useAsistencia(clienteId: MaybeRefOrGetter<number>) {
  return useQuery({
    queryKey: computed(() => ['checkin', 'asistencia', toValue(clienteId)] as const),
    queryFn: () =>
      pedir<AsistenciaDeCliente>(
        api.checkin.asistencia.$get({ query: { clienteId: String(toValue(clienteId)) } }),
      ),
    enabled: computed(() => toValue(clienteId) > 0),
  });
}

/** Qué pase se vende hoy y a cuánto. */
export function usePaseEnVenta() {
  return useQuery({
    queryKey: ['checkin', 'pase'] as const,
    queryFn: () => pedir<{ pase: PaseEnVenta }>(api.checkin.pase.$get()),
  });
}

export function useVenderPase() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (datos: DatosPase) =>
      pedir<PaseVendido>(api.checkin.pase.$post({ json: datos })),
    // Reintentar una venta la cobraría dos veces.
    retry: false,
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: clavesClientes.todo }),
        qc.invalidateQueries({ queryKey: clavesMembresias.todo }),
        qc.invalidateQueries({ queryKey: clavesPagos.todo }),
      ]),
  });
}
