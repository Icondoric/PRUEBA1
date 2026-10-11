/**
 * Test de API de usuarios: entrar, salir, que la sesión venza, y administrar
 * usuarios y accesos.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '@/lib/db';
import { sesiones, usuarioPermisos, usuarios } from '@/lib/db/schema';
import { crearApp } from '@/server';
import { appConSesion, dbDePrueba } from '@/test/db';

let db: DB;

/** Un reloj que los tests pueden adelantar. */
function reloj(inicio = new Date('2026-03-10T12:00:00Z')) {
  let actual = inicio;
  return {
    ahora: () => actual,
    adelantar(minutos: number) {
      actual = new Date(actual.getTime() + minutos * 60_000);
    },
  };
}

const json = (body: Record<string, unknown>, metodo = 'POST'): RequestInit => ({
  method: metodo,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

/** La cookie que devolvió el login, lista para mandarla de vuelta. */
const cookieDe = (res: Response) => (res.headers.get('set-cookie') ?? '').split(';')[0]!;

beforeEach(() => {
  db = dbDePrueba();
});

describe('entrar y salir', () => {
  it('con usuario y contraseña correctos entra y recibe la cookie de sesión', async () => {
    const app = appConSesion(db);

    const res = await app.sinSesion(
      '/api/sesion',
      json({ usuario: 'dueno', password: app.password }),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).usuario).toMatchObject({ usuario: 'dueno', rol: 'admin' });

    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/^gym_sesion=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });

  it('el usuario no distingue mayúsculas', async () => {
    const app = appConSesion(db);
    const res = await app.sinSesion(
      '/api/sesion',
      json({ usuario: ' DUENO ', password: app.password }),
    );
    expect(res.status).toBe(200);
  });

  it('contraseña mal o usuario inexistente: 401 con el MISMO mensaje', async () => {
    const app = appConSesion(db);

    const malaClave = await app.sinSesion(
      '/api/sesion',
      json({ usuario: 'dueno', password: 'no-es-esta' }),
    );
    const noExiste = await app.sinSesion(
      '/api/sesion',
      json({ usuario: 'fantasma', password: 'no-es-esta' }),
    );

    expect(malaClave.status).toBe(401);
    expect(noExiste.status).toBe(401);
    expect((await malaClave.json()).mensaje).toBe((await noExiste.json()).mensaje);
  });

  it('no se guarda la contraseña ni el token en claro', async () => {
    const app = appConSesion(db);
    const res = await app.sinSesion(
      '/api/sesion',
      json({ usuario: 'dueno', password: app.password }),
    );
    const token = cookieDe(res).split('=')[1]!;

    const guardado = JSON.stringify([
      db.select().from(usuarios).all(),
      db.select().from(sesiones).all(),
    ]);

    expect(guardado).not.toContain(app.password);
    expect(guardado).not.toContain(token);
  });

  it('tras 5 intentos fallidos seguidos hay que esperar, aunque después la clave sea correcta', async () => {
    const tiempo = reloj();
    const app = appConSesion(db, { app: { ahora: tiempo.ahora } });
    const entrar = (password: string) =>
      app.sinSesion('/api/sesion', json({ usuario: 'dueno', password }));

    for (let i = 0; i < 5; i++) expect((await entrar('mal')).status).toBe(401);

    const bloqueado = await entrar(app.password);
    expect(bloqueado.status).toBe(401);
    expect((await bloqueado.json()).mensaje).toMatch(/Demasiados intentos/);

    tiempo.adelantar(2);
    expect((await entrar(app.password)).status).toBe(200);
  });

  it('GET /api/sesion dice quién soy y qué puedo hacer', async () => {
    const app = appConSesion(db, { permisos: ['clientes.gestionar', 'checkin.usar'] });

    const { usuario } = await (await app.request('/api/sesion')).json();

    expect(usuario).toMatchObject({
      usuario: 'recepcion',
      rol: 'recepcion',
      permisos: ['clientes.gestionar', 'checkin.usar'],
    });
    expect(usuario.passwordHash).toBeUndefined();
  });

  it('salir borra la sesión: la misma cookie ya no sirve', async () => {
    const app = appConSesion(db);

    expect((await app.request('/api/sesion', { method: 'DELETE' })).status).toBe(204);
    expect((await app.request('/api/sesion')).status).toBe(401);
    expect(db.select().from(sesiones).all()).toHaveLength(0);
  });

  it('la sesión vence a las 8 horas sin uso', async () => {
    const tiempo = reloj();
    const app = appConSesion(db, { app: { ahora: tiempo.ahora, horasDeSesion: 8 } });

    tiempo.adelantar(8 * 60 - 1);
    // un pedido a las 7:59 la mantiene viva y reinicia la cuenta
    expect((await app.request('/api/sesion')).status).toBe(200);

    tiempo.adelantar(8 * 60 - 1);
    expect((await app.request('/api/sesion')).status).toBe(200);

    tiempo.adelantar(8 * 60 + 1);
    expect((await app.request('/api/sesion')).status).toBe(401);
  });
});

describe('administrar usuarios (solo el dueño)', () => {
  const nuevo = { usuario: 'Ana.Quispe', nombre: 'Ana Quispe', password: 'clave-segura' };

  it('crea un usuario de recepción con lo básico ya marcado', async () => {
    const app = appConSesion(db);

    const res = await app.request('/api/usuarios', json(nuevo));
    expect(res.status).toBe(201);

    const creado = await res.json();
    expect(creado).toMatchObject({
      usuario: 'ana.quispe',
      rol: 'recepcion',
      activo: true,
    });
    expect(creado.permisos).toContain('checkin.usar');
    expect(creado.permisos).not.toContain('reportes.ver');
    expect(creado.passwordHash).toBeUndefined();
  });

  it('el usuario nuevo puede entrar con su contraseña', async () => {
    const app = appConSesion(db);
    await app.request('/api/usuarios', json(nuevo));

    const res = await app.sinSesion(
      '/api/sesion',
      json({ usuario: 'ana.quispe', password: 'clave-segura' }),
    );
    expect(res.status).toBe(200);
  });

  it('deja registrado quién le dio cada acceso', async () => {
    const app = appConSesion(db);
    await app.request('/api/usuarios', json(nuevo));

    const filas = db.select().from(usuarioPermisos).all();
    expect(filas.length).toBeGreaterThan(0);
    expect(filas.every((f) => f.otorgadoPor === app.duenoId)).toBe(true);
  });

  it('409 si el usuario ya existe', async () => {
    const app = appConSesion(db);
    await app.request('/api/usuarios', json(nuevo));

    expect((await app.request('/api/usuarios', json(nuevo))).status).toBe(409);
  });

  it('422 si la contraseña es corta', async () => {
    const app = appConSesion(db);
    const res = await app.request('/api/usuarios', json({ ...nuevo, password: 'corta' }));

    expect(res.status).toBe(422);
    expect((await res.json()).detalles.campo).toBe('password');
  });

  it('el dueño le da y le quita accesos, y se aplican en el acto', async () => {
    const app = appConSesion(db);
    const ana = await (await app.request('/api/usuarios', json(nuevo))).json();
    const login = await app.sinSesion(
      '/api/sesion',
      json({ usuario: 'ana.quispe', password: 'clave-segura' }),
    );
    const comoAna = (ruta: string) =>
      app.sinSesion(ruta, { headers: { cookie: cookieDe(login) } });

    expect((await comoAna('/api/reportes')).status).toBe(403);

    await app.request(
      `/api/usuarios/${ana.id}`,
      json({ permisos: [...ana.permisos, 'reportes.ver'] }, 'PUT'),
    );
    expect((await comoAna('/api/reportes')).status).toBe(200);

    await app.request(`/api/usuarios/${ana.id}`, json({ permisos: [] }, 'PUT'));
    expect((await comoAna('/api/reportes')).status).toBe(403);
    expect((await comoAna('/api/clientes')).status).toBe(403);
  });

  it('422 si se intenta dar un acceso que no existe', async () => {
    const app = appConSesion(db);
    const ana = await (await app.request('/api/usuarios', json(nuevo))).json();

    const res = await app.request(
      `/api/usuarios/${ana.id}`,
      json({ permisos: ['todo.el.poder'] }, 'PUT'),
    );
    expect(res.status).toBe(422);
  });

  it('desactivar a alguien lo saca en el acto y ya no puede entrar', async () => {
    const app = appConSesion(db);
    const ana = await (await app.request('/api/usuarios', json(nuevo))).json();
    const login = await app.sinSesion(
      '/api/sesion',
      json({ usuario: 'ana.quispe', password: 'clave-segura' }),
    );

    await app.request(`/api/usuarios/${ana.id}`, json({ activo: false }, 'PUT'));

    const conSuCookie = await app.sinSesion('/api/sesion', {
      headers: { cookie: cookieDe(login) },
    });
    const otraVez = await app.sinSesion(
      '/api/sesion',
      json({ usuario: 'ana.quispe', password: 'clave-segura' }),
    );
    expect(conSuCookie.status).toBe(401);
    expect(otraVez.status).toBe(401);
    // no se borra: sus ventas siguen a su nombre
    expect(db.select().from(usuarios).all()).toHaveLength(2);
  });

  it('cambiar la contraseña cierra las sesiones abiertas de esa cuenta', async () => {
    const app = appConSesion(db);
    const ana = await (await app.request('/api/usuarios', json(nuevo))).json();
    const login = await app.sinSesion(
      '/api/sesion',
      json({ usuario: 'ana.quispe', password: 'clave-segura' }),
    );

    const res = await app.request(
      `/api/usuarios/${ana.id}/password`,
      json({ password: 'otra-clave-nueva' }, 'PUT'),
    );
    expect(res.status).toBe(204);

    const conLaVieja = await app.sinSesion(
      '/api/sesion',
      json({ usuario: 'ana.quispe', password: 'clave-segura' }),
    );
    const conLaNueva = await app.sinSesion(
      '/api/sesion',
      json({ usuario: 'ana.quispe', password: 'otra-clave-nueva' }),
    );
    const sesionVieja = await app.sinSesion('/api/sesion', {
      headers: { cookie: cookieDe(login) },
    });

    expect(conLaVieja.status).toBe(401);
    expect(conLaNueva.status).toBe(200);
    expect(sesionVieja.status).toBe(401);
  });

  it('al dueño no se lo puede desactivar ni recortar desde la pantalla', async () => {
    const app = appConSesion(db);

    const desactivar = await app.request(
      `/api/usuarios/${app.duenoId}`,
      json({ activo: false }, 'PUT'),
    );
    const recortar = await app.request(
      `/api/usuarios/${app.duenoId}`,
      json({ permisos: [] }, 'PUT'),
    );

    expect(desactivar.status).toBe(422);
    expect(recortar.status).toBe(422);
  });

  it('la lista trae el catálogo de accesos para dibujar las casillas', async () => {
    const app = appConSesion(db);
    const r = await (await app.request('/api/usuarios')).json();

    expect(r.usuarios).toHaveLength(1);
    expect(r.catalogo.map((m: { modulo: string }) => m.modulo)).toContain('Reportes');
    expect(r.basicos).toContain('clientes.gestionar');
  });

  it('recepción no entra a usuarios, tenga los accesos que tenga', async () => {
    const app = appConSesion(db, {
      permisos: [
        'clientes.gestionar',
        'reportes.ver',
        'pagos.anular',
        'planes.gestionar',
      ],
    });

    expect((await app.request('/api/usuarios')).status).toBe(403);
    expect((await app.request('/api/usuarios', json(nuevo))).status).toBe(403);
    expect(
      (await app.request(`/api/usuarios/${app.usuarioId}`, json({ permisos: [] }, 'PUT')))
        .status,
    ).toBe(403);
  });
});

describe('la cuenta del dueño (el comando)', () => {
  it('sin ningún usuario, nadie puede entrar ni crear cuentas por la API', async () => {
    const app = crearApp(db);

    expect((await app.request('/api/usuarios')).status).toBe(401);
    expect(
      (
        await app.request(
          '/api/usuarios',
          json({ usuario: 'intruso', nombre: 'Intruso', password: 'clave-segura' }),
        )
      ).status,
    ).toBe(401);
    expect(db.select().from(usuarios).all()).toHaveLength(0);
  });
});
