/**
 * Reglas de seguridad que cruzan más de un módulo. Cada una está acá para que
 * no se pierda en un cambio futuro. El porqué de cada una: docs/SEGURIDAD.md.
 */

import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '@/lib/db';
import { sesiones } from '@/lib/db/schema';
import { hoyEnZona, sumarDias } from '@/lib/fechas';
import { PERMISOS_BASICOS, moduloUsuarios } from '@/modules/usuarios';
import { appConSesion, dbDePrueba, sembrarPlanes } from '@/test/db';

let db: DB;

const json = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

beforeEach(() => {
  db = dbDePrueba();
});

describe('la ruta escrita de otra forma', () => {
  // La tabla de accesos compara la ruta tal como llega. Estas variantes no
  // tienen que abrir nada que la ruta bien escrita tenga cerrado.
  const variantes = [
    '/api/usuarios/',
    '/api/Usuarios',
    '/api/%75suarios',
    '/api//usuarios',
    '/api/reportes/',
    '/api/REPORTES',
    '/api/clientes/../usuarios',
  ];

  it.each(variantes)('%s no le abre a recepción lo que es del dueño', async (ruta) => {
    const app = appConSesion(db, { permisos: PERMISOS_BASICOS });
    const res = await app.request(ruta);

    expect(res.status).not.toBe(200);
  });
});

describe('ingreso', () => {
  const DUENO = { usuario: 'dueno', nombre: 'Dueña', password: 'una-clave-larga' };
  const ahora = new Date('2026-10-12T10:00:00Z');

  it('fallar desde un equipo no deja afuera a quien entra desde otro', () => {
    const { servicio } = moduloUsuarios(db, { horasDeSesion: 8 });
    servicio.asegurarDueno(DUENO);

    for (let n = 0; n < 6; n++) {
      expect(() =>
        servicio.iniciarSesion(
          { usuario: 'dueno', password: 'incorrecta' },
          ahora,
          '10.0.0.9',
        ),
      ).toThrow();
    }

    // El que falló queda esperando, también con la contraseña buena…
    expect(() =>
      servicio.iniciarSesion(
        { usuario: 'dueno', password: DUENO.password },
        ahora,
        '10.0.0.9',
      ),
    ).toThrow(/Demasiados intentos/);

    // …y la PC de recepción entra como siempre.
    const entrada = servicio.iniciarSesion(
      { usuario: 'dueno', password: DUENO.password },
      ahora,
      '127.0.0.1',
    );
    expect(entrada.usuario.usuario).toBe('dueno');
  });

  it('al entrar se barren las sesiones que ya habían vencido', () => {
    const { servicio } = moduloUsuarios(db, { horasDeSesion: 8 });
    const { id } = servicio.asegurarDueno(DUENO);

    const hace9Horas = new Date(ahora.getTime() - 9 * 3_600_000);
    const hace1Hora = new Date(ahora.getTime() - 3_600_000);
    db.insert(sesiones)
      .values([
        { tokenHash: 'vencida', usuarioId: id, ultimoUso: hace9Horas },
        { tokenHash: 'vigente', usuarioId: id, ultimoUso: hace1Hora },
      ])
      .run();

    servicio.iniciarSesion({ usuario: 'dueno', password: DUENO.password }, ahora);

    const quedan = db.select().from(sesiones).all();
    expect(quedan.map((s) => s.tokenHash)).not.toContain('vencida');
    expect(quedan.map((s) => s.tokenHash)).toContain('vigente');
    expect(quedan).toHaveLength(2); // la vigente y la recién creada
  });

  it('por HTTPS la cookie se marca para no viajar nunca en claro', async () => {
    const app = appConSesion(db);
    const credenciales = { usuario: 'dueno', password: app.password };

    const porHttp = await app.sinSesion('/api/sesion', json(credenciales));
    expect(porHttp.headers.get('set-cookie')).not.toMatch(/Secure/i);

    const porHttps = await app.sinSesion(
      '/api/sesion',
      json(credenciales, { 'x-forwarded-proto': 'https' }),
    );
    expect(porHttps.headers.get('set-cookie')).toMatch(/Secure/i);
  });

  it('no se acepta una contraseña de las que probaría cualquiera', async () => {
    const app = appConSesion(db);
    const res = await app.request(
      '/api/usuarios',
      json({ usuario: 'nuevo', nombre: 'Nuevo Usuario', password: 'Password123' }),
    );

    expect(res.status).toBe(422);
    expect((await res.json()).detalles.campo).toBe('password');
  });
});

describe('entradas con tope', () => {
  it('buscar por un identificador larguísimo se rechaza sin consultar', async () => {
    const app = appConSesion(db);
    const res = await app.request(`/api/clientes/buscar/${'9'.repeat(41)}`);

    expect(res.status).toBe(400);
  });

  it('una membresía no puede empezar dentro de varios años', async () => {
    const app = appConSesion(db);
    const [mensual] = sembrarPlanes(db);
    const hoy = hoyEnZona();
    await app.request(
      `/api/gestion-planes/${mensual!.id}/precios`,
      json({ precioCentavos: 20_000, vigenteDesde: hoy, esPromocion: false }),
    );
    const cliente = await (
      await app.request('/api/clientes', json({ nombre: 'Ana Rojas' }))
    ).json();

    const lejos = await app.request(
      '/api/membresias',
      json({
        clienteId: cliente.id,
        planId: mensual!.id,
        metodo: 'efectivo',
        inicio: sumarDias(hoy, 366),
      }),
    );
    expect(lejos.status).toBe(422);
    expect((await lejos.json()).detalles.campo).toBe('inicio');

    const elLunes = await app.request(
      '/api/membresias',
      json({
        clienteId: cliente.id,
        planId: mensual!.id,
        metodo: 'efectivo',
        inicio: sumarDias(hoy, 5),
      }),
    );
    expect(elLunes.status).toBe(201);
  });

  it('un precio con ceros de más se rechaza', async () => {
    const app = appConSesion(db);
    const [mensual] = sembrarPlanes(db);
    const res = await app.request(
      `/api/gestion-planes/${mensual!.id}/precios`,
      json({
        precioCentavos: 100_000_001,
        vigenteDesde: hoyEnZona(),
        esPromocion: false,
      }),
    );

    expect(res.status).toBe(400);
  });
});

describe('la sesión de otro', () => {
  it('cerrar sesión borra solo la propia', async () => {
    const app = appConSesion(db);
    const antes = db.select().from(sesiones).all();
    const otra = db
      .insert(sesiones)
      .values({ tokenHash: 'de-otro', usuarioId: app.duenoId, ultimoUso: new Date() })
      .returning()
      .get();

    await app.request('/api/sesion', { method: 'DELETE' });

    const quedan = db.select().from(sesiones).where(eq(sesiones.id, otra.id)).all();
    expect(antes).toHaveLength(1);
    expect(quedan).toHaveLength(1);
  });
});
