import { describe, expect, it } from 'vitest';
import { aCsv, montoParaCsv } from './csv';

describe('aCsv', () => {
  it('separa con punto y coma y corta las líneas con CRLF, como espera Excel', () => {
    expect(aCsv(['Nº', 'Nombre'], [[1, 'Ana Quispe']])).toBe('Nº;Nombre\r\n1;Ana Quispe');
  });

  it('pone entre comillas lo que tiene punto y coma, comillas o saltos', () => {
    expect(aCsv(['Nota'], [['pagó; "con QR"']])).toBe('Nota\r\n"pagó; ""con QR"""');
  });

  it('las celdas vacías quedan vacías, no "null"', () => {
    expect(aCsv(['A', 'B'], [[null, undefined]])).toBe('A;B\r\n;');
  });

  it('neutraliza un texto que Excel ejecutaría como fórmula', () => {
    expect(aCsv(['Nombre'], [['=HYPERLINK("http://x")']])).toBe(
      'Nombre\r\n"\'=HYPERLINK(""http://x"")"',
    );
    expect(aCsv(['Nombre'], [['+591 70000000']])).toBe("Nombre\r\n'+591 70000000");
  });

  it('un número negativo no se toca: es un dato, no una fórmula', () => {
    expect(aCsv(['Días'], [[-3]])).toBe('Días\r\n-3');
  });
});

describe('montoParaCsv', () => {
  it('centavos a número con coma decimal, sin "Bs" ni separador de miles', () => {
    expect(montoParaCsv(190_000)).toBe('1900,00');
    expect(montoParaCsv(2_050)).toBe('20,50');
    expect(montoParaCsv(5)).toBe('0,05');
    expect(montoParaCsv(0)).toBe('0,00');
  });
});
