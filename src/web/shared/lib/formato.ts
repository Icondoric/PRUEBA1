/**
 * Formato para mostrar. Solo presentación: ninguna regla de negocio vive acá.
 */

/**
 * 'YYYY-MM-DD' → 'DD/MM/YYYY'. Reordena el texto, no pasa por `Date`: una
 * fecha de calendario no tiene zona horaria y no hay que inventarle una.
 */
export function formatearFecha(fecha: string | null | undefined): string {
  if (!fecha) return '—';
  const [anio, mes, dia] = fecha.split('-');
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : fecha;
}

export function formatearCi(ci: string | null, extension: string | null): string {
  if (!ci) return '—';
  return extension ? `${ci} ${extension}` : ci;
}

/** "1 cliente" / "2 clientes". */
export function plural(n: number, singular: string, pluralizado: string): string {
  return `${n} ${n === 1 ? singular : pluralizado}`;
}

/**
 * Centavos → 'Bs 1.900'. El dinero es entero en centavos de punta a punta;
 * recién acá se vuelve texto, y sin pasar por decimales.
 *
 * `conCentavos` fuerza los dos decimales ('Bs 200,00'): para columnas, donde
 * todos los montos tienen que tener el mismo largo para poder compararse.
 */
export function formatearBs(
  centavos: number,
  opciones: { conCentavos?: boolean } = {},
): string {
  const absoluto = Math.abs(centavos);
  const enteros = String(Math.trunc(absoluto / 100)).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    '.',
  );
  const resto = absoluto % 100;
  const decimales =
    resto > 0 || opciones.conCentavos ? `,${String(resto).padStart(2, '0')}` : '';
  return `${centavos < 0 ? '−' : ''}Bs ${enteros}${decimales}`;
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** 'YYYY-MM' → 'octubre 2026'. */
export function formatearMes(mes: string): string {
  const [anio, numero] = mes.split('-');
  const nombre = MESES[Number(numero) - 1];
  return nombre && anio ? `${nombre} ${anio}` : mes;
}

/** 'YYYY-MM-DD' → 'DD/MM', para ejes y listas donde el año sobra. */
export function formatearDiaMes(fecha: string): string {
  const [, mes, dia] = fecha.split('-');
  return mes && dia ? `${dia}/${mes}` : fecha;
}

/**
 * Lo que alguien teclea como precio → centavos enteros. `null` si no se
 * entiende.
 *
 * Acepta '200', '200,5' y '200.50'. NO acepta separador de miles ('1.900'):
 * no hay forma de saber si es mil novecientos o uno coma nueve, y con plata no
 * se adivina. La cuenta se hace con texto, sin pasar por decimales.
 */
export function aCentavos(texto: string): number | null {
  const limpio = texto.trim().replace(/^Bs\s*/i, '');
  const partes = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(limpio);
  if (!partes) return null;

  const enteros = Number(partes[1]);
  const decimales = Number((partes[2] ?? '').padEnd(2, '0'));
  return enteros * 100 + decimales;
}

/** Centavos → lo que se muestra dentro de un campo de precio: '200' o '200,50'. */
export function centavosParaCampo(centavos: number): string {
  const resto = centavos % 100;
  const enteros = Math.trunc(centavos / 100);
  return resto === 0 ? String(enteros) : `${enteros},${String(resto).padStart(2, '0')}`;
}

/**
 * Un momento real (auditoría: cuándo se bloqueó, cuándo se anuló) →
 * '10/03/2026 11:30', en la hora del gimnasio.
 *
 * Esto NO es una fecha de membresía: aquellas son texto 'YYYY-MM-DD' y no
 * llevan zona. Acá sí hay una hora de reloj, y se muestra en La Paz esté donde
 * esté quien mira (el dueño, desde el celular, en otro huso).
 */
export function formatearMomento(momento: string | Date | null | undefined): string {
  if (!momento) return '—';
  const fecha = new Date(momento);
  if (Number.isNaN(fecha.getTime())) return '—';

  const partes = new Intl.DateTimeFormat('es-BO', {
    timeZone: 'America/La_Paz',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(fecha);
  const de = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';

  return `${de('day')}/${de('month')}/${de('year')} ${de('hour')}:${de('minute')}`;
}
