/**
 * Lo que la lista de clientes y la ficha necesitan saber de un vistazo: cómo
 * está la membresía de cada uno y cuándo vino por última vez.
 *
 * Son datos derivados (nada de esto se guarda), así que los tests arman
 * membresías e ingresos con fechas relativas a hoy.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '@/lib/db';
import { ingresos, membresias } from '@/lib/db/schema';
import { hoyEnZona, sumarDias } from '@/lib/fechas';
import { appConSesion, dbDePrueba, sembrarPlanes } from '@/test/db';

const hoy = hoyEnZona();

let db: DB;

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

beforeEach(() => {
  db = dbDePrueba();
});

/** Cinco clientes, uno por cada situación posible. */
async function armarGimnasio() {
  const app = appConSesion(db);
  const [mensual, pase] = sembrarPlanes(db);

  const crear = async (nombre: string) =>
    (await (await app.request('/api/clientes', json({ nombre }))).json()).id as number;

  const ids = {
    alDia: await crear('Ana Al Día'),
    porVencer: await crear('Beto Por Vencer'),
    vencida: await crear('Carla Vencida'),
    sinNada: await crear('Dario Sin Nada'),
    conPase: await crear('Eva Con Pase'),
  };

  const membresia = (
    clienteId: number,
    planId: number,
    desde: number,
    hasta: number,
  ) => ({
    clienteId,
    planId,
    fechaInicio: sumarDias(hoy, desde),
    fechaFin: sumarDias(hoy, hasta),
    precioCentavos: 20_000,
  });

  db.insert(membresias)
    .values([
      membresia(ids.alDia, mensual!.id, -10, 20),
      membresia(ids.porVencer, mensual!.id, -28, 2),
      membresia(ids.vencida, mensual!.id, -40, -10),
      membresia(ids.conPase, pase!.id, 0, 0),
    ])
    .run();

  return { app, ids };
}

describe('cómo está la membresía de los clientes de una lista', () => {
  it('devuelve la situación de cada uno en una sola consulta', async () => {
    const { app, ids } = await armarGimnasio();
    const res = await app.request(
      `/api/membresias/coberturas?clienteIds=${Object.values(ids).join(',')}`,
    );

    expect(res.status).toBe(200);
    const { coberturas } = await res.json();
    const de = (id: number) =>
      coberturas.find((c: { clienteId: number }) => c.clienteId === id);

    expect(de(ids.alDia)).toMatchObject({
      situacion: 'vigente',
      dias: 20,
      porVencer: false,
    });
    expect(de(ids.porVencer)).toMatchObject({
      situacion: 'vigente',
      dias: 2,
      porVencer: true,
    });
    expect(de(ids.vencida)).toMatchObject({
      situacion: 'vencida',
      dias: -10,
      porVencer: false,
    });
    expect(de(ids.sinNada)).toMatchObject({
      situacion: 'sin_membresia',
      porVencer: false,
    });
  });

  it('un pase por sesión vale hoy y no se avisa que "vence"', async () => {
    const { app, ids } = await armarGimnasio();
    const { coberturas } = await (
      await app.request(`/api/membresias/coberturas?clienteIds=${ids.conPase}`)
    ).json();

    expect(coberturas[0]).toMatchObject({
      situacion: 'vigente',
      esPaseDiario: true,
      porVencer: false,
    });
  });

  it.each(['', 'abc', '1,,2', '1;DROP', '-1'])(
    'rechaza una lista de clientes mal formada: "%s"',
    async (clienteIds) => {
      const app = appConSesion(db);
      const res = await app.request(
        `/api/membresias/coberturas?clienteIds=${encodeURIComponent(clienteIds)}`,
      );

      expect(res.status).toBe(400);
    },
  );

  it('no acepta más de 100 clientes por consulta', async () => {
    const app = appConSesion(db);
    const muchos = Array.from({ length: 101 }, (_, i) => i + 1).join(',');

    expect(
      (await app.request(`/api/membresias/coberturas?clienteIds=${muchos}`)).status,
    ).toBe(400);
  });

  it('quien solo usa el check-in no la ve', async () => {
    const app = appConSesion(db, { permisos: ['checkin.usar'] });

    expect((await app.request('/api/membresias/coberturas?clienteIds=1')).status).toBe(
      403,
    );
  });
});

describe('filtrar la lista por cómo está la membresía', () => {
  const nombres = async (
    app: Awaited<ReturnType<typeof armarGimnasio>>['app'],
    filtro: string,
  ) => {
    const lista = await (await app.request(`/api/clientes?membresia=${filtro}`)).json();
    return (lista.clientes as Array<{ nombre: string }>).map((c) => c.nombre).sort();
  };

  it('al día: los que tienen pago de hoy en adelante', async () => {
    const { app } = await armarGimnasio();
    expect(await nombres(app, 'al_dia')).toEqual([
      'Ana Al Día',
      'Beto Por Vencer',
      'Eva Con Pase',
    ]);
  });

  it('por vencer: el plan se termina en pocos días (un pase no cuenta)', async () => {
    const { app } = await armarGimnasio();
    expect(await nombres(app, 'por_vencer')).toEqual(['Beto Por Vencer']);
  });

  it('vencida y sin membresía', async () => {
    const { app } = await armarGimnasio();
    expect(await nombres(app, 'vencida')).toEqual(['Carla Vencida']);
    expect(await nombres(app, 'sin_membresia')).toEqual(['Dario Sin Nada']);
  });

  it('una membresía cancelada no cuenta como pago', async () => {
    const { app, ids } = await armarGimnasio();
    db.update(membresias).set({ estado: 'cancelada' }).run();

    expect(await nombres(app, 'al_dia')).toEqual([]);
    expect((await nombres(app, 'sin_membresia')).length).toBe(Object.keys(ids).length);
  });

  it('rechaza un filtro que no existe', async () => {
    const app = appConSesion(db);
    expect((await app.request('/api/clientes?membresia=todas')).status).toBe(400);
  });
});

describe('cuándo vino por última vez', () => {
  it('cuenta los días que entró en el último mes, no los rechazos', async () => {
    const { app, ids } = await armarGimnasio();
    const ingreso = (
      hace: number,
      resultado: 'permitido' | 'por_vencer' | 'vencido',
    ) => ({
      clienteId: ids.alDia,
      fecha: sumarDias(hoy, -hace),
      resultado,
    });
    db.insert(ingresos)
      .values([
        ingreso(3, 'permitido'),
        ingreso(3, 'permitido'), // dos veces el mismo día: es un día
        ingreso(8, 'por_vencer'),
        ingreso(1, 'vencido'), // lo rebotaron: no vino
        ingreso(45, 'permitido'), // fuera del último mes
      ])
      .run();

    const res = await app.request(`/api/checkin/asistencia?clienteId=${ids.alDia}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ultimoIngreso: sumarDias(hoy, -3),
      haceDias: 3,
      diasQueVino: 2,
      enDias: 30,
    });
  });

  it('quien nunca entró', async () => {
    const { app, ids } = await armarGimnasio();
    const asistencia = await (
      await app.request(`/api/checkin/asistencia?clienteId=${ids.sinNada}`)
    ).json();

    expect(asistencia).toMatchObject({
      ultimoIngreso: null,
      haceDias: null,
      diasQueVino: 0,
    });
  });

  it('404 si el cliente no existe', async () => {
    const dueno = appConSesion(db);
    expect((await dueno.request('/api/checkin/asistencia?clienteId=999')).status).toBe(
      404,
    );
  });

  it('quien solo usa el check-in no ve la asistencia de la ficha', async () => {
    const app = appConSesion(db, { permisos: ['checkin.usar'] });
    expect((await app.request('/api/checkin/asistencia?clienteId=1')).status).toBe(403);
  });
});
