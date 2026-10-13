import { describe, expect, it } from 'vitest';
import { ReglaDeNegocioError } from '@/lib/errors';
import { estadoDePrecio, prepararPlan, prepararPrecio, sePuedeQuitar } from './plan';

const HOY = '2026-03-10';

describe('prepararPlan', () => {
  it('acepta un plan normal y limpia el nombre', () => {
    expect(
      prepararPlan({ nombre: '  Semestral ', diasDuracion: 180, esPaseDiario: false }),
    ).toEqual({ nombre: 'Semestral', diasDuracion: 180, esPaseDiario: false });
  });

  it('rechaza un nombre vacío', () => {
    expect(() =>
      prepararPlan({ nombre: ' ', diasDuracion: 30, esPaseDiario: false }),
    ).toThrow(ReglaDeNegocioError);
  });

  it('la duración es un entero de días, de 1 en adelante', () => {
    for (const dias of [0, -5, 30.5, 99_999]) {
      expect(() =>
        prepararPlan({ nombre: 'Raro', diasDuracion: dias, esPaseDiario: false }),
      ).toThrow(ReglaDeNegocioError);
    }
  });

  it('un pase por sesión dura 1 día, no más', () => {
    expect(() =>
      prepararPlan({ nombre: 'Pase semanal', diasDuracion: 7, esPaseDiario: true }),
    ).toThrow(/dura 1 día/);
  });
});

describe('prepararPrecio', () => {
  const base = { precioCentavos: 25_000, vigenteDesde: HOY, esPromocion: false };

  it('un precio base no tiene fecha de fin ni nombre', () => {
    expect(
      prepararPrecio({ ...base, vigenteHasta: '2026-12-31', etiqueta: 'sobra' }, HOY),
    ).toEqual({
      precioCentavos: 25_000,
      vigenteDesde: HOY,
      vigenteHasta: null,
      esPromocion: false,
      etiqueta: null,
    });
  });

  it('puede regir desde hoy o desde una fecha futura', () => {
    expect(
      prepararPrecio({ ...base, vigenteDesde: '2026-04-01' }, HOY).vigenteDesde,
    ).toBe('2026-04-01');
  });

  it('NO puede regir desde una fecha pasada: reescribiría el historial', () => {
    expect(() => prepararPrecio({ ...base, vigenteDesde: '2026-03-09' }, HOY)).toThrow(
      /anterior a hoy/,
    );
  });

  it('el precio es un entero de centavos mayor que cero', () => {
    for (const precio of [0, -100, 199.5]) {
      expect(() => prepararPrecio({ ...base, precioCentavos: precio }, HOY)).toThrow(
        ReglaDeNegocioError,
      );
    }
  });

  it('una promoción necesita fecha de fin y nombre', () => {
    const promo = { ...base, esPromocion: true, precioCentavos: 18_000 };

    expect(() => prepararPrecio(promo, HOY)).toThrow(/fecha de fin/);
    expect(() => prepararPrecio({ ...promo, vigenteHasta: '2026-03-31' }, HOY)).toThrow(
      /nombre/,
    );
    expect(
      prepararPrecio(
        { ...promo, vigenteHasta: '2026-03-31', etiqueta: ' Promo otoño ' },
        HOY,
      ),
    ).toMatchObject({
      vigenteHasta: '2026-03-31',
      esPromocion: true,
      etiqueta: 'Promo otoño',
    });
  });

  it('una promoción no puede terminar antes de empezar', () => {
    expect(() =>
      prepararPrecio(
        {
          ...base,
          esPromocion: true,
          vigenteDesde: '2026-03-20',
          vigenteHasta: '2026-03-15',
          etiqueta: 'Promo',
        },
        HOY,
      ),
    ).toThrow(/terminar antes/);
  });

  it('una promoción de un solo día vale', () => {
    expect(
      prepararPrecio(
        { ...base, esPromocion: true, vigenteHasta: HOY, etiqueta: 'Solo hoy' },
        HOY,
      ).vigenteHasta,
    ).toBe(HOY);
  });
});

describe('estado de un precio y si se puede quitar', () => {
  const precio = (vigenteDesde: string, vigenteHasta: string | null = null) => ({
    vigenteDesde,
    vigenteHasta,
  });

  it('rige hoy, todavía no empezó, o ya terminó', () => {
    expect(estadoDePrecio(precio('2026-01-01'), HOY)).toBe('vigente');
    expect(estadoDePrecio(precio(HOY, HOY), HOY)).toBe('vigente');
    expect(estadoDePrecio(precio('2026-03-11'), HOY)).toBe('futuro');
    expect(estadoDePrecio(precio('2026-02-01', '2026-03-09'), HOY)).toBe('terminado');
  });

  it('se puede quitar solo si todavía no empezó y nadie compró con él', () => {
    expect(sePuedeQuitar(precio('2026-03-11'), HOY, false)).toBe(true);
    expect(sePuedeQuitar(precio('2026-03-11'), HOY, true)).toBe(false);
    expect(sePuedeQuitar(precio(HOY), HOY, false)).toBe(false);
    expect(sePuedeQuitar(precio('2026-02-01', '2026-03-09'), HOY, false)).toBe(false);
  });
});
