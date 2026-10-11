/**
 * Fechas de calendario puras, como strings 'YYYY-MM-DD'.
 *
 * Por qué no `Date`: una membresía corre por días de calendario. Un `Date` lleva
 * hora y zona horaria, y en algún momento alguien va a comparar un timestamp UTC
 * con la medianoche de La Paz (UTC-4) y una membresía va a vencer un día antes.
 *
 * Toda la aritmética de abajo usa UTC internamente y devuelve strings. No hay
 * forma de que una zona horaria se filtre.
 */

export type FechaISO = string; // 'YYYY-MM-DD'

const PATRON = /^\d{4}-\d{2}-\d{2}$/;

export function esFechaISO(valor: string): valor is FechaISO {
  if (!PATRON.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && aISO(d) === valor;
}

function aISO(d: Date): FechaISO {
  return d.toISOString().slice(0, 10);
}

function aDate(fecha: FechaISO): Date {
  if (!esFechaISO(fecha)) throw new Error(`Fecha inválida: ${fecha}`);
  return new Date(`${fecha}T00:00:00Z`);
}

/** Suma (o resta, con negativos) días de calendario. */
export function sumarDias(fecha: FechaISO, dias: number): FechaISO {
  const d = aDate(fecha);
  d.setUTCDate(d.getUTCDate() + dias);
  return aISO(d);
}

/** Días entre dos fechas. Positivo si `hasta` es posterior. */
export function diasEntre(desde: FechaISO, hasta: FechaISO): number {
  const MS_DIA = 86_400_000;
  return Math.round((aDate(hasta).getTime() - aDate(desde).getTime()) / MS_DIA);
}

export function esAnterior(a: FechaISO, b: FechaISO): boolean {
  return aDate(a).getTime() < aDate(b).getTime();
}

export function esPosteriorOIgual(a: FechaISO, b: FechaISO): boolean {
  return aDate(a).getTime() >= aDate(b).getTime();
}

export function maximo(a: FechaISO, b: FechaISO): FechaISO {
  return esAnterior(a, b) ? b : a;
}

/**
 * Hoy en la zona horaria del gimnasio.
 *
 * Es la ÚNICA función del sistema que lee el reloj. Todo lo demás recibe `hoy`
 * como parámetro, para que sea testeable sin congelar timers.
 */
export function hoyEnZona(zona = 'America/La_Paz'): FechaISO {
  // en-CA produce exactamente 'YYYY-MM-DD'
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
