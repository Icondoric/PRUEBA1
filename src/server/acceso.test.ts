/**
 * Test de la puerta: sin sesión no pasa nada, y cada acceso abre solo lo suyo.
 *
 * Estos tests son los que avisan si alguien agrega una ruta y se olvida de
 * anotar quién puede usarla.
 */

import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '@/lib/db';
import { pagos, planPrecios } from '@/lib/db/schema';
import { hoyEnZona, sumarDias } from '@/lib/fechas';
import { PERMISOS_BASICOS } from '@/modules/usuarios';
import { appConSesion, dbDePrueba, sembrarPlanes } from '@/test/db';
import { reglaPara } from './acceso';

const hoy = hoyEnZona();

let db: DB;

const json = (body: Record<string, unknown>, metodo = 'POST'): RequestInit => ({
  method: metodo,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

beforeEach(() => {
  db = dbDePrueba();
});

describe('la tabla de accesos', () => {
  it('TODA ruta registrada de la API tiene su regla', () => {
    const { rutas } = appConSesion(db);

    const sinRegla = rutas
      .filter((r) => r.path.startsWith('/api/') && r.method !== 'ALL')
      // /api/clientes/:id → /api/clientes/1
      .map((r) => ({ metodo: r.method, ruta: r.path.replace(/:[a-zA-Z]+/g, '1') }))
      .filter((r) => reglaPara(r.metodo, r.ruta) === undefined)
      .map((r) => `${r.metodo} ${r.ruta}`);

    expect(sinRegla).toEqual([]);
  });

  it('una ruta que nadie anotó queda cerrada, también para el dueño', async () => {
    const app = appConSesion(db);
    expect((await app.request('/api/algo-nuevo')).status).toBe(403);
  });
});

describe('sin sesión', () => {
  const rutas: Array<[string, string]> = [
    ['GET', '/api/sesion'],
    ['GET', '/api/clientes'],
    ['POST', '/api/clientes'],
    ['GET', '/api/clientes/1'],
    ['GET', '/api/planes'],
    ['POST', '/api/membresias'],
    ['POST', '/api/checkin'],
    ['POST', '/api/checkin/pase'],
    ['GET', '/api/pagos'],
    ['POST', '/api/pagos/1/anulacion'],
    ['GET', '/api/visitas'],
    ['GET', '/api/reportes'],
    ['GET', '/api/usuarios'],
    ['GET', '/api/algo-nuevo'],
  ];

  it.each(rutas)('%s %s responde 401', async (method, ruta) => {
    const app = appConSesion(db);
    const res = await app.sinSesion(ruta, { method });

    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('NO_AUTENTICADO');
  });

  it('una cookie inventada no sirve', async () => {
    const app = appConSesion(db);
    const res = await app.sinSesion('/api/clientes', {
      headers: { cookie: 'gym_sesion=un-token-cualquiera' },
    });
    expect(res.status).toBe(401);
  });

  it('el chequeo de salud sí responde: no muestra nada del gimnasio', async () => {
    const app = appConSesion(db);
    expect((await app.sinSesion('/api/salud')).status).toBe(200);
  });
});

describe('recepción con lo básico', () => {
  let app: ReturnType<typeof appConSesion>;
  let mensualId: number;

  beforeEach(() => {
    app = appConSesion(db, { permisos: PERMISOS_BASICOS });
    const [mensual, sesion] = sembrarPlanes(db);
    mensualId = mensual!.id;
    db.insert(planPrecios)
      .values([
        { planId: mensualId, precioCentavos: 20_000, vigenteDesde: sumarDias(hoy, -365) },
        { planId: sesion!.id, precioCentavos: 2_000, vigenteDesde: sumarDias(hoy, -365) },
      ])
      .run();
  });

  it('atiende el mostrador de punta a punta', async () => {
    const cliente = await (
      await app.request('/api/clientes', json({ nombre: 'Ana' }))
    ).json();

    const venta = await app.request(
      '/api/membresias',
      json({ clienteId: cliente.id, planId: mensualId, metodo: 'efectivo' }),
    );
    const ingreso = await app.request('/api/checkin', json({ identificador: '1' }));
    const pase = await app.request(
      '/api/checkin/pase',
      json({ nombre: 'Beto', metodo: 'qr' }),
    );
    const visita = await app.request(
      '/api/visitas',
      json({ nombre: 'Carla', motivo: 'cortesia' }),
    );
    const caja = await app.request('/api/pagos');

    expect(venta.status).toBe(201);
    expect(ingreso.status).toBe(200);
    expect(pase.status).toBe(201);
    expect(visita.status).toBe(201);
    expect(caja.status).toBe(200);
    expect((await caja.json()).totales.totalCentavos).toBe(22_000);
  });

  it('lo que cobra queda a su nombre, no al del dueño', async () => {
    const cliente = await (
      await app.request('/api/clientes', json({ nombre: 'Ana' }))
    ).json();
    await app.request(
      '/api/membresias',
      json({ clienteId: cliente.id, planId: mensualId, metodo: 'efectivo' }),
    );

    expect(db.select().from(pagos).get()?.registradoPor).toBe(app.usuarioId);
    expect(app.usuarioId).not.toBe(app.duenoId);
  });

  it('NO ve reportes', async () => {
    expect((await app.request('/api/reportes')).status).toBe(403);
  });

  it('ve la caja de hoy, pero NO la de otras fechas', async () => {
    const ayer = sumarDias(hoy, -1);

    expect((await app.request(`/api/pagos?desde=${hoy}&hasta=${hoy}`)).status).toBe(200);
    expect((await app.request(`/api/pagos?desde=${ayer}&hasta=${hoy}`)).status).toBe(403);
    expect((await app.request(`/api/pagos?desde=${ayer}`)).status).toBe(403);
  });

  it('NO puede anular un pago ni dar de baja a un cliente', async () => {
    const cliente = await (
      await app.request('/api/clientes', json({ nombre: 'Ana' }))
    ).json();
    const { pago } = await (
      await app.request(
        '/api/membresias',
        json({ clienteId: cliente.id, planId: mensualId, metodo: 'efectivo' }),
      )
    ).json();

    const anular = await app.request(
      `/api/pagos/${pago.id}/anulacion`,
      json({ motivo: 'Me equivoqué de plan' }),
    );
    const baja = await app.request(`/api/clientes/${cliente.id}`, { method: 'DELETE' });

    expect(anular.status).toBe(403);
    expect(baja.status).toBe(403);
    expect(db.select().from(pagos).get()?.anulado).toBe(false);
  });
});

describe('accesos sueltos', () => {
  it('con "anular pagos" puede anular, y queda quién y cuándo', async () => {
    const dueno = appConSesion(db);
    const [mensual] = sembrarPlanes(db);
    db.insert(planPrecios)
      .values({
        planId: mensual!.id,
        precioCentavos: 20_000,
        vigenteDesde: sumarDias(hoy, -365),
      })
      .run();
    const cliente = await (
      await dueno.request('/api/clientes', json({ nombre: 'Ana' }))
    ).json();
    const { pago } = await (
      await dueno.request(
        '/api/membresias',
        json({ clienteId: cliente.id, planId: mensual!.id, metodo: 'efectivo' }),
      )
    ).json();

    const res = await dueno.request(
      `/api/pagos/${pago.id}/anulacion`,
      json({ motivo: 'Se cobró dos veces' }),
    );
    expect(res.status).toBe(200);

    const guardado = db.select().from(pagos).where(eq(pagos.id, pago.id)).get();
    expect(guardado?.anuladoPor).toBe(dueno.usuarioId);
    expect(guardado?.anuladoEn).toBeInstanceOf(Date);

    const lista = await (await dueno.request('/api/pagos')).json();
    expect(lista.pagos[0].anuladoPorNombre).toBe('Dueña de Prueba');
  });

  it('solo con check-in: usa el check-in y nada más', async () => {
    const app = appConSesion(db, { permisos: ['checkin.usar'] });

    expect((await app.request('/api/checkin', json({ identificador: '1' }))).status).toBe(
      200,
    );
    expect((await app.request('/api/clientes')).status).toBe(403);
    expect((await app.request('/api/checkin/pase')).status).toBe(403);
    expect((await app.request('/api/pagos')).status).toBe(403);
  });

  it('con "ver reportes" ve los reportes, sin ser dueño', async () => {
    const app = appConSesion(db, { permisos: ['reportes.ver'] });
    expect((await app.request('/api/reportes')).status).toBe(200);
  });

  it('con "otras fechas" ve la caja de cualquier día', async () => {
    const app = appConSesion(db, { permisos: ['pagos.caja_hoy', 'pagos.otras_fechas'] });
    const res = await app.request(`/api/pagos?desde=${sumarDias(hoy, -30)}&hasta=${hoy}`);
    expect(res.status).toBe(200);
  });

  it('con "dar de baja" puede dar de baja', async () => {
    const dueno = appConSesion(db);
    const cliente = await (
      await dueno.request('/api/clientes', json({ nombre: 'Ana' }))
    ).json();
    expect(
      (await dueno.request(`/api/clientes/${cliente.id}`, { method: 'DELETE' })).status,
    ).toBe(204);
  });

  it('sin ningún acceso, entra pero no ve nada', async () => {
    const app = appConSesion(db, { permisos: [] });

    expect((await app.request('/api/sesion')).status).toBe(200);
    expect((await app.request('/api/clientes')).status).toBe(403);
    expect((await app.request('/api/checkin', json({ identificador: '1' }))).status).toBe(
      403,
    );
  });
});
