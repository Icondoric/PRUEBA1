import { describe, expect, it } from 'vitest';
import { coberturaDelCliente, estadoMembresia } from './estado';

const HOY = '2026-03-10';

const m = (
  fechaInicio: string,
  fechaFin: string,
  extra: { estado?: 'vigente' | 'cancelada' | 'congelada'; esPaseDiario?: boolean } = {},
) => ({
  fechaInicio,
  fechaFin,
  estado: extra.estado ?? ('vigente' as const),
  esPaseDiario: extra.esPaseDiario ?? false,
});

describe('estadoMembresia', () => {
  it('vence hoy: todavía está vigente', () => {
    expect(estadoMembresia(m('2026-02-09', HOY), HOY)).toBe('vigente');
  });

  it('venció ayer: vencida', () => {
    expect(estadoMembresia(m('2026-02-08', '2026-03-09'), HOY)).toBe('vencida');
  });

  it('empieza mañana: futura', () => {
    expect(estadoMembresia(m('2026-03-11', '2026-04-09'), HOY)).toBe('futura');
  });

  it('una cancelada sigue cancelada aunque las fechas digan otra cosa', () => {
    expect(
      estadoMembresia(m('2026-03-01', '2026-03-30', { estado: 'cancelada' }), HOY),
    ).toBe('cancelada');
  });
});

describe('coberturaDelCliente', () => {
  it('sin historial: sin membresía', () => {
    expect(coberturaDelCliente([], HOY).situacion).toBe('sin_membresia');
  });

  it('solo ventas canceladas: sin membresía', () => {
    const c = coberturaDelCliente(
      [m('2026-03-01', '2026-03-30', { estado: 'cancelada' })],
      HOY,
    );
    expect(c.situacion).toBe('sin_membresia');
  });

  it('vigente: dice hasta cuándo y cuántos días quedan', () => {
    const c = coberturaDelCliente([m('2026-03-01', '2026-03-30')], HOY);
    expect(c).toMatchObject({ situacion: 'vigente', hasta: '2026-03-30', dias: 20 });
  });

  it('renovó por adelantado: sigue vigente y cuenta el período encadenado', () => {
    const c = coberturaDelCliente(
      [m('2026-02-14', '2026-03-15'), m('2026-03-16', '2026-04-14')],
      HOY,
    );
    expect(c).toMatchObject({ situacion: 'vigente', hasta: '2026-04-14', dias: 35 });
  });

  it('vencida: los días son negativos', () => {
    const c = coberturaDelCliente([m('2026-02-01', '2026-03-02')], HOY);
    expect(c).toMatchObject({ situacion: 'vencida', hasta: '2026-03-02', dias: -8 });
  });

  it('pagó para arrancar el lunes: futura, con la fecha en que empieza', () => {
    const c = coberturaDelCliente([m('2026-03-16', '2026-04-14')], HOY);
    expect(c).toMatchObject({ situacion: 'futura', desde: '2026-03-16' });
  });

  it('pase por sesión de hoy: vigente y marcado como pase', () => {
    const c = coberturaDelCliente([m(HOY, HOY, { esPaseDiario: true })], HOY);
    expect(c).toMatchObject({ situacion: 'vigente', esPaseDiario: true, dias: 0 });
  });

  it('un pase viejo no tapa a la mensualidad vigente', () => {
    const c = coberturaDelCliente(
      [
        m('2026-03-01', '2026-03-30'),
        m('2026-02-20', '2026-02-20', { esPaseDiario: true }),
      ],
      HOY,
    );
    expect(c).toMatchObject({
      situacion: 'vigente',
      esPaseDiario: false,
      hasta: '2026-03-30',
    });
  });
});
