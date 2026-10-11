/**
 * Test de API de membresías: rutas de verdad contra una base con las
 * migraciones reales. Las fechas son relativas a hoy porque las rutas leen el
 * reloj con `hoyEnZona()`.
 */

import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '@/lib/db';
import { membresias, pagos, planPrecios, planes, usuarios } from '@/lib/db/schema';
import { hoyEnZona, sumarDias } from '@/lib/fechas';
import { crearApp } from '@/server';
import { dbDePrueba, sembrarPlanes } from '@/test/db';

const hoy = hoyEnZona();

let db: DB;
let app: ReturnType<typeof crearApp>;
let mensualId: number;
let sesionId: number;
let clienteId: number;

beforeEach(async () => {
  db = dbDePrueba();
  app = crearApp(db);

  const [mensual, sesion] = sembrarPlanes(db);
  mensualId = mensual!.id;
  sesionId = sesion!.id;

  db.insert(planPrecios)
    .values([
      { planId: mensualId, precioCentavos: 20_000, vigenteDesde: sumarDias(hoy, -365) },
      { planId: sesionId, precioCentavos: 2_000, vigenteDesde: sumarDias(hoy, -365) },
    ])
    .run();

  const res = await app.request('/api/clientes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nombre: 'Ana', apellido: 'Quispe' }),
  });
  clienteId = (await res.json()).id;
});

const vender = (body: Record<string, unknown>) =>
  app.request('/api/membresias', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clienteId, metodo: 'efectivo', ...body }),
  });

const cotizar = (planId: number, inicio?: string) =>
  app.request(
    `/api/membresias/cotizacion?clienteId=${clienteId}&planId=${planId}` +
      (inicio ? `&inicio=${inicio}` : ''),
  );

/** Una membresía cargada directo, para simular historia vieja. */
const membresiaVieja = (fechaInicio: string, fechaFin: string, planId = mensualId) =>
  db
    .insert(membresias)
    .values({ clienteId, planId, fechaInicio, fechaFin, precioCentavos: 20_000 })
    .returning()
    .get();

describe('GET /api/planes', () => {
  it('lista los planes activos con el precio de hoy', async () => {
    const { planes: lista, hoy: fecha } = await (await app.request('/api/planes')).json();

    expect(fecha).toBe(hoy);
    expect(lista).toHaveLength(2);
    expect(lista[0]).toMatchObject({
      nombre: 'Mensual',
      precio: { precioCentavos: 20_000 },
    });
  });

  it('muestra la promo vigente y cuánto se ahorra', async () => {
    db.insert(planPrecios)
      .values({
        planId: mensualId,
        precioCentavos: 15_000,
        vigenteDesde: sumarDias(hoy, -2),
        vigenteHasta: sumarDias(hoy, 5),
        esPromocion: true,
        etiqueta: 'Promo aniversario',
      })
      .run();

    const { planes: lista } = await (await app.request('/api/planes')).json();

    expect(lista[0].precio).toMatchObject({
      precioCentavos: 15_000,
      esPromocion: true,
      etiqueta: 'Promo aniversario',
      descuentoCentavos: 5_000,
    });
  });

  it('un plan sin precio vigente aparece marcado, no desaparece', async () => {
    db.insert(planes).values({ nombre: 'Trimestral', diasDuracion: 90 }).run();

    const { planes: lista } = await (await app.request('/api/planes')).json();
    const trimestral = lista.find((p: { nombre: string }) => p.nombre === 'Trimestral');

    expect(trimestral.precio).toBeNull();
  });

  it('no ofrece los planes dados de baja', async () => {
    db.update(planes).set({ activo: false }).where(eq(planes.id, sesionId)).run();

    const { planes: lista } = await (await app.request('/api/planes')).json();
    expect(lista).toHaveLength(1);
  });
});

describe('GET /api/membresias/cotizacion', () => {
  it('muestra período y precio sin guardar nada', async () => {
    const res = await cotizar(mensualId);
    expect(res.status).toBe(200);

    expect(await res.json()).toMatchObject({
      fechaInicio: hoy,
      fechaFin: sumarDias(hoy, 29),
      precioCentavos: 20_000,
      encadenada: false,
    });
    expect(db.select().from(membresias).all()).toHaveLength(0);
    expect(db.select().from(pagos).all()).toHaveLength(0);
  });

  it('avisa que encadena y cuántos días arrastra', async () => {
    membresiaVieja(sumarDias(hoy, -20), sumarDias(hoy, 9));

    expect(await (await cotizar(mensualId)).json()).toMatchObject({
      fechaInicio: sumarDias(hoy, 10),
      encadenada: true,
      diasArrastrados: 10,
      fechaFinAnterior: sumarDias(hoy, 9),
    });
  });

  it('rechaza una fecha de inicio pasada con 422 y el campo', async () => {
    const res = await cotizar(mensualId, sumarDias(hoy, -1));

    expect(res.status).toBe(422);
    expect((await res.json()).detalles.campo).toBe('inicio');
  });

  it('404 si el plan no existe', async () => {
    expect((await cotizar(9999)).status).toBe(404);
  });
});

describe('POST /api/membresias', () => {
  it('primera venta: crea la membresía y su pago por el mismo monto', async () => {
    const res = await vender({ planId: mensualId, metodo: 'qr', nota: ' pagó con QR ' });
    expect(res.status).toBe(201);

    const { membresia, pago } = await res.json();
    expect(membresia).toMatchObject({
      clienteId,
      fechaInicio: hoy,
      fechaFin: sumarDias(hoy, 29),
      precioCentavos: 20_000,
      planNombre: 'Mensual',
    });
    expect(pago).toMatchObject({ montoCentavos: 20_000, metodo: 'qr' });

    const [guardado] = db.select().from(pagos).all();
    expect(guardado).toMatchObject({
      membresiaId: membresia.id,
      fechaPago: hoy,
      nota: 'pagó con QR',
      anulado: false,
    });
  });

  it('deja registrado quién la cargó, en la membresía y en el pago', async () => {
    await vender({ planId: mensualId });

    const [operador] = db.select().from(usuarios).all();
    const [membresia] = db.select().from(membresias).all();
    const [pago] = db.select().from(pagos).all();

    expect(operador?.usuario).toBe('recepcion');
    expect(membresia?.creadoPor).toBe(operador?.id);
    expect(pago?.registradoPor).toBe(operador?.id);
  });

  it('renovación anticipada: fila NUEVA encadenada, la anterior queda intacta', async () => {
    const anterior = membresiaVieja(sumarDias(hoy, -20), sumarDias(hoy, 9));

    const { membresia } = await (await vender({ planId: mensualId })).json();

    expect(membresia.id).not.toBe(anterior.id);
    expect(membresia.fechaInicio).toBe(sumarDias(hoy, 10));
    expect(membresia.fechaFin).toBe(sumarDias(hoy, 39));

    const sinTocar = db
      .select()
      .from(membresias)
      .where(eq(membresias.id, anterior.id))
      .get();
    expect(sinTocar).toEqual(anterior);
    expect(db.select().from(membresias).all()).toHaveLength(2);
  });

  it('renovación vencida: arranca hoy', async () => {
    membresiaVieja(sumarDias(hoy, -40), sumarDias(hoy, -11));

    const { membresia } = await (await vender({ planId: mensualId })).json();
    expect(membresia.fechaInicio).toBe(hoy);
  });

  it('una venta cancelada no cuenta para encadenar', async () => {
    const cancelada = membresiaVieja(sumarDias(hoy, -5), sumarDias(hoy, 24));
    db.update(membresias)
      .set({ estado: 'cancelada' })
      .where(eq(membresias.id, cancelada.id))
      .run();

    const { membresia } = await (await vender({ planId: mensualId })).json();
    expect(membresia.fechaInicio).toBe(hoy);
  });

  it('el pase por sesión vale hoy aunque haya mensualidad vigente', async () => {
    membresiaVieja(sumarDias(hoy, -5), sumarDias(hoy, 24));

    const { membresia } = await (await vender({ planId: sesionId })).json();

    expect(membresia.fechaInicio).toBe(hoy);
    expect(membresia.fechaFin).toBe(hoy);
    expect(membresia.precioCentavos).toBe(2_000);
  });

  it('pase hoy y mensualidad el mismo día: la mensualidad arranca mañana', async () => {
    await vender({ planId: sesionId });

    const { membresia } = await (await vender({ planId: mensualId })).json();
    expect(membresia.fechaInicio).toBe(sumarDias(hoy, 1));
  });

  it('cobra la promo y guarda qué precio se aplicó', async () => {
    const promo = db
      .insert(planPrecios)
      .values({
        planId: mensualId,
        precioCentavos: 15_000,
        vigenteDesde: hoy,
        vigenteHasta: hoy,
        esPromocion: true,
      })
      .returning()
      .get();

    const { membresia, pago } = await (await vender({ planId: mensualId })).json();

    expect(membresia.precioCentavos).toBe(15_000);
    expect(membresia.planPrecioId).toBe(promo.id);
    expect(pago.montoCentavos).toBe(15_000);
  });

  it('el precio cobrado queda congelado aunque después cambie el del plan', async () => {
    const { membresia } = await (await vender({ planId: mensualId })).json();

    db.insert(planPrecios)
      .values({ planId: mensualId, precioCentavos: 25_000, vigenteDesde: hoy })
      .run();

    const guardada = db
      .select()
      .from(membresias)
      .where(eq(membresias.id, membresia.id))
      .get();
    expect(guardada?.precioCentavos).toBe(20_000);
  });

  it('ignora un precio que mande el navegador', async () => {
    const { membresia } = await (
      await vender({ planId: mensualId, precioCentavos: 1 })
    ).json();
    expect(membresia.precioCentavos).toBe(20_000);
  });

  it('respeta la fecha de inicio elegida', async () => {
    const lunes = sumarDias(hoy, 4);
    const { membresia } = await (
      await vender({ planId: mensualId, inicio: lunes })
    ).json();

    expect(membresia.fechaInicio).toBe(lunes);
    expect(membresia.fechaFin).toBe(sumarDias(lunes, 29));
  });

  it('404 si el cliente no existe, y no guarda nada', async () => {
    const res = await vender({ clienteId: 9999, planId: mensualId });

    expect(res.status).toBe(404);
    expect(db.select().from(membresias).all()).toHaveLength(0);
  });

  it('422 si el plan está dado de baja', async () => {
    db.update(planes).set({ activo: false }).where(eq(planes.id, mensualId)).run();

    const res = await vender({ planId: mensualId });
    expect(res.status).toBe(422);
    expect((await res.json()).mensaje).toMatch(/ya no se vende/);
  });

  it('422 si el cliente está dado de baja', async () => {
    await app.request(`/api/clientes/${clienteId}`, { method: 'DELETE' });

    expect((await vender({ planId: mensualId })).status).toBe(422);
  });

  it('400 si falta el método de pago o es uno que no existe', async () => {
    const res = await vender({ planId: mensualId, metodo: 'cheque' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/membresias?clienteId=', () => {
  it('sin compras: sin membresía y lista vacía', async () => {
    const res = await app.request(`/api/membresias?clienteId=${clienteId}`);

    expect(await res.json()).toMatchObject({
      cobertura: { situacion: 'sin_membresia' },
      membresias: [],
    });
  });

  it('devuelve el historial con el estado calculado, lo más nuevo primero', async () => {
    membresiaVieja(sumarDias(hoy, -40), sumarDias(hoy, -11));
    await vender({ planId: mensualId });

    const { cobertura, membresias: lista } = await (
      await app.request(`/api/membresias?clienteId=${clienteId}`)
    ).json();

    expect(cobertura).toMatchObject({
      situacion: 'vigente',
      hasta: sumarDias(hoy, 29),
      dias: 29,
    });
    expect(lista.map((m: { estado: string }) => m.estado)).toEqual([
      'vigente',
      'vencida',
    ]);
    expect(lista[0].planNombre).toBe('Mensual');
  });

  it('404 si el cliente no existe', async () => {
    expect((await app.request('/api/membresias?clienteId=9999')).status).toBe(404);
  });
});
