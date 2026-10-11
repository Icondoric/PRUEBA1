/**
 * Cálculo del período de una membresía nueva.
 *
 * REGLA CENTRAL DEL NEGOCIO. Es el único lugar donde se decide desde cuándo
 * corre una membresía. No la reimplementes en una action, en un endpoint ni en
 * el frontend.
 *
 *   - Renovación ANTICIPADA (todavía le quedan días):
 *       el período nuevo arranca al día siguiente del vencimiento anterior.
 *       Así el socio no pierde lo que pagó.
 *   - Renovación VENCIDA (ya se le pasó):
 *       arranca hoy. Los días vencidos no se regalan.
 *   - Primera membresía: arranca hoy (o en la fecha que indique el operador).
 *
 * La duración viene en DÍAS desde el plan, nunca "un mes". Pagar el 31 de enero
 * no debe dejar ambiguo si vence el 28 de febrero o el 3 de marzo.
 */

import {
  type FechaISO,
  diasEntre,
  esPosteriorOIgual,
  sumarDias,
} from '@/lib/fechas';

export interface PeriodoMembresia {
  fechaInicio: FechaISO;
  fechaFin: FechaISO;
  /** true si encadenó desde una membresía anterior todavía vigente. */
  encadenada: boolean;
  /** Días que se arrastraron de la membresía anterior. 0 si no encadenó. */
  diasArrastrados: number;
}

export interface EntradaRenovacion {
  /** Hoy, en la zona del gimnasio. Inyectado, nunca leído del reloj acá. */
  hoy: FechaISO;
  /** Duración del plan en días. Debe ser >= 1. */
  diasDuracion: number;
  /** fecha_fin de la última membresía no cancelada. null si es la primera. */
  fechaFinAnterior?: FechaISO | null;
  /**
   * Fecha de inicio forzada por el operador (ej. "arranca el lunes").
   * Si se pasa, gana sobre el encadenamiento.
   */
  inicioForzado?: FechaISO | null;
  /**
   * false para pases diarios y entradas por sesión: valen HOY, nunca se
   * agendan para cuando termine otra membresía.
   *
   * Sin esto, un socio con mensualidad vigente que paga una sesión suelta
   * recibiría un pase para dentro de tres semanas. Pasar `!plan.esPaseDiario`.
   */
  encadenable?: boolean;
}

export function calcularPeriodo(entrada: EntradaRenovacion): PeriodoMembresia {
  const {
    hoy,
    diasDuracion,
    fechaFinAnterior = null,
    inicioForzado = null,
    encadenable = true,
  } = entrada;

  if (!Number.isInteger(diasDuracion) || diasDuracion < 1) {
    throw new Error(`diasDuracion debe ser un entero >= 1, recibido: ${diasDuracion}`);
  }

  if (inicioForzado) {
    return {
      fechaInicio: inicioForzado,
      fechaFin: sumarDias(inicioForzado, diasDuracion - 1),
      encadenada: false,
      diasArrastrados: 0,
    };
  }

  // Vigente hoy inclusive => encadena. Vence HOY todavía cuenta como vigente:
  // el socio puede entrenar hoy, así que el período nuevo arranca mañana.
  // Un pase diario (encadenable = false) nunca encadena: vale hoy y se acabó.
  const encadena =
    encadenable && fechaFinAnterior !== null && esPosteriorOIgual(fechaFinAnterior, hoy);

  const fechaInicio = encadena ? sumarDias(fechaFinAnterior!, 1) : hoy;

  return {
    fechaInicio,
    fechaFin: sumarDias(fechaInicio, diasDuracion - 1),
    encadenada: encadena,
    diasArrastrados: encadena ? diasEntre(hoy, fechaFinAnterior!) + 1 : 0,
  };
}
