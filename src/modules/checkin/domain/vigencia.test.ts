import { describe, expect, it } from 'vitest';
import { vigenciaParaAcceso } from './vigencia';

const HOY = '2026-03-10';

let siguienteId = 1;
const m = (fechaInicio: string, fechaFin: string, esPaseDiario = false) => ({
  id: siguienteId++,
  fechaInicio,
  fechaFin,
  esPaseDiario,
});

describe('vigenciaParaAcceso', () => {
  it('sin membresías: nada', () => {
    expect(vigenciaParaAcceso([], HOY)).toEqual({
      fechaFin: null,
      membresiaId: null,
      esPaseDiario: false,
      proximaDesde: null,
    });
  });

  it('una vigente: esa', () => {
    const actual = m('2026-03-01', '2026-03-30');
    expect(vigenciaParaAcceso([actual], HOY)).toMatchObject({
      fechaFin: '2026-03-30',
      membresiaId: actual.id,
    });
  });

  it('vence hoy: todavía cuenta', () => {
    expect(vigenciaParaAcceso([m('2026-02-09', HOY)], HOY).fechaFin).toBe(HOY);
  });

  it('vencida: devuelve la última, para poder decir hace cuánto venció', () => {
    const vieja = m('2026-01-01', '2026-01-30');
    const ultima = m('2026-02-01', '2026-03-02');
    expect(vigenciaParaAcceso([vieja, ultima], HOY)).toMatchObject({
      fechaFin: '2026-03-02',
      membresiaId: ultima.id,
      proximaDesde: null,
    });
  });

  it('renovó por adelantado: cuenta hasta el final de la cadena', () => {
    const actual = m('2026-02-11', '2026-03-12');
    const renovacion = m('2026-03-13', '2026-04-11');
    expect(vigenciaParaAcceso([actual, renovacion], HOY)).toMatchObject({
      fechaFin: '2026-04-11', // no hay que avisarle que "vence en 2 días"
      membresiaId: actual.id,
    });
  });

  it('una cadena de tres se sigue hasta el final', () => {
    const v = vigenciaParaAcceso(
      [
        m('2026-02-11', '2026-03-12'),
        m('2026-03-13', '2026-04-11'),
        m('2026-04-12', '2026-05-11'),
      ],
      HOY,
    );
    expect(v.fechaFin).toBe('2026-05-11');
  });

  it('si hay un hueco, la cobertura termina antes del hueco', () => {
    const v = vigenciaParaAcceso(
      [m('2026-02-11', '2026-03-12'), m('2026-03-20', '2026-04-18')],
      HOY,
    );
    expect(v.fechaFin).toBe('2026-03-12');
  });

  it('pagó para arrancar el lunes y no tiene otra: hoy no entra', () => {
    expect(vigenciaParaAcceso([m('2026-03-16', '2026-04-14')], HOY)).toEqual({
      fechaFin: null,
      membresiaId: null,
      esPaseDiario: false,
      proximaDesde: '2026-03-16',
    });
  });

  it('vencido que ya pagó la próxima: informa las dos cosas', () => {
    const vencida = m('2026-02-01', '2026-03-02');
    expect(
      vigenciaParaAcceso([vencida, m('2026-03-16', '2026-04-14')], HOY),
    ).toMatchObject({
      fechaFin: '2026-03-02',
      membresiaId: vencida.id,
      proximaDesde: '2026-03-16',
    });
  });

  it('pase por sesión de hoy', () => {
    expect(vigenciaParaAcceso([m(HOY, HOY, true)], HOY)).toMatchObject({
      fechaFin: HOY,
      esPaseDiario: true,
    });
  });

  it('con mensualidad vigente y un pase de hoy, manda la mensualidad', () => {
    const mensual = m('2026-03-01', '2026-03-30');
    expect(vigenciaParaAcceso([m(HOY, HOY, true), mensual], HOY)).toMatchObject({
      fechaFin: '2026-03-30',
      membresiaId: mensual.id,
      esPaseDiario: false,
    });
  });

  it('pase de hoy y mensualidad que arranca mañana: ya no es solo un pase', () => {
    expect(
      vigenciaParaAcceso([m(HOY, HOY, true), m('2026-03-11', '2026-04-09')], HOY),
    ).toMatchObject({ fechaFin: '2026-04-09', esPaseDiario: false });
  });

  it('un pase de ayer no sirve hoy', () => {
    expect(vigenciaParaAcceso([m('2026-03-09', '2026-03-09', true)], HOY)).toMatchObject({
      fechaFin: '2026-03-09',
      esPaseDiario: false,
    });
  });
});
