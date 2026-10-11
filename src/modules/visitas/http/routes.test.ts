/**
 * Test de API de visitas (entradas gratis).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '@/lib/db';
import { clientes, pagos, visitas } from '@/lib/db/schema';
import { hoyEnZona, sumarDias } from '@/lib/fechas';
import { crearApp } from '@/server';
import { dbDePrueba } from '@/test/db';

const hoy = hoyEnZona();

let db: DB;
let app: ReturnType<typeof crearApp>;

const post = (ruta: string, body: Record<string, unknown>) =>
  app.request(ruta, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const registrar = (body: Record<string, unknown>) =>
  post('/api/visitas', { motivo: 'cortesia', ...body });

beforeEach(() => {
  db = dbDePrueba();
  app = crearApp(db);
});

describe('POST /api/visitas', () => {
  it('registra una cortesía con el nombre: no crea cliente ni pago', async () => {
    const res = await registrar({
      nombre: '  Luis Rojas ',
      nota: 'Invitación del dueño',
    });
    expect(res.status).toBe(201);

    expect(await res.json()).toMatchObject({
      nombre: 'Luis Rojas',
      motivo: 'cortesia',
      fecha: hoy,
      nota: 'Invitación del dueño',
    });
    expect(db.select().from(clientes).all()).toHaveLength(0);
    expect(db.select().from(pagos).all()).toHaveLength(0);
  });

  it('deja registrado quién la cargó', async () => {
    await registrar({ nombre: 'Luis' });
    expect(db.select().from(visitas).get()?.registradoPor).not.toBeNull();
  });

  it('acompañante: queda enlazado al socio que lo trajo', async () => {
    const ana = await (
      await post('/api/clientes', { nombre: 'Ana', apellido: 'Quispe', ci: '1234567' })
    ).json();

    const visita = await (
      await registrar({ nombre: 'Luis', motivo: 'acompanante', invitadoPor: '1.234.567' })
    ).json();

    expect(visita).toMatchObject({
      invitadoPorClienteId: ana.id,
      anfitrion: 'Ana Quispe',
    });
  });

  it('un acompañante sin socio al que acompaña se rechaza', async () => {
    const res = await registrar({ nombre: 'Luis', motivo: 'acompanante' });

    expect(res.status).toBe(422);
    expect((await res.json()).detalles.campo).toBe('invitadoPor');
  });

  it('si el número de quien invita no es de nadie, avisa', async () => {
    const res = await registrar({ nombre: 'Luis', invitadoPor: '9999' });

    expect(res.status).toBe(422);
    expect((await res.json()).detalles.campo).toBe('invitadoPor');
    expect(db.select().from(visitas).all()).toHaveLength(0);
  });

  it('422 sin nombre', async () => {
    expect((await registrar({ nombre: ' ' })).status).toBe(422);
  });

  it('400 con un motivo que no existe', async () => {
    expect((await registrar({ nombre: 'Luis', motivo: 'regalo' })).status).toBe(400);
  });
});

describe('GET /api/visitas', () => {
  it('sin fechas muestra el último mes, lo más nuevo primero', async () => {
    db.insert(visitas)
      .values([
        { nombre: 'Vieja', fecha: sumarDias(hoy, -60) },
        { nombre: 'De hace poco', fecha: sumarDias(hoy, -3) },
      ])
      .run();
    await registrar({ nombre: 'De hoy' });

    const lista = await (await app.request('/api/visitas')).json();

    expect(lista).toMatchObject({ desde: sumarDias(hoy, -30), hasta: hoy });
    expect(lista.visitas.map((v: { nombre: string }) => v.nombre)).toEqual([
      'De hoy',
      'De hace poco',
    ]);
  });

  it('muestra quién invitó', async () => {
    await post('/api/clientes', { nombre: 'Ana', apellido: 'Quispe' });
    await registrar({ nombre: 'Luis', motivo: 'acompanante', invitadoPor: '1' });

    const { visitas: lista } = await (await app.request('/api/visitas')).json();

    expect(lista[0].anfitrion).toEqual({ nombreCompleto: 'Ana Quispe', nroSocio: 1 });
  });

  it('con fechas, respeta el rango', async () => {
    db.insert(visitas)
      .values({ nombre: 'Vieja', fecha: sumarDias(hoy, -60) })
      .run();

    const { visitas: lista } = await (
      await app.request(`/api/visitas?desde=${sumarDias(hoy, -90)}&hasta=${hoy}`)
    ).json();

    expect(lista).toHaveLength(1);
  });
});
