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
