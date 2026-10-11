import { describe, expect, it } from 'vitest';
import { ReglaDeNegocioError } from '@/lib/errors';
import type { PrecioVigencia } from './precios';
import { type PlanParaVenta, cotizarVenta } from './venta';

const HOY = '2026-03-10';

const mensual: PlanParaVenta = {
  id: 1,
  nombre: 'Mensual',
  diasDuracion: 30,
  esPaseDiario: false,
  activo: true,
};
const sesion: PlanParaVenta = {
  id: 2,
  nombre: 'Pase por sesión',
  diasDuracion: 1,
  esPaseDiario: true,
  activo: true,
};

const precio = (cambios: Partial<PrecioVigencia> & { id: number }): PrecioVigencia => ({
  planId: 1,
  precioCentavos: 20_000,
  vigenteDesde: '2026-01-01',
  vigenteHasta: null,
  esPromocion: false,
  etiqueta: null,
  ...cambios,
});

const precios = [precio({ id: 1 }), precio({ id: 2, planId: 2, precioCentavos: 2_000 })];

describe('cotizarVenta', () => {
  it('primera membresía: arranca hoy y cobra el precio base', () => {
    const c = cotizarVenta({ hoy: HOY, plan: mensual, precios, fechaFinAnterior: null });

    expect(c.periodo.fechaInicio).toBe('2026-03-10');
    expect(c.periodo.fechaFin).toBe('2026-04-08');
    expect(c.precio.precioCentavos).toBe(20_000);
    expect(c.precio.planPrecioId).toBe(1);
  });

  it('renovación anticipada: arranca al día siguiente del vencimiento', () => {
    const c = cotizarVenta({
      hoy: HOY,
      plan: mensual,
      precios,
      fechaFinAnterior: '2026-03-15',
    });

    expect(c.periodo.fechaInicio).toBe('2026-03-16');
    expect(c.periodo.encadenada).toBe(true);
  });

  it('renovación vencida: arranca hoy, los días vencidos no se regalan', () => {
    const c = cotizarVenta({
      hoy: HOY,
      plan: mensual,
      precios,
      fechaFinAnterior: '2026-03-01',
    });

    expect(c.periodo.fechaInicio).toBe(HOY);
    expect(c.periodo.encadenada).toBe(false);
  });

  it('el pase por sesión NO encadena aunque haya una mensualidad vigente', () => {
    const c = cotizarVenta({
      hoy: HOY,
      plan: sesion,
      precios,
      fechaFinAnterior: '2026-03-30',
    });

    expect(c.periodo.fechaInicio).toBe(HOY);
    expect(c.periodo.fechaFin).toBe(HOY);
    expect(c.precio.precioCentavos).toBe(2_000);
  });

  it('aplica la promoción vigente el día del pago', () => {
    const conPromo = [
      ...precios,
      precio({
        id: 3,
        precioCentavos: 15_000,
        vigenteDesde: '2026-03-01',
        vigenteHasta: '2026-03-31',
        esPromocion: true,
        etiqueta: 'Promo de marzo',
      }),
    ];

    const c = cotizarVenta({
      hoy: HOY,
      plan: mensual,
      precios: conPromo,
      fechaFinAnterior: null,
    });

    expect(c.precio.precioCentavos).toBe(15_000);
    expect(c.precio.etiqueta).toBe('Promo de marzo');
    expect(c.precio.descuentoCentavos).toBe(5_000);
  });

  it('el precio es el del día en que se paga, no el del día en que empieza', () => {
    // La promo termina el 12; el socio paga el 10 y su período nuevo arranca el 21.
    const conPromo = [
      ...precios,
      precio({
        id: 3,
        precioCentavos: 15_000,
        vigenteDesde: '2026-03-01',
        vigenteHasta: '2026-03-12',
        esPromocion: true,
      }),
    ];

    const c = cotizarVenta({
      hoy: HOY,
      plan: mensual,
      precios: conPromo,
      fechaFinAnterior: '2026-03-20',
    });

    expect(c.periodo.fechaInicio).toBe('2026-03-21');
    expect(c.precio.precioCentavos).toBe(15_000);
  });

  it('respeta la fecha de inicio que elige recepción', () => {
    const c = cotizarVenta({
      hoy: HOY,
      plan: mensual,
      precios,
      fechaFinAnterior: '2026-03-15',
      inicioForzado: '2026-03-23',
    });

    expect(c.periodo.fechaInicio).toBe('2026-03-23');
    expect(c.periodo.fechaFin).toBe('2026-04-21');
  });

  it('una fecha de inicio vacía es como no haberla elegido', () => {
    const c = cotizarVenta({
      hoy: HOY,
      plan: mensual,
      precios,
      fechaFinAnterior: null,
      inicioForzado: '  ',
    });
    expect(c.periodo.fechaInicio).toBe(HOY);
  });

  it('rechaza una fecha de inicio anterior a hoy', () => {
    expect(() =>
      cotizarVenta({
        hoy: HOY,
        plan: mensual,
        precios,
        fechaFinAnterior: null,
        inicioForzado: '2026-03-09',
      }),
    ).toThrow(ReglaDeNegocioError);
  });

  it('rechaza una fecha de inicio que no es una fecha', () => {
    expect(() =>
      cotizarVenta({
        hoy: HOY,
        plan: mensual,
        precios,
        fechaFinAnterior: null,
        inicioForzado: '2026-02-30',
      }),
    ).toThrow(ReglaDeNegocioError);
  });

  it('a un pase por sesión no se le puede elegir otra fecha', () => {
    expect(() =>
      cotizarVenta({
        hoy: HOY,
        plan: sesion,
        precios,
        fechaFinAnterior: null,
        inicioForzado: '2026-03-12',
      }),
    ).toThrow(ReglaDeNegocioError);
  });

  it('rechaza un plan que ya no se vende', () => {
    expect(() =>
      cotizarVenta({
        hoy: HOY,
        plan: { ...mensual, activo: false },
        precios,
        fechaFinAnterior: null,
      }),
    ).toThrow(/ya no se vende/);
  });
});
