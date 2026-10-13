/**
 * CAPA DOMAIN — bloqueo manual de un cliente.
 *
 * Un bloqueado rebota en el check-in aunque tenga la membresía al día. Como es
 * una sanción, el motivo es obligatorio: es lo que recepción lee en la ficha
 * cuando la persona pregunta por qué no puede entrar.
 */

import { ReglaDeNegocioError } from '@/lib/errors';

const LARGO_MINIMO_MOTIVO = 5;

/** Valida el motivo y lo devuelve listo para guardar. */
export function prepararBloqueo(motivo: string): string {
  const limpio = motivo.trim();
  if (limpio.length < LARGO_MINIMO_MOTIVO) {
    throw new ReglaDeNegocioError('Escribí por qué se lo bloquea', { campo: 'motivo' });
  }
  return limpio;
}
