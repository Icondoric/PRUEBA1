/**
 * Rango de fechas para los listados (pagos, visitas, reportes).
 */

import { ReglaDeNegocioError } from '@/lib/errors';
import { type FechaISO, esAnterior, esFechaISO } from '@/lib/fechas';

/**
 * Rango de fechas de un listado. Sin fechas, es el día de hoy. Con una
 * sola, es ese día.
 */
export function rangoDeFechas(
  entrada: { desde?: string | null; hasta?: string | null },
  hoy: FechaISO,
): { desde: FechaISO; hasta: FechaISO } {
  const desde = entrada.desde?.trim() || entrada.hasta?.trim() || hoy;
  const hasta = entrada.hasta?.trim() || entrada.desde?.trim() || hoy;

  if (!esFechaISO(desde)) {
    throw new ReglaDeNegocioError('La fecha "desde" no es válida', { campo: 'desde' });
  }
  if (!esFechaISO(hasta)) {
    throw new ReglaDeNegocioError('La fecha "hasta" no es válida', { campo: 'hasta' });
  }
  if (esAnterior(hasta, desde)) {
    throw new ReglaDeNegocioError('La fecha "hasta" no puede ser anterior a "desde"', {
      campo: 'hasta',
    });
  }
  return { desde, hasta };
}
