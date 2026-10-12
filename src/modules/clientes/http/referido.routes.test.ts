/**
 * Test de API: quién refirió a un cliente, y quién lo bloqueó y cuándo.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '@/lib/db';
import { clientes } from '@/lib/db/schema';
import { appConSesion, dbDePrueba } from '@/test/db';

let db: DB;
let app: ReturnType<typeof appConSesion>;

const json = (body: Record<string, unknown>, metodo = 'POST'): RequestInit => ({
  method: metodo,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

const alta = async (datos: Record<string, unknown>) =>
  (await app.request('/api/clientes', json(datos))).json();

beforeEach(() => {
  db = dbDePrueba();
  app = appConSesion(db);
});

describe('quién refirió al cliente', () => {
  it('al registrar, se indica por número de socio', async () => {
    const ana = await alta({ nombre: 'Ana' });

    const beto = await alta({ nombre: 'Beto', referidoPor: String(ana.nroSocio) });

    expect(beto.referidoPorClienteId).toBe(ana.id);
  });

  it('o por CI, aunque lo tecleen con puntos', async () => {
    const ana = await alta({ nombre: 'Ana', ci: '1234567' });

    const beto = await alta({ nombre: 'Beto', referidoPor: ' 1.234.567 ' });

    expect(beto.referidoPorClienteId).toBe(ana.id);
  });

  it('si ese número no es de nadie, avisa y NO crea al cliente', async () => {
    const res = await app.request(
      '/api/clientes',
      json({ nombre: 'Beto', referidoPor: '9999' }),
    );

    expect(res.status).toBe(422);
    expect((await res.json()).detalles.campo).toBe('referidoPor');
    expect(db.select().from(clientes).all()).toHaveLength(0);
  });

  it('vacío es "nadie lo refirió"', async () => {
    const beto = await alta({ nombre: 'Beto', referidoPor: '  ' });
    expect(beto.referidoPorClienteId).toBeNull();
  });

  it('al editar se puede agregar, cambiar o quitar', async () => {
    const ana = await alta({ nombre: 'Ana' });
    const carla = await alta({ nombre: 'Carla' });
    const beto = await alta({ nombre: 'Beto' });
    const editar = async (referidoPor: string) =>
      (
        await app.request(
          `/api/clientes/${beto.id}`,
          json({ nombre: 'Beto', referidoPor }, 'PUT'),
        )
      ).json();

    expect((await editar(String(ana.nroSocio))).referidoPorClienteId).toBe(ana.id);
    expect((await editar(String(carla.nroSocio))).referidoPorClienteId).toBe(carla.id);
    expect((await editar('')).referidoPorClienteId).toBeNull();
  });

  it('editar otros datos sin mandar el referido no lo borra', async () => {
    const ana = await alta({ nombre: 'Ana' });
    const beto = await alta({ nombre: 'Beto', referidoPor: String(ana.nroSocio) });

    const editado = await (
      await app.request(`/api/clientes/${beto.id}`, json({ nombre: 'Alberto' }, 'PUT'))
    ).json();

    expect(editado).toMatchObject({ nombre: 'Alberto', referidoPorClienteId: ana.id });
  });

  it('nadie se refiere a sí mismo', async () => {
    const beto = await alta({ nombre: 'Beto' });

    const res = await app.request(
      `/api/clientes/${beto.id}`,
      json({ nombre: 'Beto', referidoPor: String(beto.nroSocio) }, 'PUT'),
    );

    expect(res.status).toBe(422);
    expect((await res.json()).detalles.campo).toBe('referidoPor');
  });

  it('un cliente dado de baja no puede figurar como quien refirió', async () => {
    const ana = await alta({ nombre: 'Ana' });
    await app.request(`/api/clientes/${ana.id}`, { method: 'DELETE' });

    const res = await app.request(
      '/api/clientes',
      json({ nombre: 'Beto', referidoPor: String(ana.nroSocio) }),
    );
    expect(res.status).toBe(422);
  });
});

describe('quién bloqueó y cuándo', () => {
  it('al bloquear queda quién fue y cuándo, y se ve su nombre', async () => {
    const cuando = new Date('2026-03-10T15:30:00Z');
    app = appConSesion(dbDePrueba(), { app: { ahora: () => cuando } });
    const ana = await alta({ nombre: 'Ana' });

    const bloqueado = await (
      await app.request(
        `/api/clientes/${ana.id}/bloqueo`,
        json({ motivo: 'Rompió una máquina' }, 'PUT'),
      )
    ).json();

    expect(bloqueado).toMatchObject({
      bloqueado: true,
      bloqueadoPor: app.usuarioId,
      bloqueadoPorNombre: 'Dueña de Prueba',
    });
    expect(new Date(bloqueado.bloqueadoEn).getTime()).toBe(cuando.getTime());
  });

  it('queda a nombre de quien lo hizo, no del dueño', async () => {
    const recepcion = appConSesion(dbDePrueba(), {
      permisos: ['clientes.gestionar', 'clientes.bloquear'],
    });
    const ana = await (
      await recepcion.request('/api/clientes', json({ nombre: 'Ana' }))
    ).json();

    const bloqueado = await (
      await recepcion.request(
        `/api/clientes/${ana.id}/bloqueo`,
        json({ motivo: 'Rompió una máquina' }, 'PUT'),
      )
    ).json();

    expect(bloqueado.bloqueadoPorNombre).toBe('Recepción de Prueba');
  });

  it('al desbloquear se limpia todo', async () => {
    const ana = await alta({ nombre: 'Ana' });
    await app.request(
      `/api/clientes/${ana.id}/bloqueo`,
      json({ motivo: 'Rompió una máquina' }, 'PUT'),
    );

    const libre = await (
      await app.request(`/api/clientes/${ana.id}/bloqueo`, { method: 'DELETE' })
    ).json();

    expect(libre).toMatchObject({
      bloqueado: false,
      motivoBloqueo: null,
      bloqueadoPor: null,
      bloqueadoEn: null,
      bloqueadoPorNombre: null,
    });
  });

  it('un cliente que nunca se bloqueó no tiene nada de eso', async () => {
    const ana = await alta({ nombre: 'Ana' });
    expect(ana).toMatchObject({ bloqueadoPor: null, bloqueadoPorNombre: null });
  });
});
