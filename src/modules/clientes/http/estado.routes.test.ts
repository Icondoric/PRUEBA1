/**
 * Test de API: bloquear, dar de baja y reactivar clientes, y que cada uno
 * cambie su propia contraseña.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '@/lib/db';
import { clientes, membresias } from '@/lib/db/schema';
import { hoyEnZona, sumarDias } from '@/lib/fechas';
import { PERMISOS_BASICOS } from '@/modules/usuarios';
import { appConSesion, dbDePrueba, sembrarPlanes } from '@/test/db';

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

describe('bloquear y desbloquear', () => {
  it('bloquear pide el motivo, lo guarda, y el check-in lo rebota', async () => {
    const app = appConSesion(db);
    const [mensual] = sembrarPlanes(db);
    const ana = await (
      await app.request('/api/clientes', json({ nombre: 'Ana' }))
    ).json();
    db.insert(membresias)
      .values({
        clienteId: ana.id,
        planId: mensual!.id,
        fechaInicio: sumarDias(hoy, -5),
        fechaFin: sumarDias(hoy, 24),
        precioCentavos: 20_000,
      })
      .run();

    const res = await app.request(
      `/api/clientes/${ana.id}/bloqueo`,
      json({ motivo: ' Rompió una máquina y se fue ' }, 'PUT'),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      bloqueado: true,
      motivoBloqueo: 'Rompió una máquina y se fue',
    });

    const ingreso = await (
      await app.request('/api/checkin', json({ identificador: String(ana.nroSocio) }))
    ).json();
    expect(ingreso).toMatchObject({ permitir: false, bloqueado: true });
  });

  it('sin motivo no se bloquea', async () => {
    const app = appConSesion(db);
    const ana = await (
      await app.request('/api/clientes', json({ nombre: 'Ana' }))
    ).json();

    expect(
      (await app.request(`/api/clientes/${ana.id}/bloqueo`, json({ motivo: ' ' }, 'PUT')))
        .status,
    ).toBe(400);
    expect(
      (
        await app.request(
          `/api/clientes/${ana.id}/bloqueo`,
          json({ motivo: 'no' }, 'PUT'),
        )
      ).status,
    ).toBe(422);
    expect(db.select().from(clientes).get()?.bloqueado).toBe(false);
  });

  it('desbloquear limpia el motivo', async () => {
    const app = appConSesion(db);
    const ana = await (
      await app.request('/api/clientes', json({ nombre: 'Ana' }))
    ).json();
    await app.request(
      `/api/clientes/${ana.id}/bloqueo`,
      json({ motivo: 'Rompió una máquina' }, 'PUT'),
    );

    const res = await app.request(`/api/clientes/${ana.id}/bloqueo`, {
      method: 'DELETE',
    });

    expect(await res.json()).toMatchObject({ bloqueado: false, motivoBloqueo: null });
  });

  it('recepción con lo básico no puede bloquear; con el acceso, sí', async () => {
    const basico = appConSesion(db, { permisos: PERMISOS_BASICOS });
    const ana = await (
      await basico.request('/api/clientes', json({ nombre: 'Ana' }))
    ).json();
    const pedido = json({ motivo: 'Rompió una máquina' }, 'PUT');

    expect((await basico.request(`/api/clientes/${ana.id}/bloqueo`, pedido)).status).toBe(
      403,
    );

    const conAcceso = appConSesion(dbDePrueba(), {
      permisos: ['clientes.gestionar', 'clientes.bloquear'],
    });
    const beto = await (
      await conAcceso.request('/api/clientes', json({ nombre: 'Beto' }))
    ).json();
    expect(
      (await conAcceso.request(`/api/clientes/${beto.id}/bloqueo`, pedido)).status,
    ).toBe(200);
  });
});

describe('dar de baja y reactivar', () => {
  it('dar de baja NO borra nada: el cliente sigue en la base con su historial', async () => {
    const app = appConSesion(db);
    const [mensual] = sembrarPlanes(db);
    const ana = await (
      await app.request('/api/clientes', json({ nombre: 'Ana' }))
    ).json();
    db.insert(membresias)
      .values({
        clienteId: ana.id,
        planId: mensual!.id,
        fechaInicio: sumarDias(hoy, -5),
        fechaFin: sumarDias(hoy, 24),
        precioCentavos: 20_000,
      })
      .run();

    expect(
      (await app.request(`/api/clientes/${ana.id}`, { method: 'DELETE' })).status,
    ).toBe(204);

    expect(db.select().from(clientes).all()).toHaveLength(1);
    expect(db.select().from(clientes).get()).toMatchObject({
      nombre: 'Ana',
      activo: false,
    });
    expect(db.select().from(membresias).all()).toHaveLength(1);
  });

  it('el dado de baja sale de la lista normal y aparece en la de bajas', async () => {
    const app = appConSesion(db);
    const ana = await (
      await app.request('/api/clientes', json({ nombre: 'Ana' }))
    ).json();
    await app.request('/api/clientes', json({ nombre: 'Beto' }));
    await app.request(`/api/clientes/${ana.id}`, { method: 'DELETE' });

    const activos = await (await app.request('/api/clientes')).json();
    const bajas = await (await app.request('/api/clientes?estado=baja')).json();

    expect(activos.clientes.map((c: { nombre: string }) => c.nombre)).toEqual(['Beto']);
    expect(bajas.clientes.map((c: { nombre: string }) => c.nombre)).toEqual(['Ana']);
  });

  it('reactivar lo devuelve a la lista, con el mismo número de socio', async () => {
    const app = appConSesion(db);
    const ana = await (
      await app.request('/api/clientes', json({ nombre: 'Ana' }))
    ).json();
    await app.request(`/api/clientes/${ana.id}`, { method: 'DELETE' });

    const res = await app.request(`/api/clientes/${ana.id}/reactivacion`, {
      method: 'POST',
    });

    expect(await res.json()).toMatchObject({ activo: true, nroSocio: ana.nroSocio });
    expect((await (await app.request('/api/clientes')).json()).total).toBe(1);
  });

  it('con el acceso "Dar de baja y reactivar" lo hace alguien que no es el dueño', async () => {
    const delegado = appConSesion(db, {
      permisos: ['clientes.gestionar', 'clientes.baja'],
    });
    const ana = await (
      await delegado.request('/api/clientes', json({ nombre: 'Ana' }))
    ).json();

    const baja = await delegado.request(`/api/clientes/${ana.id}`, { method: 'DELETE' });
    const verBajas = await delegado.request('/api/clientes?estado=baja');
    const reactivar = await delegado.request(`/api/clientes/${ana.id}/reactivacion`, {
      method: 'POST',
    });

    expect(baja.status).toBe(204);
    expect((await verBajas.json()).total).toBe(1);
    expect(reactivar.status).toBe(200);
    // ni así se borra nada
    expect(db.select().from(clientes).all()).toHaveLength(1);
  });

  it('sin ese acceso no puede, aunque tenga todos los demás', async () => {
    const recepcion = appConSesion(db, {
      permisos: [
        ...PERMISOS_BASICOS,
        'clientes.bloquear',
        'pagos.anular',
        'planes.gestionar',
      ],
    });
    const ana = await (
      await recepcion.request('/api/clientes', json({ nombre: 'Ana' }))
    ).json();

    const baja = await recepcion.request(`/api/clientes/${ana.id}`, { method: 'DELETE' });
    const reactivar = await recepcion.request(`/api/clientes/${ana.id}/reactivacion`, {
      method: 'POST',
    });
    const verBajas = await recepcion.request('/api/clientes?estado=baja');

    expect(baja.status).toBe(403);
    expect(reactivar.status).toBe(403);
    expect(verBajas.status).toBe(403);
    expect(db.select().from(clientes).get()?.activo).toBe(true);
  });
});

describe('cambiar mi propia contraseña', () => {
  const entrar = (
    app: ReturnType<typeof appConSesion>,
    usuario: string,
    password: string,
  ) => app.sinSesion('/api/sesion', json({ usuario, password }));

  it('pide la actual, pone la nueva y cierra la sesión', async () => {
    const app = appConSesion(db, { permisos: PERMISOS_BASICOS });

    const res = await app.request(
      '/api/sesion/password',
      json({ actual: app.password, nueva: 'mi-clave-nueva' }, 'PUT'),
    );
    expect(res.status).toBe(204);

    expect((await app.request('/api/sesion')).status).toBe(401);
    expect((await entrar(app, 'recepcion', app.password)).status).toBe(401);
    expect((await entrar(app, 'recepcion', 'mi-clave-nueva')).status).toBe(200);
  });

  it('con la actual mal no cambia nada', async () => {
    const app = appConSesion(db, { permisos: PERMISOS_BASICOS });

    const res = await app.request(
      '/api/sesion/password',
      json({ actual: 'no-es-esta', nueva: 'mi-clave-nueva' }, 'PUT'),
    );

    expect(res.status).toBe(422);
    expect((await res.json()).detalles.campo).toBe('actual');
    expect((await app.request('/api/sesion')).status).toBe(200);
  });

  it('la nueva tiene que cumplir el mínimo', async () => {
    const app = appConSesion(db, { permisos: PERMISOS_BASICOS });
    const res = await app.request(
      '/api/sesion/password',
      json({ actual: app.password, nueva: 'corta' }, 'PUT'),
    );
    expect(res.status).toBe(422);
  });

  it('sin sesión no se puede', async () => {
    const app = appConSesion(db);
    const res = await app.sinSesion(
      '/api/sesion/password',
      json({ actual: 'x', nueva: 'mi-clave-nueva' }, 'PUT'),
    );
    expect(res.status).toBe(401);
  });
});
