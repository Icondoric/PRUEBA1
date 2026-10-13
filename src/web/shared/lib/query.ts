/**
 * El cliente de vue-query, uno solo para toda la app.
 *
 * Vive en su propio archivo (y no en main.ts) porque también lo usa el router:
 * antes de mostrar una pantalla hay que saber quién inició sesión.
 */

import { MutationCache, QueryCache, QueryClient } from '@tanstack/vue-query';
import { ErrorDeApi } from './api';

let alPerderLaSesion: (() => void) | null = null;

/**
 * Qué hacer cuando el servidor responde "no estás adentro" en medio del uso
 * (la sesión venció, o el dueño desactivó la cuenta). Lo registra el router.
 */
export function avisarSiSePierdeLaSesion(accion: () => void) {
  alPerderLaSesion = accion;
}

function revisar(error: unknown) {
  if (error instanceof ErrorDeApi && error.status === 401) alPerderLaSesion?.();
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: revisar }),
  mutationCache: new MutationCache({ onError: revisar }),
  defaultOptions: {
    queries: {
      // Un 401, un 403 o un 422 no se arreglan reintentando: se muestran
      // enseguida. Solo se reintenta lo que puede ser pasajero (5xx).
      retry: (intentos, error) =>
        !(error instanceof ErrorDeApi && error.status < 500) && intentos < 2,
      staleTime: 10_000,
    },
  },
});
