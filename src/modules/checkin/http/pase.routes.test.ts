/**
 * Test de API de la venta rápida de un pase desde el mostrador.
 */

import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '@/lib/db';
import {
  clientes,
  ingresos,
  membresias,
  pagos,
  planPrecios,
  planes,
} from '@/lib/db/schema';
import { hoyEnZona, sumarDias } from '@/lib/fechas';
import { crearApp } from '@/server';
import { dbDePrueba, sembrarPlanes } from '@/test/db';

const hoy = hoyEnZona();

let db: DB;
let app: ReturnType<typeof crearApp>;
let mensualId: number;
let sesionId: number;

beforeEach(() => {
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
});

const post = (ruta: string, body: Record<string, unknown>) =>
  app.request(ruta, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const venderPase = (body: Record<string, unknown>) =>
  post('/api/checkin/pase', { metodo: 'efectivo', ...body });

const alta = async (datos: Record<string, unknown>) =>
  (await (await post('/api/clientes', datos)).json()) as { id: number; nroSocio: number };

describe('GET /api/checkin/pase', () => {
  it('dice qué pase se vende hoy y a cuánto', async () => {
    const { pase } = await (await app.request('/api/checkin/pase')).json();
    expect(pase).toMatchObject({ id: sesionId, precio: { precioCentavos: 2_000 } });
  });

  it('null si no hay ningún pase con precio', async () => {
    db.update(planes).set({ activo: false }).where(eq(planes.id, sesionId)).run();

    const { pase } = await (await app.request('/api/checkin/pase')).json();
    expect(pase).toBeNull();
  });
});

describe('POST /api/checkin/pase', () => {
  it('alguien nuevo: con el nombre alcanza. Crea cliente, membresía, pago e ingreso', async () => {
    const res = await venderPase({ nombre: 'Marcelo', metodo: 'qr' });
    expect(res.status).toBe(201);

    expect(await res.json()).toMatchObject({
      encontrado: true,
      permitir: true,
      resultado: 'permitido',
      mensaje: 'Pase por sesión — válido hoy',
      esClienteNuevo: true,
      socio: { nombreCompleto: 'Marcelo' },
    });

    const [cliente] = db.select().from(clientes).all();
    const [membresia] = db.select().from(membresias).all();
    const [pago] = db.select().from(pagos).all();
    const [ingreso] = db.select().from(ingresos).all();

    expect(cliente).toMatchObject({ nombre: 'Marcelo', apellido: null, ci: null });
    expect(membresia).toMatchObject({
      clienteId: cliente!.id,
      planId: sesionId,
      fechaInicio: hoy,
      fechaFin: hoy,
      precioCentavos: 2_000,
    });
    expect(pago).toMatchObject({
      membresiaId: membresia!.id,
      montoCentavos: 2_000,
      metodo: 'qr',
    });
    expect(pago?.registradoPor).not.toBeNull();
    expect(ingreso).toMatchObject({ clienteId: cliente!.id, resultado: 'permitido' });
  });

  it('un socio vencido: no se duplica, se le vende a él', async () => {
    const ana = await alta({ nombre: 'Ana', apellido: 'Quispe' });
    db.insert(membresias)
      .values({
        clienteId: ana.id,
        planId: mensualId,
        fechaInicio: sumarDias(hoy, -40),
        fechaFin: sumarDias(hoy, -11),
        precioCentavos: 20_000,
      })
      .run();

    const r = await (await venderPase({ clienteId: ana.id })).json();

    expect(r).toMatchObject({
      permitir: true,
      esClienteNuevo: false,
      socio: { clienteId: ana.id },
    });
    expect(db.select().from(clientes).all()).toHaveLength(1);
  });

  it('alguien que ya puede entrar hoy no necesita un pase: no se le cobra', async () => {
    const ana = await alta({ nombre: 'Ana' });
    db.insert(membresias)
      .values({
        clienteId: ana.id,
        planId: mensualId,
        fechaInicio: sumarDias(hoy, -5),
        fechaFin: sumarDias(hoy, 24),
        precioCentavos: 20_000,
      })
      .run();

    const res = await venderPase({ clienteId: ana.id });

    expect(res.status).toBe(422);
    expect((await res.json()).mensaje).toMatch(/ya puede entrar hoy/);
    expect(db.select().from(pagos).all()).toHaveLength(0);
  });

  it('dos pases el mismo día para la misma persona: el segundo se rechaza', async () => {
    const primero = await (await venderPase({ nombre: 'Marcelo' })).json();

    const res = await venderPase({ clienteId: primero.socio.clienteId });
    expect(res.status).toBe(422);
    expect(db.select().from(pagos).all()).toHaveLength(1);
  });

  it('a un bloqueado no se le vende', async () => {
    const ana = await alta({ nombre: 'Ana' });
    db.update(clientes).set({ bloqueado: true }).where(eq(clientes.id, ana.id)).run();

    const res = await venderPase({ clienteId: ana.id });

    expect(res.status).toBe(422);
    expect((await res.json()).mensaje).toMatch(/bloqueado/);
    expect(db.select().from(pagos).all()).toHaveLength(0);
  });

  it('sin nombre y sin cliente: 422, y no crea ni cobra nada', async () => {
    const res = await venderPase({ nombre: ' ' });

    expect(res.status).toBe(422);
    expect(db.select().from(clientes).all()).toHaveLength(0);
    expect(db.select().from(pagos).all()).toHaveLength(0);
  });

  it('si no hay un pase con precio, avisa y no crea al cliente', async () => {
    db.update(planes).set({ activo: false }).where(eq(planes.id, sesionId)).run();

    const res = await venderPase({ nombre: 'Marcelo' });

    expect(res.status).toBe(422);
    expect(db.select().from(clientes).all()).toHaveLength(0);
  });

  it('404 si el cliente no existe', async () => {
    expect((await venderPase({ clienteId: 9999 })).status).toBe(404);
  });

  it('400 si no se dice cómo pagó', async () => {
    const res = await post('/api/checkin/pase', { nombre: 'Marcelo' });
    expect(res.status).toBe(400);
  });
});
