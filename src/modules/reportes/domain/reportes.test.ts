import { describe, expect, it } from 'vitest';
import { ReglaDeNegocioError } from '@/lib/errors';
import {
  asistenciaPorDiaDeSemana,
  clientesFrecuentesConPase,
  ingresosPorDia,
  pasesPorMes,
} from './actividad';
import {
  diaDeSemana,
  elegirMes,
  mesAnterior,
  primerDia,
  ultimoDia,
  ultimosMeses,
} from './calendario';
import { type CoberturaDeSocio, clasificarSocios, sociosNuevosPorMes } from './socios';

const HOY = '2026-03-10'; // martes

describe('calendario', () => {
  it('primer y último día del mes, incluido febrero y los bisiestos', () => {
    expect(primerDia('2026-03')).toBe('2026-03-01');
    expect(ultimoDia('2026-03')).toBe('2026-03-31');
    expect(ultimoDia('2026-02')).toBe('2026-02-28');
    expect(ultimoDia('2028-02')).toBe('2028-02-29');
    expect(ultimoDia('2026-12')).toBe('2026-12-31');
  });

  it('el mes anterior a enero es diciembre del año pasado', () => {
    expect(mesAnterior('2026-01')).toBe('2025-12');
  });

  it('los últimos 6 meses, del más viejo al más nuevo', () => {
    expect(ultimosMeses('2026-02-15', 6)).toEqual([
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });

  it('día de la semana: 0 es lunes y 6 es domingo', () => {
    expect(diaDeSemana('2026-03-09')).toBe(0);
    expect(diaDeSemana(HOY)).toBe(1);
    expect(diaDeSemana('2026-03-15')).toBe(6);
  });

  it('sin mes pedido, es el mes en curso', () => {
    expect(elegirMes(undefined, ['2026-02', '2026-03'])).toBe('2026-03');
  });

  it('rechaza un mes mal escrito o fuera del período', () => {
    expect(() => elegirMes('marzo', ['2026-03'])).toThrow(ReglaDeNegocioError);
    expect(() => elegirMes('2026-13', ['2026-03'])).toThrow(ReglaDeNegocioError);
    expect(() => elegirMes('2025-01', ['2026-03'])).toThrow(ReglaDeNegocioError);
  });
});

describe('clasificarSocios', () => {
  let id = 0;
  const socio = (cambios: Partial<CoberturaDeSocio>): CoberturaDeSocio => {
    id++;
    return {
      clienteId: id,
      nroSocio: id,
      nombreCompleto: `Socio ${id}`,
      telefono: null,
      fechaFin: '2026-03-30',
      proximaDesde: null,
      socioDesde: '2026-01-01',
      planNombre: 'Mensual',
      ...cambios,
    };
  };

  it('cuenta como activo al que vence hoy', () => {
    expect(clasificarSocios([socio({ fechaFin: HOY })], HOY).activos).toBe(1);
  });

  it('por vencer: los que vencen en 7 días o menos, el más urgente primero', () => {
    const r = clasificarSocios(
      [
        socio({ fechaFin: '2026-03-17' }), // 7 días: entra
        socio({ fechaFin: '2026-03-18' }), // 8 días: no
        socio({ fechaFin: HOY }), // hoy
      ],
      HOY,
    );

    expect(r.activos).toBe(3);
    expect(r.porVencer.map((s) => s.dias)).toEqual([0, 7]);
  });

  it('vencidos: recientes hasta 60 días, el resto solo se cuenta', () => {
    const r = clasificarSocios(
      [
        socio({ fechaFin: '2026-03-09' }), // ayer
        socio({ fechaFin: '2026-01-09' }), // 60 días: todavía reciente
        socio({ fechaFin: '2026-01-08' }), // 61 días: antiguo
      ],
      HOY,
    );

    expect(r.activos).toBe(0);
    expect(r.vencidosRecientes.map((s) => s.dias)).toEqual([1, 60]);
    expect(r.vencidosAntiguos).toBe(1);
  });

  it('un vencido que ya pagó la próxima no aparece para llamar', () => {
    const r = clasificarSocios(
      [socio({ fechaFin: '2026-03-05', proximaDesde: '2026-03-16' })],
      HOY,
    );

    expect(r.vencidosRecientes).toHaveLength(0);
    expect(r.vencidosAntiguos).toBe(0);
  });

  it('quien pagó pero todavía no empezó no es activo ni vencido', () => {
    const r = clasificarSocios(
      [socio({ fechaFin: null, proximaDesde: '2026-03-16' })],
      HOY,
    );

    expect(r).toMatchObject({ activos: 0, vencidosAntiguos: 0 });
    expect(r.porVencer).toHaveLength(0);
  });

  it('socios nuevos por mes: todos los meses, también los que dan cero', () => {
    const nuevos = sociosNuevosPorMes(
      [
        socio({ socioDesde: '2026-01-05' }),
        socio({ socioDesde: '2026-03-01' }),
        socio({ socioDesde: '2026-03-10' }),
      ],
      ['2026-01', '2026-02', '2026-03'],
    );

    expect(nuevos.map((n) => n.cantidad)).toEqual([1, 0, 2]);
  });
});

describe('ingresos y asistencia', () => {
  const conteos = [
    { fecha: '2026-03-09', resultado: 'permitido' as const, cantidad: 30 },
    { fecha: '2026-03-09', resultado: 'por_vencer' as const, cantidad: 2 },
    { fecha: '2026-03-09', resultado: 'vencido' as const, cantidad: 3 },
    { fecha: '2026-03-09', resultado: 'sin_membresia' as const, cantidad: 1 },
    { fecha: '2026-03-02', resultado: 'permitido' as const, cantidad: 20 },
  ];

  it('un renglón por día: "por vencer" entra, "vencido" y "sin membresía" rebotan', () => {
    const dias = ingresosPorDia(conteos, '2026-03-08', HOY);

    expect(dias).toEqual([
      { fecha: '2026-03-08', permitidos: 0, rechazados: 0 },
      { fecha: '2026-03-09', permitidos: 32, rechazados: 4 },
      { fecha: HOY, permitidos: 0, rechazados: 0 },
    ]);
  });

  it('asistencia por día de la semana: total y cuántas veces cayó ese día', () => {
    // del lunes 2 al domingo 15 de marzo: cada día cae dos veces
    const porDia = asistenciaPorDiaDeSemana(conteos, '2026-03-02', '2026-03-15');

    expect(porDia).toHaveLength(7);
    expect(porDia[0]).toEqual({ dia: 0, ingresos: 52, ocurrencias: 2 }); // lunes
    expect(porDia[6]).toEqual({ dia: 6, ingresos: 0, ocurrencias: 2 }); // domingo
  });
});

describe('pases', () => {
  const pase = (clienteId: number, fecha: string) => ({
    clienteId,
    nroSocio: clienteId,
    nombreCompleto: `Cliente ${clienteId}`,
    telefono: null,
    fecha,
  });

  it('pases vendidos por mes', () => {
    const porMes = pasesPorMes(
      [pase(1, '2026-02-03'), pase(1, '2026-03-01'), pase(2, '2026-03-09')],
      ['2026-01', '2026-02', '2026-03'],
    );
    expect(porMes.map((m) => m.cantidad)).toEqual([0, 1, 2]);
  });

  it('frecuentes: MÁS de 3 pases en el período; con 3 justos no alcanza', () => {
    const pases = [
      ...['2026-02-01', '2026-02-10', '2026-02-20', '2026-03-01'].map((f) => pase(1, f)),
      ...['2026-02-01', '2026-02-10', '2026-02-20'].map((f) => pase(2, f)),
    ];

    const frecuentes = clientesFrecuentesConPase(pases, '2026-01-01', new Set());

    expect(frecuentes).toHaveLength(1);
    expect(frecuentes[0]).toMatchObject({
      clienteId: 1,
      cantidad: 4,
      ultimoPase: '2026-03-01',
      yaEsSocio: false,
    });
  });

  it('los pases anteriores al período no cuentan', () => {
    const pases = ['2025-10-01', '2025-10-02', '2026-02-10', '2026-02-20'].map((f) =>
      pase(1, f),
    );
    expect(clientesFrecuentesConPase(pases, '2026-01-01', new Set())).toHaveLength(0);
  });

  it('marca al que ya es socio activo, para no ofrecerle lo que ya tiene', () => {
    const pases = ['2026-02-01', '2026-02-10', '2026-02-20', '2026-03-01'].map((f) =>
      pase(1, f),
    );
    const [frecuente] = clientesFrecuentesConPase(pases, '2026-01-01', new Set([1]));
    expect(frecuente?.yaEsSocio).toBe(true);
  });
});
