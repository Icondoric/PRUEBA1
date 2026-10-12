/**
 * Test de API de la administración de planes y precios.
 */

import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '@/lib/db';
import { planPrecios, planes } from '@/lib/db/schema';
import { hoyEnZona, sumarDias } from '@/lib/fechas';
import { appConSesion, dbDePrueba, sembrarPlanes } from '@/test/db';

const hoy = hoyEnZona();

let db: DB;
let app: ReturnType<typeof appConSesion>;
let mensualId: number;

const json = (body: Record<string, unknown>, metodo = 'POST'): RequestInit => ({
  method: metodo,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

type PlanListado = {
  id: number;
  nombre: string;
  activo: boolean;
  precioHoy: { precioCentavos: number; esPromocion: boolean } | null;
  precios: Array<{
    id: number;
    estado: string;
    sePuedeQuitar: boolean;
    precioCentavos: number;
  }>;
};

const listar = async () =>
  (await (await app.request('/api/gestion-planes')).json()) as { planes: PlanListado[] };

const elMensual = async () => (await listar()).planes.find((p) => p.id === mensualId)!;

const precioDeVenta = async () => {
  const { planes: lista } = await (await app.request('/api/planes')).json();
  return lista.find((p: { id: number }) => p.id === mensualId)?.precio;
};

beforeEach(() => {
  db = dbDePrueba();
  app = appConSesion(db);
  const [mensual] = sembrarPlanes(db);
  mensualId = mensual!.id;
  db.insert(planPrecios)
    .values({
      planId: mensualId,
      precioCentavos: 20_000,
      vigenteDesde: sumarDias(hoy, -90),
    })
    .run();
});

describe('GET /api/gestion-planes', () => {
  it('lista todos los planes con su precio de hoy y su historial', async () => {
    const mensual = await elMensual();

    expect(mensual).toMatchObject({
      nombre: 'Mensual',
      activo: true,
      precioHoy: { precioCentavos: 20_000 },
    });
    expect(mensual.precios).toHaveLength(1);
    expect(mensual.precios[0]).toMatchObject({ estado: 'vigente', sePuedeQuitar: false });
  });

  it('un plan sin precio aparece, con el precio de hoy vacío', async () => {
    const pase = (await listar()).planes.find((p) => p.id !== mensualId)!;
    expect(pase.precioHoy).toBeNull();
  });
});

describe('crear y modificar planes', () => {
  it('crea un plan con su precio, y ya se puede vender', async () => {
    const res = await app.request(
      '/api/gestion-planes',
      json({
        nombre: 'Semestral',
        diasDuracion: 180,
        esPaseDiario: false,
        precioCentavos: 100_000,
      }),
    );
    expect(res.status).toBe(201);

    const { planes: enVenta } = await (await app.request('/api/planes')).json();
    expect(
      enVenta.find((p: { nombre: string }) => p.nombre === 'Semestral'),
    ).toMatchObject({
      diasDuracion: 180,
      precio: { precioCentavos: 100_000 },
    });
  });

  it('si el precio es inválido no queda el plan a medias', async () => {
    const res = await app.request(
      '/api/gestion-planes',
      json({
        nombre: 'Semestral',
        diasDuracion: 180,
        esPaseDiario: false,
        precioCentavos: 0,
      }),
    );

    expect(res.status).toBe(422);
    expect(db.select().from(planes).all()).toHaveLength(2);
  });

  it('rechaza un precio con decimales: el dinero viaja en centavos enteros', async () => {
    const res = await app.request(
      '/api/gestion-planes',
      json({
        nombre: 'Raro',
        diasDuracion: 30,
        esPaseDiario: false,
        precioCentavos: 199.5,
      }),
    );
    expect(res.status).toBe(400);
  });

  it('se puede cambiar el nombre', async () => {
    await app.request(
      `/api/gestion-planes/${mensualId}`,
      json({ nombre: 'Mes libre' }, 'PUT'),
    );
    expect((await elMensual()).nombre).toBe('Mes libre');
  });

  it('dar de baja un plan lo saca de la venta pero no lo borra, y se puede reactivar', async () => {
    await app.request(
      `/api/gestion-planes/${mensualId}/estado`,
      json({ activo: false }, 'PUT'),
    );

    expect(await precioDeVenta()).toBeUndefined();
    expect((await elMensual()).activo).toBe(false);
    expect(db.select().from(planes).all()).toHaveLength(2);

    await app.request(
      `/api/gestion-planes/${mensualId}/estado`,
      json({ activo: true }, 'PUT'),
    );
    expect(await precioDeVenta()).toMatchObject({ precioCentavos: 20_000 });
  });
});

describe('precios y promociones', () => {
  const precios = () => `/api/gestion-planes/${mensualId}/precios`;

  it('cambiar el precio agrega una fila: la anterior queda intacta', async () => {
    const antes = db.select().from(planPrecios).all();

    const res = await app.request(
      precios(),
      json({ precioCentavos: 25_000, vigenteDesde: hoy, esPromocion: false }),
    );
    expect(res.status).toBe(201);

    const despues = db.select().from(planPrecios).all();
    expect(despues).toHaveLength(2);
    expect(despues.find((p) => p.id === antes[0]!.id)).toEqual(antes[0]);
    expect(await precioDeVenta()).toMatchObject({ precioCentavos: 25_000 });
  });

  it('un precio a futuro no cambia lo que se cobra hoy', async () => {
    await app.request(
      precios(),
      json({
        precioCentavos: 25_000,
        vigenteDesde: sumarDias(hoy, 10),
        esPromocion: false,
      }),
    );

    expect(await precioDeVenta()).toMatchObject({ precioCentavos: 20_000 });
    const futuro = (await elMensual()).precios.find((p) => p.precioCentavos === 25_000);
    expect(futuro).toMatchObject({ estado: 'futuro', sePuedeQuitar: true });
  });

  it('una promoción vigente se aplica sola al vender, con su nombre y el ahorro', async () => {
    await app.request(
      precios(),
      json({
        precioCentavos: 15_000,
        vigenteDesde: hoy,
        vigenteHasta: sumarDias(hoy, 6),
        esPromocion: true,
        etiqueta: 'Semana aniversario',
      }),
    );

    expect(await precioDeVenta()).toMatchObject({
      precioCentavos: 15_000,
      esPromocion: true,
      etiqueta: 'Semana aniversario',
      descuentoCentavos: 5_000,
    });
  });

  it('422 si el precio rige desde una fecha pasada', async () => {
    const res = await app.request(
      precios(),
      json({
        precioCentavos: 25_000,
        vigenteDesde: sumarDias(hoy, -1),
        esPromocion: false,
      }),
    );

    expect(res.status).toBe(422);
    expect((await res.json()).detalles.campo).toBe('vigenteDesde');
  });

  it('la simulación dice qué se cobraría, sin guardar nada', async () => {
    const res = await app.request(
      `${precios()}/simulacion`,
      json({
        precioCentavos: 25_000,
        vigenteDesde: sumarDias(hoy, 10),
        esPromocion: false,
      }),
    );

    expect(await res.json()).toMatchObject({
      hoy: { precioCentavos: 20_000 },
      desde: sumarDias(hoy, 10),
      elDiaQueEmpieza: { precioCentavos: 25_000 },
    });
    expect(db.select().from(planPrecios).all()).toHaveLength(1);
  });

  it('se puede quitar un precio que todavía no empezó a regir', async () => {
    const creado = await (
      await app.request(
        precios(),
        json({
          precioCentavos: 25_000,
          vigenteDesde: sumarDias(hoy, 10),
          esPromocion: false,
        }),
      )
    ).json();

    const res = await app.request(`/api/gestion-planes/precios/${creado.id}`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(204);
    expect(db.select().from(planPrecios).all()).toHaveLength(1);
  });

  it('NO se puede quitar un precio que ya rige', async () => {
    const vigente = db.select().from(planPrecios).get()!;

    const res = await app.request(`/api/gestion-planes/precios/${vigente.id}`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(422);
    expect(db.select().from(planPrecios).all()).toHaveLength(1);
  });

  it('NO se puede quitar un precio con el que ya se vendió, aunque parezca futuro', async () => {
    const cliente = await (
      await app.request('/api/clientes', json({ nombre: 'Ana' }))
    ).json();
    const { membresia } = await (
      await app.request(
        '/api/membresias',
        json({ clienteId: cliente.id, planId: mensualId, metodo: 'efectivo' }),
      )
    ).json();
    // Se fuerza el caso raro: el precio usado queda con fecha futura.
    db.update(planPrecios)
      .set({ vigenteDesde: sumarDias(hoy, 5) })
      .where(eq(planPrecios.id, membresia.planPrecioId))
      .run();

    const res = await app.request(
      `/api/gestion-planes/precios/${membresia.planPrecioId}`,
      {
        method: 'DELETE',
      },
    );

    expect(res.status).toBe(422);
  });
});

describe('quién puede administrar planes', () => {
  it('recepción con lo básico no entra', async () => {
    const recepcion = appConSesion(dbDePrueba(), {
      permisos: ['clientes.gestionar', 'membresias.vender'],
    });

    expect((await recepcion.request('/api/gestion-planes')).status).toBe(403);
    expect(
      (
        await recepcion.request(
          '/api/gestion-planes/1/precios',
          json({ precioCentavos: 1, vigenteDesde: hoy, esPromocion: false }),
        )
      ).status,
    ).toBe(403);
  });

  it('con el acceso "Planes y precios" sí, sin ser dueño', async () => {
    const delegado = appConSesion(dbDePrueba(), { permisos: ['planes.gestionar'] });
    expect((await delegado.request('/api/gestion-planes')).status).toBe(200);
  });
});
