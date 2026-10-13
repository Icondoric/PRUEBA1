/**
 * Las defensas que valen para cualquiera (ver middleware/proteccion.ts).
 *
 * Cada test fija un comportamiento que tiene que seguir así aunque mañana se
 * agreguen rutas: cabeceras, tamaño de los pedidos, de dónde vienen y cuántas
 * veces por minuto se puede intentar entrar.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '@/lib/db';
import { appConSesion, dbDePrueba } from '@/test/db';
import { BYTES_MAXIMOS_POR_PEDIDO, INGRESOS_POR_MINUTO } from './middleware/proteccion';

let db: DB;

const json = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

beforeEach(() => {
  db = dbDePrueba();
});

describe('cabeceras de la API', () => {
  it('le dicen al navegador que no adivine, no enmarque y no guarde', async () => {
    const app = appConSesion(db);
    const res = await app.request('/api/clientes');

    expect(res.status).toBe(200);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('también en una respuesta de error', async () => {
    const app = appConSesion(db);
    const res = await app.sinSesion('/api/clientes');

    expect(res.status).toBe(401);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('no promete HTTPS: el sistema corre por HTTP', async () => {
    const app = appConSesion(db);
    const res = await app.request('/api/clientes');

    expect(res.headers.get('strict-transport-security')).toBeNull();
  });
});

describe('de dónde viene un pedido que cambia algo', () => {
  const cliente = { nombre: 'Ana Rojas' };

  it('desde el propio sistema, pasa', async () => {
    const app = appConSesion(db);
    const res = await app.request(
      'http://localhost:3000/api/clientes',
      json(cliente, { origin: 'http://localhost:3000', host: 'localhost:3000' }),
    );

    expect(res.status).toBe(201);
  });

  it('sin decir de dónde viene (no es un navegador), pasa', async () => {
    const app = appConSesion(db);
    expect((await app.request('/api/clientes', json(cliente))).status).toBe(201);
  });

  it.each([
    ['otro sitio', 'https://otro-sitio.example'],
    ['otro programa en esta misma PC', 'http://localhost:9999'],
    ['una página sin origen', 'null'],
  ])('desde %s, no pasa y no se guarda nada', async (_de, origin) => {
    const app = appConSesion(db);
    const res = await app.request(
      'http://localhost:3000/api/clientes',
      json(cliente, { origin, host: 'localhost:3000' }),
    );

    expect(res.status).toBe(403);
    const lista = await (await app.request('/api/clientes')).json();
    expect(lista.total).toBe(0);
  });

  it('si el navegador avisa que es de otro sitio, no pasa', async () => {
    const app = appConSesion(db);
    const res = await app.request(
      '/api/clientes',
      json(cliente, { 'sec-fetch-site': 'cross-site' }),
    );

    expect(res.status).toBe(403);
  });

  it('tampoco una baja, que no lleva datos', async () => {
    const app = appConSesion(db);
    const creado = await (await app.request('/api/clientes', json(cliente))).json();

    const res = await app.request(`http://localhost:3000/api/clientes/${creado.id}`, {
      method: 'DELETE',
      headers: { origin: 'http://localhost:9999', host: 'localhost:3000' },
    });

    expect(res.status).toBe(403);
  });

  it('leer no se frena por el origen: el navegador ya no deja ver la respuesta', async () => {
    const app = appConSesion(db);
    const res = await app.request('http://localhost:3000/api/clientes', {
      headers: { origin: 'https://otro-sitio.example', host: 'localhost:3000' },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('tamaño de lo que se recibe', () => {
  it('un pedido más grande que el tope se rechaza con 413', async () => {
    const app = appConSesion(db);
    const res = await app.request(
      '/api/clientes',
      json({ nombre: 'A', relleno: 'x'.repeat(BYTES_MAXIMOS_POR_PEDIDO + 1) }),
    );

    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe('DEMASIADO_GRANDE');
  });

  it.each([
    ['nombre', { nombre: 'A'.repeat(81) }],
    ['apellido', { nombre: 'Ana', apellido: 'B'.repeat(81) }],
    ['CI', { nombre: 'Ana', ci: '1'.repeat(21) }],
    ['teléfono', { nombre: 'Ana', telefono: '7'.repeat(31) }],
  ])('un %s más largo de lo razonable no se guarda', async (_campo, cuerpo) => {
    const app = appConSesion(db);
    expect((await app.request('/api/clientes', json(cuerpo))).status).toBe(400);
  });

  it('una búsqueda larguísima no llega a la base', async () => {
    const app = appConSesion(db);
    const res = await app.request(`/api/clientes?texto=${'a'.repeat(81)}`);

    expect(res.status).toBe(400);
  });
});

describe('intentos de ingreso', () => {
  it('pasado el tope por minuto, frena aunque cambien de usuario', async () => {
    let ahora = new Date('2026-10-12T10:00:00Z');
    const app = appConSesion(db, { app: { ahora: () => ahora } });
    const intentar = (n: number) =>
      app.sinSesion(
        '/api/sesion',
        json({ usuario: `nadie${n}`, password: 'incorrecta' }),
      );

    for (let n = 0; n < INGRESOS_POR_MINUTO; n++) {
      expect((await intentar(n)).status).toBe(401);
    }

    const frenado = await intentar(999);
    expect(frenado.status).toBe(429);
    expect((await frenado.json()).error).toBe('DEMASIADOS_INTENTOS');

    // Pasa el minuto y se puede volver a intentar.
    ahora = new Date('2026-10-12T10:01:01Z');
    expect((await intentar(1000)).status).toBe(401);
  }, 20_000);

  it('el freno no toca a quien ya está adentro', async () => {
    const app = appConSesion(db);
    for (let n = 0; n < INGRESOS_POR_MINUTO + 5; n++) {
      expect((await app.request('/api/sesion')).status).toBe(200);
    }
  });

  it('con usuario inexistente responde igual que con contraseña mala', async () => {
    const app = appConSesion(db);
    const inexistente = await app.sinSesion(
      '/api/sesion',
      json({ usuario: 'no.existe', password: 'incorrecta' }),
    );
    const claveMala = await app.sinSesion(
      '/api/sesion',
      json({ usuario: 'dueno', password: 'incorrecta' }),
    );

    expect(inexistente.status).toBe(401);
    expect(await inexistente.json()).toEqual(await claveMala.json());
  });
});
