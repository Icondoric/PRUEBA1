/**
 * Datos del check-in para la UI.
 *
 * Es una mutación y no una query: cada Enter registra un ingreso nuevo en el
 * servidor, así que no hay nada que cachear ni que reintentar solo.
 */

import { useMutation } from '@tanstack/vue-query';
import type { ResultadoCheckin } from '@/modules/checkin';
import { api, pedir } from '@/web/shared/lib/api';

export type { ResultadoCheckin };

export function useRegistrarIngreso() {
  return useMutation({
    mutationFn: (identificador: string) =>
      pedir<ResultadoCheckin>(api.checkin.$post({ json: { identificador } })),
    // Reintentar un check-in duplicaría el ingreso.
    retry: false,
  });
}
