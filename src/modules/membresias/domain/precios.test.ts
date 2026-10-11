import { describe, expect, it } from 'vitest';
import {
  type PrecioVigencia,
  SinPrecioVigenteError,
  resolverPrecio,
} from './precios';

const BASE: PrecioVigencia = {
  id: 1,
  planId: 1,
  precioCentavos: 20000, // Bs 200
  vigenteDesde: '2026-01-01',
  vigenteHasta: null,
  esPromocion: false,
  etiqueta: null,
};

const PROMO: PrecioVigencia = {
  id: 2,
  planId: 1,
  precioCentavos: 15000, // Bs 150
  vigenteDesde: '2026-10-01',
  vigenteHasta: '2026-10-31',
  esPromocion: true,
  etiqueta: 'Promo aniversario',
};

describe('resolverPrecio', () => {
  it('usa el precio base cuando no hay promo', () => {
    const r = resolverPrecio([BASE], '2026-09-15', 1);
    expect(r.precioCentavos).toBe(20000);
    expect(r.esPromocion).toBe(false);
    expect(r.descuentoCentavos).toBe(0);
  });

  it('la promo le gana al precio base mientras está vigente', () => {
    const r = resolverPrecio([BASE, PROMO], '2026-10-11', 1);
    expect(r.precioCentavos).toBe(15000);
    expect(r.esPromocion).toBe(true);
    expect(r.etiqueta).toBe('Promo aniversario');
    expect(r.descuentoCentavos).toBe(5000);
  });

  it('el último día de la promo todavía cuenta', () => {
    expect(resolverPrecio([BASE, PROMO], '2026-10-31', 1).precioCentavos).toBe(15000);
  });

  it('al día siguiente vuelve el precio base', () => {
    expect(resolverPrecio([BASE, PROMO], '2026-11-01', 1).precioCentavos).toBe(20000);
  });

  it('el primer día de la promo ya aplica', () => {
    expect(resolverPrecio([BASE, PROMO], '2026-10-01', 1).precioCentavos).toBe(15000);
  });

  it('entre dos promos solapadas gana la que empezó después', () => {
    const otra: PrecioVigencia = {
      ...PROMO,
      id: 3,
      precioCentavos: 12000,
      vigenteDesde: '2026-10-05',
      vigenteHasta: '2026-10-20',
      etiqueta: 'Promo relámpago',
    };
    const r = resolverPrecio([BASE, PROMO, otra], '2026-10-11', 1);
    expect(r.precioCentavos).toBe(12000);
    expect(r.etiqueta).toBe('Promo relámpago');
  });

  it('un cambio de precio base reemplaza al anterior', () => {
    const nuevoBase: PrecioVigencia = {
      ...BASE,
      id: 4,
      precioCentavos: 25000,
      vigenteDesde: '2026-07-01',
    };
    expect(resolverPrecio([BASE, nuevoBase], '2026-08-01', 1).precioCentavos).toBe(25000);
    // y el histórico sigue devolviendo el viejo
    expect(resolverPrecio([BASE, nuevoBase], '2026-03-01', 1).precioCentavos).toBe(20000);
  });

  it('ignora precios de otros planes', () => {
    const otroPlan: PrecioVigencia = { ...PROMO, id: 5, planId: 2, precioCentavos: 100 };
    expect(resolverPrecio([BASE, otroPlan], '2026-10-11', 1).precioCentavos).toBe(20000);
  });

  it('falla fuerte si no hay precio configurado, en vez de cobrar cero', () => {
    expect(() => resolverPrecio([BASE], '2025-12-31', 1)).toThrow(SinPrecioVigenteError);
    expect(() => resolverPrecio([], '2026-10-11', 1)).toThrow(SinPrecioVigenteError);
  });
});
