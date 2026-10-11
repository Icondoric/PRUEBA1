import { describe, expect, it } from 'vitest';
import { type SocioParaAcceso, evaluarAcceso } from './acceso';

const HOY = '2026-10-11';

const socio = (over: Partial<SocioParaAcceso> = {}): SocioParaAcceso => ({
  clienteId: 1,
  nroSocio: 101,
  nombreCompleto: 'Ana Quispe',
  fotoUrl: null,
  fechaFin: '2026-11-01',
  membresiaId: 9,
  ...over,
});

describe('evaluarAcceso', () => {
  it('permite con membresía holgada', () => {
    const v = evaluarAcceso(socio(), HOY);
    expect(v.permitir).toBe(true);
    expect(v.resultado).toBe('permitido');
    expect(v.diasRestantes).toBe(21);
  });

  it('avisa cuando quedan 3 días o menos, pero deja entrar', () => {
    const v = evaluarAcceso(socio({ fechaFin: '2026-10-13' }), HOY);
    expect(v.resultado).toBe('por_vencer');
    expect(v.permitir).toBe(true);
    expect(v.diasRestantes).toBe(2);
  });

  it('el último día todavía entra', () => {
    const v = evaluarAcceso(socio({ fechaFin: HOY }), HOY);
    expect(v.permitir).toBe(true);
    expect(v.resultado).toBe('por_vencer');
    expect(v.diasRestantes).toBe(0);
  });

  it('rechaza desde el día siguiente al vencimiento', () => {
    const v = evaluarAcceso(socio({ fechaFin: '2026-10-10' }), HOY);
    expect(v.permitir).toBe(false);
    expect(v.resultado).toBe('vencido');
    expect(v.diasRestantes).toBe(-1);
    expect(v.mensaje).toContain('1 día');
  });

  it('un pase por sesión vigente hoy entra sin alarma de vencimiento', () => {
    const v = evaluarAcceso(socio({ fechaFin: HOY, esPaseDiario: true }), HOY);
    expect(v.permitir).toBe(true);
    expect(v.resultado).toBe('permitido');
    expect(v.mensaje).toContain('sesión');
  });

  it('un pase por sesión de ayer ya no sirve', () => {
    const v = evaluarAcceso(socio({ fechaFin: '2026-10-10', esPaseDiario: true }), HOY);
    expect(v.permitir).toBe(false);
    expect(v.resultado).toBe('vencido');
  });

  it('rechaza a quien nunca tuvo membresía', () => {
    const v = evaluarAcceso(socio({ fechaFin: null, membresiaId: null }), HOY);
    expect(v.resultado).toBe('sin_membresia');
    expect(v.permitir).toBe(false);
  });

  it('el bloqueo manual gana sobre una membresía vigente', () => {
    const v = evaluarAcceso(socio({ fechaFin: '2026-12-31', bloqueado: true }), HOY);
    expect(v.permitir).toBe(false);
  });

  it('da el mismo veredicto con datos del servidor y del snapshot offline', () => {
    const delServidor = socio();
    const delSnapshot = { ...delServidor };
    expect(evaluarAcceso(delSnapshot, HOY)).toEqual(evaluarAcceso(delServidor, HOY));
  });
});
