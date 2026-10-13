/**
 * Test de API de pagos: historial, totales de caja y anulación.
 */

import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '@/lib/db';
import { membresias, pagos, planPrecios } from '@/lib/db/schema';
import { hoyEnZona, sumarDias } from '@/lib/fechas';
import { appConSesion, dbDePrueba, sembrarPlanes } from '@/test/db';

const hoy = hoyEnZona();

let db: DB;
let app: ReturnType<typeof appConSesion>;
let mensualId: number;
let sesionId: number;
let anaId: number;

const post = (ruta: string, body: Record<string, unknown>) =>
  app.request(ruta, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const vender = async (clienteId: number, planId: number, metodo = 'efectivo') =>
  (await (await post('/api/membresias', { clienteId, planId, metodo })).json()) as {
    membresia: { id: number };
    pago: { id: number };
  };

const anular = (pagoId: number, motivo: string) =>
  post(`/api/pagos/${pagoId}/anulacion`, { motivo });

beforeEach(async () => {
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

  anaId = (
    await (await post('/api/clientes', { nombre: 'Ana', apellido: 'Quispe' })).json()
  ).id;
});

describe('GET /api/pagos', () => {
  it('sin fechas muestra los pagos de hoy, con cliente y plan', async () => {
    await vender(anaId, mensualId, 'qr');

    const lista = await (await app.request('/api/pagos')).json();

    expect(lista).toMatchObject({ desde: hoy, hasta: hoy });
    expect(lista.pagos).toHaveLength(1);
    expect(lista.pagos[0]).toMatchObject({
      clienteNombreCompleto: 'Ana Quispe',
      planNombre: 'Mensual',
      montoCentavos: 20_000,
      metodo: 'qr',
      anulado: false,
    });
  });

  it('totaliza la caja por método', async () => {
    const beto = (await (await post('/api/clientes', { nombre: 'Beto' })).json()).id;
    await vender(anaId, mensualId, 'efectivo');
    await vender(beto, sesionId, 'efectivo');
    await post('/api/checkin/pase', { nombre: 'Carla', metodo: 'qr' });

    const { totales } = await (await app.request('/api/pagos')).json();

    expect(totales.totalCentavos).toBe(24_000);
    expect(totales.cantidad).toBe(3);
    expect(totales.porMetodo).toEqual([
      { metodo: 'efectivo', cantidad: 2, centavos: 22_000 },
      { metodo: 'qr', cantidad: 1, centavos: 2_000 },
      { metodo: 'transferencia', cantidad: 0, centavos: 0 },
      { metodo: 'tarjeta', cantidad: 0, centavos: 0 },
    ]);
  });

  it('filtra por rango de fechas y por método', async () => {
    const { pago } = await vender(anaId, mensualId, 'efectivo');
    db.update(pagos)
      .set({ fechaPago: sumarDias(hoy, -10) })
      .where(eq(pagos.id, pago.id))
      .run();
    const beto = (await (await post('/api/clientes', { nombre: 'Beto' })).json()).id;
    await vender(beto, sesionId, 'qr');

    const deHoy = await (await app.request('/api/pagos')).json();
    const delMes = await (
      await app.request(`/api/pagos?desde=${sumarDias(hoy, -30)}&hasta=${hoy}`)
    ).json();
    const soloQr = await (
      await app.request(`/api/pagos?desde=${sumarDias(hoy, -30)}&hasta=${hoy}&metodo=qr`)
    ).json();

    expect(deHoy.pagos).toHaveLength(1);
    expect(delMes.pagos).toHaveLength(2);
    expect(soloQr.pagos).toHaveLength(1);
    expect(soloQr.totales.totalCentavos).toBe(2_000);
  });

  it('422 si el rango está al revés', async () => {
    const res = await app.request(`/api/pagos?desde=${hoy}&hasta=${sumarDias(hoy, -1)}`);
    expect(res.status).toBe(422);
  });
});

describe('GET /api/pagos/de-cliente', () => {
  it('trae todos los pagos del cliente, sin límite de fechas', async () => {
    const { pago } = await vender(anaId, mensualId);
    db.update(pagos)
      .set({ fechaPago: sumarDias(hoy, -200) })
      .where(eq(pagos.id, pago.id))
      .run();

    const { pagos: lista } = await (
      await app.request(`/api/pagos/de-cliente?clienteId=${anaId}`)
    ).json();

    expect(lista).toHaveLength(1);
  });

  it('404 si el cliente no existe', async () => {
    expect((await app.request('/api/pagos/de-cliente?clienteId=9999')).status).toBe(404);
  });
});

describe('POST /api/pagos/:id/anulacion', () => {
  it('anula con motivo: no borra nada, y cancela la membresía que pagaba', async () => {
    const { pago, membresia } = await vender(anaId, mensualId);

    const res = await anular(pago.id, ' Se cargó el plan equivocado ');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      anulado: true,
      motivoAnulacion: 'Se cargó el plan equivocado',
      membresiaCancelada: true,
    });

    expect(db.select().from(pagos).all()).toHaveLength(1);
    expect(db.select().from(membresias).all()).toHaveLength(1);
    expect(
      db.select().from(membresias).where(eq(membresias.id, membresia.id)).get()?.estado,
    ).toBe('cancelada');
  });

  it('el pago anulado sigue en el historial pero ya no suma en la caja', async () => {
    const { pago } = await vender(anaId, mensualId);
    await anular(pago.id, 'Se cargó el plan equivocado');

    const lista = await (await app.request('/api/pagos')).json();

    expect(lista.pagos[0]).toMatchObject({ anulado: true });
    expect(lista.totales).toMatchObject({ totalCentavos: 0, cantidad: 0, anulados: 1 });
  });

  it('después de anular, el cliente ya no entra', async () => {
    const { pago } = await vender(anaId, mensualId);
    await anular(pago.id, 'Se cargó el plan equivocado');

    const ingreso = await (await post('/api/checkin', { identificador: '1' })).json();
    expect(ingreso.permitir).toBe(false);
  });

  it('después de anular, la venta correcta arranca hoy: la cancelada no encadena', async () => {
    const { pago } = await vender(anaId, mensualId);
    await anular(pago.id, 'Se cargó el plan equivocado');

    const { membresia } = (await (
      await post('/api/membresias', { clienteId: anaId, planId: mensualId, metodo: 'qr' })
    ).json()) as { membresia: { fechaInicio: string } };

    expect(membresia.fechaInicio).toBe(hoy);
  });

  it('exige el motivo', async () => {
    const { pago } = await vender(anaId, mensualId);

    expect((await anular(pago.id, '   ')).status).toBe(400);
    expect((await anular(pago.id, 'no')).status).toBe(422);
    expect(db.select().from(pagos).get()?.anulado).toBe(false);
  });

  it('409 si ya estaba anulado', async () => {
    const { pago } = await vender(anaId, mensualId);
    await anular(pago.id, 'Se cargó el plan equivocado');

    expect((await anular(pago.id, 'Otra vez por las dudas')).status).toBe(409);
  });

  it('404 si el pago no existe', async () => {
    expect((await anular(9999, 'Se cargó el plan equivocado')).status).toBe(404);
  });
});
