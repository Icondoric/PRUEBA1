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
