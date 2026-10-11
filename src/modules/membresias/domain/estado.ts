/**
 * CAPA DOMAIN — estado de una membresía a una fecha.
 *
 * "Vencida" no existe en la base: se calcula acá, con `hoy` por parámetro. Un
 * campo guardado se desactualiza a medianoche y nadie se entera.
 */

import { type FechaISO, diasEntre, esAnterior } from '@/lib/fechas';

export type EstadoMembresia =
  'vigente' | 'vencida' | 'futura' | 'cancelada' | 'congelada';

export interface MembresiaParaEstado {
  fechaInicio: FechaISO;
  fechaFin: FechaISO;
  /** Lo que sí se guarda: si la venta se canceló (o, a futuro, se congeló). */
  estado: 'vigente' | 'cancelada' | 'congelada';
}

export function estadoMembresia(m: MembresiaParaEstado, hoy: FechaISO): EstadoMembresia {
  if (m.estado !== 'vigente') return m.estado;
  if (esAnterior(m.fechaFin, hoy)) return 'vencida'; // vence hoy => todavía vigente
  if (esAnterior(hoy, m.fechaInicio)) return 'futura';
  return 'vigente';
}

export type SituacionCliente = 'sin_membresia' | 'vigente' | 'vencida' | 'futura';

export interface Cobertura {
  situacion: SituacionCliente;
  /** Hasta cuándo tiene pago, contando renovaciones ya encadenadas. */
  hasta: FechaISO | null;
  /** Días que faltan para `hasta`. Negativo si ya venció. */
  dias: number | null;
  /** Solo para 'futura': cuándo empieza. */
  desde: FechaISO | null;
  /** Lo que cubre hoy es un pase por sesión. */
  esPaseDiario: boolean;
}

/**
 * Resume en qué situación está un cliente a partir de todo su historial.
 *
 * Mira el conjunto y no una sola fila: un socio que renovó por adelantado
 * tiene una membresía vigente y otra futura, y lo que le importa a recepción
 * es "está al día, y tiene pago hasta tal fecha".
 */
export function coberturaDelCliente(
  membresias: ReadonlyArray<MembresiaParaEstado & { esPaseDiario: boolean }>,
  hoy: FechaISO,
): Cobertura {
  const validas = membresias.filter((m) => m.estado !== 'cancelada');

  const ultima = validas.reduce<(typeof validas)[number] | null>(
    (mejor, m) => (mejor === null || esAnterior(mejor.fechaFin, m.fechaFin) ? m : mejor),
    null,
  );

  if (ultima === null) {
    return {
      situacion: 'sin_membresia',
      hasta: null,
      dias: null,
      desde: null,
      esPaseDiario: false,
    };
  }

  const base = { hasta: ultima.fechaFin, dias: diasEntre(hoy, ultima.fechaFin) };
  const deHoy = validas.find((m) => estadoMembresia(m, hoy) === 'vigente');

  if (deHoy) {
    return {
      ...base,
      situacion: 'vigente',
      desde: null,
      // Si además del pase de hoy hay algo más largo pagado, manda lo largo.
      esPaseDiario: deHoy.esPaseDiario && ultima.esPaseDiario,
    };
  }

  if (esAnterior(ultima.fechaFin, hoy)) {
    return { ...base, situacion: 'vencida', desde: null, esPaseDiario: false };
  }

  const proxima = validas
    .filter((m) => estadoMembresia(m, hoy) === 'futura')
    .reduce<FechaISO | null>(
      (antes, m) =>
        antes === null || esAnterior(m.fechaInicio, antes) ? m.fechaInicio : antes,
      null,
    );

  return { ...base, situacion: 'futura', desde: proxima, esPaseDiario: false };
}
