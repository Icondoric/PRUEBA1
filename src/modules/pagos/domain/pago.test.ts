import { describe, expect, it } from 'vitest';
import { ConflictoError, ReglaDeNegocioError } from '@/lib/errors';
import { rangoDeFechas } from '@/lib/rango';
import { prepararAnulacion, totalesDeCaja } from './pago';

describe('prepararAnulacion', () => {
  it('devuelve el motivo sin espacios de más', () => {
    expect(prepararAnulacion({ anulado: false }, '  Se cobró dos veces  ')).toBe(
      'Se cobró dos veces',
    );
  });

  it('exige un motivo de verdad', () => {
    expect(() => prepararAnulacion({ anulado: false }, '')).toThrow(ReglaDeNegocioError);
    expect(() => prepararAnulacion({ anulado: false }, ' ok ')).toThrow(
      ReglaDeNegocioError,
    );
  });

  it('un pago ya anulado no se anula de nuevo', () => {
    expect(() => prepararAnulacion({ anulado: true }, 'Se cobró dos veces')).toThrow(
      ConflictoError,
    );
  });
});

describe('totalesDeCaja', () => {
  const pago = (metodo: 'efectivo' | 'qr', montoCentavos: number, anulado = false) => ({
    metodo,
    montoCentavos,
    anulado,
  });

  it('suma por método y en total, en centavos enteros', () => {
    const t = totalesDeCaja([
      pago('efectivo', 20_000),
      pago('efectivo', 2_000),
      pago('qr', 54_000),
    ]);

    expect(t.totalCentavos).toBe(76_000);
    expect(t.cantidad).toBe(3);
    expect(t.porMetodo.find((m) => m.metodo === 'efectivo')).toEqual({
      metodo: 'efectivo',
      cantidad: 2,
      centavos: 22_000,
    });
  });

  it('los anulados no suman, pero se cuentan aparte', () => {
    const t = totalesDeCaja([pago('efectivo', 20_000), pago('efectivo', 54_000, true)]);

    expect(t.totalCentavos).toBe(20_000);
    expect(t.cantidad).toBe(1);
    expect(t.anulados).toBe(1);
  });

  it('devuelve siempre los cuatro métodos, aunque estén en cero', () => {
    const t = totalesDeCaja([]);

    expect(t.porMetodo.map((m) => m.metodo)).toEqual([
      'efectivo',
      'qr',
      'transferencia',
      'tarjeta',
    ]);
    expect(t.totalCentavos).toBe(0);
  });
});

describe('rangoDeFechas', () => {
  const HOY = '2026-03-10';

  it('sin fechas: hoy', () => {
    expect(rangoDeFechas({}, HOY)).toEqual({ desde: HOY, hasta: HOY });
  });

  it('con una sola fecha: ese día', () => {
    expect(rangoDeFechas({ desde: '2026-03-01' }, HOY)).toEqual({
      desde: '2026-03-01',
      hasta: '2026-03-01',
    });
  });

  it('con las dos: el rango', () => {
    expect(rangoDeFechas({ desde: '2026-03-01', hasta: '2026-03-07' }, HOY)).toEqual({
      desde: '2026-03-01',
      hasta: '2026-03-07',
    });
  });

  it('rechaza un rango al revés', () => {
    expect(() =>
      rangoDeFechas({ desde: '2026-03-07', hasta: '2026-03-01' }, HOY),
    ).toThrow(ReglaDeNegocioError);
  });

  it('rechaza una fecha que no existe', () => {
    expect(() => rangoDeFechas({ desde: '2026-02-30' }, HOY)).toThrow(
      ReglaDeNegocioError,
    );
  });
});
