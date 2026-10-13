/**
 * Exportar una tabla a CSV, para abrirla en Excel con doble clic.
 *
 *   - Separador `;` y BOM de UTF-8: es lo que Excel en español espera. Con
 *     coma, o sin BOM, mete todo en una columna o rompe los acentos.
 *   - Los montos van como número con coma decimal, sin "Bs": así Excel los
 *     suma.
 *   - Un texto que empieza con = + - @ se podría ejecutar como fórmula al abrir
 *     el archivo. Como los nombres los escribe cualquiera, se neutraliza.
 */

export type CeldaCsv = string | number | null | undefined;

function celda(valor: CeldaCsv): string {
  if (valor === null || valor === undefined) return '';
  let texto = String(valor);
  if (typeof valor === 'string' && /^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function aCsv(encabezados: string[], filas: CeldaCsv[][]): string {
  return [encabezados, ...filas].map((fila) => fila.map(celda).join(';')).join('\r\n');
}

/** Centavos → '200,00'. Texto ya armado: no pasa por decimales. */
export function montoParaCsv(centavos: number): string {
  const absoluto = Math.abs(centavos);
  const resto = String(absoluto % 100).padStart(2, '0');
  return `${centavos < 0 ? '-' : ''}${Math.trunc(absoluto / 100)},${resto}`;
}

export function descargarCsv(nombre: string, encabezados: string[], filas: CeldaCsv[][]) {
  const archivo = new Blob(['\uFEFF', aCsv(encabezados, filas)], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(archivo);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `${nombre}.csv`;
  enlace.click();
  URL.revokeObjectURL(url);
}
