import { describe, expect, it } from 'vitest';
import { calcularPeriodo } from './renovacion';

const HOY = '2026-10-11';

describe('calcularPeriodo', () => {
  it('primera membresía: arranca hoy y dura los días del plan', () => {
    const p = calcularPeriodo({ hoy: HOY, diasDuracion: 30 });
    expect(p.fechaInicio).toBe('2026-10-11');
    expect(p.fechaFin).toBe('2026-11-09'); // 30 días contando el de inicio
    expect(p.encadenada).toBe(false);
  });

  it('renovación anticipada: encadena desde el día siguiente al vencimiento', () => {
    const p = calcularPeriodo({
      hoy: HOY,
      diasDuracion: 30,
      fechaFinAnterior: '2026-10-20', // le quedan 10 días
    });
    expect(p.fechaInicio).toBe('2026-10-21');
    expect(p.fechaFin).toBe('2026-11-19');
    expect(p.encadenada).toBe(true);
    expect(p.diasArrastrados).toBe(10);
  });

  it('renovación vencida: arranca hoy, no se regalan los días perdidos', () => {
    const p = calcularPeriodo({
      hoy: HOY,
      diasDuracion: 30,
      fechaFinAnterior: '2026-09-15',
    });
    expect(p.fechaInicio).toBe('2026-10-11');
    expect(p.encadenada).toBe(false);
    expect(p.diasArrastrados).toBe(0);
  });

  it('renueva el mismo día que vence: todavía puede entrenar hoy, arranca mañana', () => {
    const p = calcularPeriodo({
      hoy: HOY,
      diasDuracion: 30,
      fechaFinAnterior: HOY,
    });
    expect(p.fechaInicio).toBe('2026-10-12');
    expect(p.encadenada).toBe(true);
    expect(p.diasArrastrados).toBe(1);
  });

  it('venció ayer: no encadena', () => {
    const p = calcularPeriodo({
      hoy: HOY,
      diasDuracion: 30,
      fechaFinAnterior: '2026-10-10',
    });
    expect(p.fechaInicio).toBe(HOY);
    expect(p.encadenada).toBe(false);
  });

  it('plan diario: inicio y fin son el mismo día', () => {
    const p = calcularPeriodo({ hoy: HOY, diasDuracion: 1, encadenable: false });
    expect(p.fechaInicio).toBe('2026-10-11');
    expect(p.fechaFin).toBe('2026-10-11');
  });

  it('un pase diario NO se agenda para después de la mensualidad vigente', () => {
    const p = calcularPeriodo({
      hoy: HOY,
      diasDuracion: 1,
      fechaFinAnterior: '2026-10-30', // tiene mensualidad vigente
      encadenable: false,
    });
    expect(p.fechaInicio).toBe(HOY);
    expect(p.fechaFin).toBe(HOY);
    expect(p.encadenada).toBe(false);
  });

  it('dos pases diarios el mismo día no se empujan al día siguiente', () => {
    const p = calcularPeriodo({
      hoy: HOY,
      diasDuracion: 1,
      fechaFinAnterior: HOY, // ya compró uno hoy
      encadenable: false,
    });
    expect(p.fechaInicio).toBe(HOY);
  });

  it('una mensualidad sí sigue encadenando (no se rompió el caso normal)', () => {
    const p = calcularPeriodo({
      hoy: HOY,
      diasDuracion: 30,
      fechaFinAnterior: '2026-10-30',
      encadenable: true,
    });
    expect(p.fechaInicio).toBe('2026-10-31');
    expect(p.encadenada).toBe(true);
  });

  it('cruza fin de año sin romperse', () => {
    const p = calcularPeriodo({ hoy: '2026-12-20', diasDuracion: 30 });
    expect(p.fechaFin).toBe('2027-01-18');
  });

  it('cruza el 29 de febrero de un año bisiesto', () => {
    const p = calcularPeriodo({ hoy: '2028-02-20', diasDuracion: 30 });
    expect(p.fechaFin).toBe('2028-03-20'); // 2028 es bisiesto
  });

  it('inicio forzado gana sobre el encadenamiento', () => {
    const p = calcularPeriodo({
      hoy: HOY,
      diasDuracion: 30,
      fechaFinAnterior: '2026-10-20',
      inicioForzado: '2026-11-01',
    });
    expect(p.fechaInicio).toBe('2026-11-01');
    expect(p.fechaFin).toBe('2026-11-30');
    expect(p.encadenada).toBe(false);
  });

  it('rechaza una duración inválida', () => {
    expect(() => calcularPeriodo({ hoy: HOY, diasDuracion: 0 })).toThrow();
    expect(() => calcularPeriodo({ hoy: HOY, diasDuracion: 1.5 })).toThrow();
  });

  it('tres renovaciones anticipadas seguidas no pierden ni un día', () => {
    let fin: string | null = null;
    for (let i = 0; i < 3; i++) {
      const p = calcularPeriodo({ hoy: HOY, diasDuracion: 30, fechaFinAnterior: fin });
      fin = p.fechaFin;
    }
    // 90 días corridos desde hoy, sin huecos ni solapes
    expect(fin).toBe('2027-01-08');
  });
});
