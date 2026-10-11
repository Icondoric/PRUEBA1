/**
 * Test de API: pega a las rutas de verdad, contra una base de verdad.
 *
 * `app.request()` de Hono no abre un puerto ni necesita servidor: construye la
 * petición en memoria. Por eso esta suite corre en milisegundos y la podés
 * tener en el pre-commit sin que moleste.
 *
 * Esto es lo que le pone freno al agente: puede refactorizar lo que quiera
 * adentro, pero si cambia el contrato de la API se entera acá.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '@/server';
import { membresias, planes } from '@/lib/db/schema';
import { dbDePrueba, sembrarPlanes } from '@/test/db';
import type { DB } from '@/lib/db';

let db: DB;
let app: ReturnType<typeof crearApp>;

beforeEach(() => {
  db = dbDePrueba();
  app = crearApp(db);
});

const crear = (body: Record<string, unknown>) =>
  app.request('/api/clientes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/clientes', () => {
  it('registra un cliente con solo el nombre y le asigna nro de socio', async () => {
    const res = await crear({ nombre: 'Marcelo' });
    expect(res.status).toBe(201);

    const cliente = await res.json();
    expect(cliente.nombre).toBe('Marcelo');
    expect(cliente.nroSocio).toBe(1);
    expect(cliente.apellido).toBeNull();
    expect(cliente.tipo).toBe('eventual'); // todavía no compró nada
  });

  it('los números de socio son correlativos', async () => {
    await crear({ nombre: 'Uno' });
    const segundo = await (await crear({ nombre: 'Dos' })).json();
    expect(segundo.nroSocio).toBe(2);
  });

  it('normaliza el CI con puntos', async () => {
    const cliente = await (await crear({ nombre: 'Ana', ci: '1.234.567' })).json();
    expect(cliente.ci).toBe('1234567');
  });

  it('rechaza un CI duplicado y dice de quién es', async () => {
    await crear({ nombre: 'Ana', apellido: 'Quispe', ci: '1234567' });
    const res = await crear({ nombre: 'Otro', ci: '1.234.567' });

    expect(res.status).toBe(409);
    const error = await res.json();
    expect(error.error).toBe('CONFLICTO');
    expect(error.mensaje).toContain('Ana Quispe');
  });

  it('rechaza un nombre vacío con 422, no con 500', async () => {
    const res = await crear({ nombre: '  ' });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('REGLA_DE_NEGOCIO');
  });

  it('rechaza una entrada sin el campo nombre con error de forma', async () => {
    const res = await crear({ apellido: 'Solo' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/clientes/:id', () => {
  it('devuelve 404 con el formato de error de siempre', async () => {
    const res = await app.request('/api/clientes/999');
    expect(res.status).toBe(404);

    const error = await res.json();
    expect(error.error).toBe('NO_ENCONTRADO');
    expect(error.mensaje).toContain('999');
  });

  it('arma el nombre completo sin espacio colgando', async () => {
    const { id } = await (await crear({ nombre: 'Marcelo' })).json();
    const cliente = await (await app.request(`/api/clientes/${id}`)).json();
    expect(cliente.nombreCompleto).toBe('Marcelo');
  });
});

describe('GET /api/clientes (listado)', () => {
  beforeEach(async () => {
    sembrarPlanes(db);
    await crear({ nombre: 'Ana', apellido: 'Quispe', ci: '111111' });
    await crear({ nombre: 'Beto', apellido: 'Mamani', ci: '222222' });
    await crear({ nombre: 'Visitante' });
  });

  it('pagina y devuelve el total', async () => {
    const res = await app.request('/api/clientes?porPagina=2');
    const datos = await res.json();

    expect(datos.clientes).toHaveLength(2);
    expect(datos.total).toBe(3);
    expect(datos.paginas).toBe(2);
  });

  it('busca por nombre, por apellido y por nro de socio', async () => {
    const porNombre = await (await app.request('/api/clientes?texto=Ana')).json();
    expect(porNombre.total).toBe(1);

    const porApellido = await (await app.request('/api/clientes?texto=Mamani')).json();
    expect(porApellido.total).toBe(1);

    const porNro = await (await app.request('/api/clientes?texto=3')).json();
    expect(porNro.total).toBe(1);
  });

  it('distingue socio de eventual derivándolo del historial', async () => {
    // A Ana le vendemos una mensualidad; los otros dos quedan eventuales.
    const mensual = db.select().from(planes).all().find((p) => !p.esPaseDiario)!;
    db.insert(membresias)
      .values({
        clienteId: 1,
        planId: mensual.id,
        fechaInicio: '2026-10-01',
        fechaFin: '2026-10-30',
        precioCentavos: 20000,
      })
      .run();

    const socios = await (await app.request('/api/clientes?tipo=socio')).json();
    expect(socios.total).toBe(1);
    expect(socios.clientes[0].nombre).toBe('Ana');

    const eventuales = await (await app.request('/api/clientes?tipo=eventual')).json();
    expect(eventuales.total).toBe(2);
  });
});

describe('búsqueda del check-in', () => {
  it('encuentra por nro de socio y por CI con o sin puntos', async () => {
    await crear({ nombre: 'Ana', ci: '1234567' });

    const porNro = await (await app.request('/api/clientes/buscar/1')).json();
    expect(porNro.cliente.nombre).toBe('Ana');

    const porCi = await (await app.request('/api/clientes/buscar/1.234.567')).json();
    expect(porCi.cliente.nombre).toBe('Ana');
  });

  it('devuelve null en vez de error cuando no existe', async () => {
    const res = await app.request('/api/clientes/buscar/99999');
    expect(res.status).toBe(200);
    expect((await res.json()).cliente).toBeNull();
  });
});

describe('baja de cliente', () => {
  it('es soft delete: desaparece del listado pero el registro sigue', async () => {
    const { id } = await (await crear({ nombre: 'Ana' })).json();

    expect((await app.request(`/api/clientes/${id}`, { method: 'DELETE' })).status).toBe(
      204,
    );

    const listado = await (await app.request('/api/clientes')).json();
    expect(listado.total).toBe(0);

    // el historial sigue existiendo: se puede consultar por id
    expect((await app.request(`/api/clientes/${id}`)).status).toBe(200);
  });
});
