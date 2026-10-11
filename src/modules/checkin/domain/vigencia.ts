/**
 * CAPA DOMAIN — qué membresía cuenta para entrar hoy.
 *
 * `evaluarAcceso` decide con una sola fecha de fin. Esta función elige cuál:
 * la del tramo de cobertura que YA empezó, extendido por las renovaciones
 * encadenadas a continuación.
 *
 * Por qué no "la que vence más tarde" a secas: alguien que pagó hoy para
 * arrancar el lunes tiene una membresía con fecha de fin futura, pero todavía
 * no puede entrar. Esa se informa aparte (`proximaDesde`) para que el
 * mostrador sepa explicarle por qué rebotó.
 *
 * Pura: recibe las membresías no canceladas y `hoy`.
 */

import { type FechaISO, esAnterior, sumarDias } from '@/lib/fechas';

export interface MembresiaParaAcceso {
  id: number;
  fechaInicio: FechaISO;
  fechaFin: FechaISO;
  esPaseDiario: boolean;
}

export interface VigenciaParaAcceso {
  /** Lo que recibe `evaluarAcceso`. null si nunca empezó ninguna. */
  fechaFin: FechaISO | null;
  membresiaId: number | null;
  esPaseDiario: boolean;
  /** Si tiene algo pago que todavía no empezó, cuándo empieza. */
  proximaDesde: FechaISO | null;
}

const masTardia = <T extends MembresiaParaAcceso>(lista: T[]): T | null =>
  lista.reduce<T | null>(
    (mejor, m) => (mejor === null || esAnterior(mejor.fechaFin, m.fechaFin) ? m : mejor),
    null,
  );

export function vigenciaParaAcceso(
  membresias: ReadonlyArray<MembresiaParaAcceso>,
  hoy: FechaISO,
): VigenciaParaAcceso {
  const empezadas = membresias.filter((m) => !esAnterior(hoy, m.fechaInicio));
  const futuras = membresias.filter((m) => esAnterior(hoy, m.fechaInicio));

  const vigentes = empezadas.filter((m) => !esAnterior(m.fechaFin, hoy));
  const actual = masTardia(vigentes);

  if (actual === null) {
    // Nada vigente hoy: manda la última que tuvo (para decir hace cuánto
    // venció), y se avisa si hay algo pago que arranca más adelante.
    const ultima = masTardia(empezadas);
    const proxima = futuras.reduce<FechaISO | null>(
      (antes, m) =>
        antes === null || esAnterior(m.fechaInicio, antes) ? m.fechaInicio : antes,
      null,
    );
    return {
      fechaFin: ultima?.fechaFin ?? null,
      membresiaId: ultima?.id ?? null,
      esPaseDiario: false,
      proximaDesde: proxima,
    };
  }

  // Renovó por adelantado: la cobertura sigue sin corte, así que no hay que
  // avisarle que "vence en 2 días". Se extiende mientras no haya un hueco.
  let fechaFin = actual.fechaFin;
  let extendida = false;
  for (;;) {
    const limite = sumarDias(fechaFin, 1);
    const siguiente = masTardia(
      futuras.filter(
        (m) => !esAnterior(limite, m.fechaInicio) && esAnterior(fechaFin, m.fechaFin),
      ),
    );
    if (siguiente === null) break;
    fechaFin = siguiente.fechaFin;
    extendida = true;
  }

  return {
    fechaFin,
    membresiaId: actual.id,
    // Un pase de hoy seguido de una mensualidad que arranca mañana ya no es
    // "solo un pase".
    esPaseDiario: actual.esPaseDiario && !extendida,
    proximaDesde: null,
  };
}
