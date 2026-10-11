/**
 * Test de API del check-in: la ruta de verdad contra una base con las
 * migraciones reales. Fechas relativas a hoy porque la ruta lee el reloj.
 */

import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '@/lib/db';
import { clientes, ingresos, membresias } from '@/lib/db/schema';
import { hoyEnZona, sumarDias } from '@/lib/fechas';
import { crearApp } from '@/server';
import { dbDePrueba, sembrarPlanes } from '@/test/db';

const hoy = hoyEnZona();

let db: DB;
let app: ReturnType<typeof crearApp>;
let mensualId: number;
let sesionId: number;

beforeEach(() => {
  db = dbDePrueba();
  app = crearApp(db);
  const [mensual, sesion] = sembrarPlanes(db);
  mensualId = mensual!.id;
  sesionId = sesion!.id;
});

const post = (ruta: string, body: Record<string, unknown>) =>
  app.request(ruta, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const alta = async (datos: Record<string, unknown>) =>
  (await (await post('/api/clientes', datos)).json()) as { id: number; nroSocio: number };

const membresia = (
  clienteId: number,
  fechaInicio: string,
  fechaFin: string,
  planId = mensualId,
) =>
  db
    .insert(membresias)
    .values({ clienteId, planId, fechaInicio, fechaFin, precioCentavos: 20_000 })
    .returning()
    .get();

const ingresar = async (identificador: string) =>
  (await post('/api/checkin', { identificador })).json();

describe('POST /api/checkin', () => {
  it('socio al día: permitido, con nombre y días restantes', async () => {
    const ana = await alta({ nombre: 'Ana', apellido: 'Quispe', ci: '1234567' });
    membresia(ana.id, sumarDias(hoy, -10), sumarDias(hoy, 19));

    expect(await ingresar(String(ana.nroSocio))).toMatchObject({
      encontrado: true,
      resultado: 'permitido',
      permitir: true,
      diasRestantes: 19,
      mensaje: 'Quedan 19 días',
      socio: { nombreCompleto: 'Ana Quispe', nroSocio: ana.nroSocio },
    });
  });

  it('encuentra por CI aunque lo tecleen con puntos', async () => {
    const ana = await alta({ nombre: 'Ana', ci: '1234567' });
    membresia(ana.id, sumarDias(hoy, -10), sumarDias(hoy, 19));

    const r = await ingresar(' 1.234.567 ');
    expect(r.socio.clienteId).toBe(ana.id);
  });

  it('le quedan 2 días: entra, pero avisa', async () => {
    const ana = await alta({ nombre: 'Ana' });
    membresia(ana.id, sumarDias(hoy, -27), sumarDias(hoy, 2));

    expect(await ingresar(String(ana.nroSocio))).toMatchObject({
      resultado: 'por_vencer',
      permitir: true,
      mensaje: 'Vence en 2 días',
    });
  });

  it('ya renovó por adelantado: no se le avisa que está por vencer', async () => {
    const ana = await alta({ nombre: 'Ana' });
    membresia(ana.id, sumarDias(hoy, -27), sumarDias(hoy, 2));
    membresia(ana.id, sumarDias(hoy, 3), sumarDias(hoy, 32));

    expect(await ingresar(String(ana.nroSocio))).toMatchObject({
      resultado: 'permitido',
      diasRestantes: 32,
    });
  });

  it('vencido: rechazado, y dice hace cuánto', async () => {
    const ana = await alta({ nombre: 'Ana' });
    membresia(ana.id, sumarDias(hoy, -33), sumarDias(hoy, -4));

    expect(await ingresar(String(ana.nroSocio))).toMatchObject({
      resultado: 'vencido',
      permitir: false,
      mensaje: 'Venció hace 4 días',
    });
  });

  it('nunca compró nada: sin membresía', async () => {
    const ana = await alta({ nombre: 'Ana' });

    expect(await ingresar(String(ana.nroSocio))).toMatchObject({
      resultado: 'sin_membresia',
      permitir: false,
    });
  });

  it('pase por sesión de hoy: "válido hoy", no "vence hoy"', async () => {
    const ana = await alta({ nombre: 'Ana' });
    membresia(ana.id, hoy, hoy, sesionId);

    expect(await ingresar(String(ana.nroSocio))).toMatchObject({
      resultado: 'permitido',
      permitir: true,
      mensaje: 'Pase por sesión — válido hoy',
    });
  });

  it('bloqueado: rebota aunque esté al día', async () => {
    const ana = await alta({ nombre: 'Ana' });
    membresia(ana.id, sumarDias(hoy, -10), sumarDias(hoy, 19));
    db.update(clientes).set({ bloqueado: true }).where(eq(clientes.id, ana.id)).run();

    expect(await ingresar(String(ana.nroSocio))).toMatchObject({
      permitir: false,
      mensaje: 'Acceso bloqueado — pasar por administración',
    });
  });

  it('pagó para arrancar más adelante: hoy no entra, y se le dice cuándo empieza', async () => {
    const ana = await alta({ nombre: 'Ana' });
    membresia(ana.id, sumarDias(hoy, 4), sumarDias(hoy, 33));

    expect(await ingresar(String(ana.nroSocio))).toMatchObject({
      permitir: false,
      resultado: 'sin_membresia',
      proximaDesde: sumarDias(hoy, 4),
    });
  });

  it('una venta cancelada no deja entrar', async () => {
    const ana = await alta({ nombre: 'Ana' });
    const cancelada = membresia(ana.id, sumarDias(hoy, -10), sumarDias(hoy, 19));
    db.update(membresias)
      .set({ estado: 'cancelada' })
      .where(eq(membresias.id, cancelada.id))
      .run();

    expect((await ingresar(String(ana.nroSocio))).permitir).toBe(false);
  });

  it('registra SIEMPRE el ingreso: los permitidos y los rechazados', async () => {
    const alDia = await alta({ nombre: 'Ana' });
    const actual = membresia(alDia.id, sumarDias(hoy, -10), sumarDias(hoy, 19));
    const vencido = await alta({ nombre: 'Beto' });
    membresia(vencido.id, sumarDias(hoy, -40), sumarDias(hoy, -11));

    await ingresar(String(alDia.nroSocio));
    await ingresar(String(vencido.nroSocio));
    await ingresar(String(vencido.nroSocio)); // insiste: también queda

    const filas = db.select().from(ingresos).all();
    expect(filas.map((f) => f.resultado)).toEqual(['permitido', 'vencido', 'vencido']);
    expect(filas[0]).toMatchObject({
      clienteId: alDia.id,
      membresiaId: actual.id,
      fecha: hoy,
    });
  });

  it('un número que no es de nadie: no encontrado, y no guarda nada', async () => {
    expect(await ingresar('99999')).toEqual({
      encontrado: false,
      identificador: '99999',
    });
    expect(db.select().from(ingresos).all()).toHaveLength(0);
  });

  it('un cliente dado de baja no se encuentra', async () => {
    const ana = await alta({ nombre: 'Ana' });
    await app.request(`/api/clientes/${ana.id}`, { method: 'DELETE' });

    expect((await ingresar(String(ana.nroSocio))).encontrado).toBe(false);
  });

  it('400 si no se tecleó nada', async () => {
    expect((await post('/api/checkin', { identificador: '   ' })).status).toBe(400);
  });

  it('con 150 socios cargados responde muy por debajo de los 100ms', async () => {
    const socios: Array<{ id: number; nroSocio: number }> = [];
    for (let i = 0; i < 150; i++) {
      const socio = await alta({ nombre: `Socio ${i}`, ci: String(4_000_000 + i) });
      // cinco meses de historial por socio
      for (let mes = 4; mes >= 0; mes--) {
        membresia(
          socio.id,
          sumarDias(hoy, -30 * mes - 10),
          sumarDias(hoy, -30 * mes + 19),
        );
      }
      socios.push(socio);
    }

    const tiempos: number[] = [];
    for (const socio of socios) {
      const inicio = performance.now();
      const res = await post('/api/checkin', { identificador: String(socio.nroSocio) });
      tiempos.push(performance.now() - inicio);
      expect(res.status).toBe(200);
    }

    tiempos.sort((a, b) => a - b);
    const p95 = tiempos[Math.floor(tiempos.length * 0.95)]!;
    expect(p95).toBeLessThan(100);
  });
});
