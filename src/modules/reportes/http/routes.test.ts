/**
 * Test de API de reportes, contra una base con las migraciones reales.
 */

import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '@/lib/db';
import { ingresos, membresias, pagos, planPrecios } from '@/lib/db/schema';
import { hoyEnZona, sumarDias } from '@/lib/fechas';
import { appConSesion, dbDePrueba, sembrarPlanes } from '@/test/db';

const hoy = hoyEnZona();

let db: DB;
let app: ReturnType<typeof appConSesion>;
let mensualId: number;
let sesionId: number;

const post = (ruta: string, body: Record<string, unknown>) =>
  app.request(ruta, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const alta = async (nombre: string) =>
  ((await (await post('/api/clientes', { nombre })).json()) as { id: number }).id;

const membresia = (
  clienteId: number,
  fechaInicio: string,
  fechaFin: string,
  planId = mensualId,
) =>
  db
    .insert(membresias)
    .values({ clienteId, planId, fechaInicio, fechaFin, precioCentavos: 20_000 })
    .returning()
    .get();

const reporte = async (consulta = '') =>
  (await app.request(`/api/reportes${consulta}`)).json();

beforeEach(() => {
  db = dbDePrueba();
  app = appConSesion(db);
  const [mensual, sesion] = sembrarPlanes(db);
  mensualId = mensual!.id;
  sesionId = sesion!.id;
  db.insert(planPrecios)
    .values([
      { planId: mensualId, precioCentavos: 20_000, vigenteDesde: sumarDias(hoy, -365) },
      { planId: sesionId, precioCentavos: 2_000, vigenteDesde: sumarDias(hoy, -365) },
    ])
    .run();
});

describe('GET /api/reportes', () => {
  it('con la base vacía responde todo en cero, sin romperse', async () => {
    const r = await reporte();

    expect(r.hoyEnNumeros).toEqual({
      sociosActivos: 0,
      ingresos: 0,
      rechazados: 0,
      cobradoCentavos: 0,
    });
    expect(r.meses).toHaveLength(6);
    expect(r.cobradoPorMes).toHaveLength(6);
    expect(r.porVencer.socios).toEqual([]);
    expect(r.pases.frecuentes).toEqual([]);
  });

  it('los pases NO cuentan como socios activos', async () => {
    const socio = await alta('Socio');
    membresia(socio, sumarDias(hoy, -5), sumarDias(hoy, 24));
    const eventual = await alta('Eventual');
    membresia(eventual, hoy, hoy, sesionId);

    expect((await reporte()).hoyEnNumeros.sociosActivos).toBe(1);
  });

  it('lista a quien vence esta semana, con el plan y los días', async () => {
    const ana = await alta('Ana');
    membresia(ana, sumarDias(hoy, -27), sumarDias(hoy, 2));
    const beto = await alta('Beto');
    membresia(beto, sumarDias(hoy, -10), sumarDias(hoy, 19));

    const { porVencer } = await reporte();

    expect(porVencer.socios).toHaveLength(1);
    expect(porVencer.socios[0]).toMatchObject({
      nombreCompleto: 'Ana',
      planNombre: 'Mensual',
      fechaFin: sumarDias(hoy, 2),
      dias: 2,
    });
  });

  it('quien ya renovó por adelantado no aparece como por vencer', async () => {
    const ana = await alta('Ana');
    membresia(ana, sumarDias(hoy, -27), sumarDias(hoy, 2));
    membresia(ana, sumarDias(hoy, 3), sumarDias(hoy, 32));

    const r = await reporte();

    expect(r.porVencer.socios).toHaveLength(0);
    expect(r.hoyEnNumeros.sociosActivos).toBe(1);
  });

  it('separa vencidos recientes de antiguos', async () => {
    membresia(await alta('Reciente'), sumarDias(hoy, -40), sumarDias(hoy, -11));
    membresia(await alta('Antiguo'), sumarDias(hoy, -130), sumarDias(hoy, -101));

    const { vencidos } = await reporte();

    expect(
      vencidos.recientes.map((s: { nombreCompleto: string }) => s.nombreCompleto),
    ).toEqual(['Reciente']);
    expect(vencidos.recientes[0].dias).toBe(11);
    expect(vencidos.antiguos).toBe(1);
  });

  it('una membresía cancelada no hace a nadie activo', async () => {
    const ana = await alta('Ana');
    const m = membresia(ana, sumarDias(hoy, -5), sumarDias(hoy, 24));
    db.update(membresias)
      .set({ estado: 'cancelada' })
      .where(eq(membresias.id, m.id))
      .run();

    expect((await reporte()).hoyEnNumeros.sociosActivos).toBe(0);
  });

  it('un cliente dado de baja no aparece en los reportes', async () => {
    const ana = await alta('Ana');
    membresia(ana, sumarDias(hoy, -27), sumarDias(hoy, 2));
    await app.request(`/api/clientes/${ana}`, { method: 'DELETE' });

    const r = await reporte();
    expect(r.hoyEnNumeros.sociosActivos).toBe(0);
    expect(r.porVencer.socios).toHaveLength(0);
  });

  it('cobrado del mes por método; los anulados no suman', async () => {
    const ana = await alta('Ana');
    const beto = await alta('Beto');
    await post('/api/membresias', {
      clienteId: ana,
      planId: mensualId,
      metodo: 'efectivo',
    });
    const { pago } = (await (
      await post('/api/membresias', { clienteId: beto, planId: mensualId, metodo: 'qr' })
    ).json()) as { pago: { id: number } };
    await post(`/api/pagos/${pago.id}/anulacion`, { motivo: 'Se cobró dos veces' });

    const r = await reporte();
    const esteMes = r.cobradoPorMes.at(-1);

    expect(esteMes).toMatchObject({
      mes: hoy.slice(0, 7),
      totalCentavos: 20_000,
      anulados: 1,
    });
    expect(esteMes.porMetodo[0]).toEqual({
      metodo: 'efectivo',
      cantidad: 1,
      centavos: 20_000,
    });
    expect(r.hoyEnNumeros.cobradoCentavos).toBe(20_000);
  });

  it('cuenta los ingresos de hoy: los que entraron y los rebotados', async () => {
    const ana = await alta('Ana');
    membresia(ana, sumarDias(hoy, -5), sumarDias(hoy, 24));
    await alta('Sin membresía');

    await post('/api/checkin', { identificador: '1' });
    await post('/api/checkin', { identificador: '2' });
    await post('/api/checkin', { identificador: '2' });

    const r = await reporte();

    expect(r.hoyEnNumeros).toMatchObject({ ingresos: 1, rechazados: 2 });
    expect(r.ingresosPorDia.at(-1)).toEqual({ fecha: hoy, permitidos: 1, rechazados: 2 });
  });

  it('el mes en curso se muestra hasta hoy, no hasta fin de mes', async () => {
    const r = await reporte();

    expect(r.ingresosPorDia[0].fecha).toBe(`${hoy.slice(0, 7)}-01`);
    expect(r.ingresosPorDia.at(-1).fecha).toBe(hoy);
  });

  it('se puede pedir un mes anterior, completo', async () => {
    const { meses } = await reporte();
    const anterior = meses.at(-2);

    const r = await reporte(`?mes=${anterior}`);

    expect(r.mes).toBe(anterior);
    expect(r.ingresosPorDia[0].fecha).toBe(`${anterior}-01`);
    expect(r.ingresosPorDia.length).toBeGreaterThanOrEqual(28);
  });

  it('422 si el mes está fuera del período', async () => {
    expect((await app.request('/api/reportes?mes=2020-01')).status).toBe(422);
  });

  it('asistencia: los siete días de la semana, cada uno contado 8 veces', async () => {
    const ana = await alta('Ana');
    db.insert(ingresos)
      .values({ clienteId: ana, fecha: sumarDias(hoy, -7), resultado: 'permitido' })
      .run();

    const { asistencia } = await reporte();

    expect(asistencia.porDiaDeSemana).toHaveLength(7);
    expect(
      asistencia.porDiaDeSemana.every(
        (d: { ocurrencias: number }) => d.ocurrencias === 8,
      ),
    ).toBe(true);
    expect(
      asistencia.porDiaDeSemana.reduce(
        (total: number, d: { ingresos: number }) => total + d.ingresos,
        0,
      ),
    ).toBe(1);
  });

  it('pases: cuántos se vendieron y quién vino más de 3 veces', async () => {
    const frecuente = await alta('Frecuente');
    for (const hace of [20, 15, 10, 5]) {
      membresia(frecuente, sumarDias(hoy, -hace), sumarDias(hoy, -hace), sesionId);
    }
    const ocasional = await alta('Ocasional');
    membresia(ocasional, sumarDias(hoy, -3), sumarDias(hoy, -3), sesionId);

    const { pases, sociosNuevosPorMes } = await reporte();

    expect(pases.frecuentes).toHaveLength(1);
    expect(pases.frecuentes[0]).toMatchObject({
      nombreCompleto: 'Frecuente',
      cantidad: 4,
      yaEsSocio: false,
    });
    const vendidos = pases.porMes.reduce(
      (total: number, m: { cantidad: number }) => total + m.cantidad,
      0,
    );
    expect(vendidos).toBe(5);
    // comprar pases no hace socio a nadie
    expect(
      sociosNuevosPorMes.reduce(
        (total: number, m: { cantidad: number }) => total + m.cantidad,
        0,
      ),
    ).toBe(0);
  });

  it('socios nuevos: cuenta en el mes de su primera membresía de plan', async () => {
    const ana = await alta('Ana');
    membresia(ana, sumarDias(hoy, -1), sumarDias(hoy, 28));
    membresia(ana, sumarDias(hoy, 29), sumarDias(hoy, 58)); // renovar no lo hace "nuevo" otra vez

    const { sociosNuevosPorMes } = await reporte();
    const total = sociosNuevosPorMes.reduce(
      (suma: number, m: { cantidad: number }) => suma + m.cantidad,
      0,
    );

    expect(total).toBe(1);
  });

  it('ignora un pago que no es de este período', async () => {
    const ana = await alta('Ana');
    const { pago } = (await (
      await post('/api/membresias', {
        clienteId: ana,
        planId: mensualId,
        metodo: 'efectivo',
      })
    ).json()) as { pago: { id: number } };
    db.update(pagos)
      .set({ fechaPago: sumarDias(hoy, -400) })
      .where(eq(pagos.id, pago.id))
      .run();

    const r = await reporte();
    const total = r.cobradoPorMes.reduce(
      (suma: number, m: { totalCentavos: number }) => suma + m.totalCentavos,
      0,
    );
    expect(total).toBe(0);
  });
});
