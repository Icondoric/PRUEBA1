/**
 * El servidor. Un solo proceso: API + la SPA de Vue en el mismo puerto.
 *
 * El `export type AppType` del final es el contrato con el frontend. Hono
 * deriva de las rutas el tipo exacto de cada endpoint, y el cliente de Vue lo
 * importa. Si mañana renombrás un campo en el backend, el frontend deja de
 * compilar en el acto, sin generar nada ni mantener tipos a mano.
 *
 * Quién puede llamar a cada ruta NO se decide acá ni en los módulos: está todo
 * en `./acceso.ts`, y lo aplica el guardia antes de que el pedido llegue a
 * cualquier ruta.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { logger } from 'hono/logger';
import { horasDeSesion } from '@/lib/config';
import type { DB } from '@/lib/db';
import { moduloCheckin } from '@/modules/checkin';
import { moduloClientes } from '@/modules/clientes';
import { moduloMembresias } from '@/modules/membresias';
import { moduloPagos } from '@/modules/pagos';
import { moduloPlanes } from '@/modules/planes';
import { moduloReportes } from '@/modules/reportes';
import { moduloUsuarios, puede } from '@/modules/usuarios';
import { moduloVisitas } from '@/modules/visitas';
import { manejadorDeErrores } from './middleware/errores';
import { type Entorno, guardia, usuarioDe } from './middleware/sesion';

export interface OpcionesDeApp {
  /** La hora real. Los tests la reemplazan para adelantar el reloj. */
  ahora?: () => Date;
  horasDeSesion?: number;
}

export function crearApp(db: DB, opciones: OpcionesDeApp = {}) {
  const ahora = opciones.ahora ?? (() => new Date());

  const usuarios = moduloUsuarios(db, {
    horasDeSesion: opciones.horasDeSesion ?? horasDeSesion(),
  });
  const rutasDeUsuarios = usuarios.rutas({ usuarioActual: usuarioDe, ahora });

  /** Quien inició sesión: queda como autor de lo que registre. */
  const operadorActual = (c: Context) => usuarioDe(c).id;

  const clientes = moduloClientes(db, {
    puedeVerBajas: (c) => puede(usuarioDe(c), 'clientes.baja'),
  });
  const membresias = moduloMembresias(db, {
    clientes: clientes.servicio,
    operadorActual,
  });
  const checkin = moduloCheckin(db, {
    clientes: clientes.servicio,
    membresias: membresias.servicio,
    operadorActual,
  });
  const pagos = moduloPagos(db, {
    clientes: clientes.servicio,
    operadorActual,
    ahora,
    puedeVerOtrasFechas: (c) => puede(usuarioDe(c), 'pagos.otras_fechas'),
  });
  const visitas = moduloVisitas(db, { clientes: clientes.servicio, operadorActual });
  const reportes = moduloReportes(db);
  const planes = moduloPlanes(db);

  const app = new Hono<Entorno>()
    .use('*', logger())
    .onError(manejadorDeErrores)
    // Mismo contrato { error, mensaje } que el resto: una ruta de API que no
    // existe no debe devolver texto plano ni el HTML de la SPA.
    .notFound((c) =>
      c.json({ error: 'NO_ENCONTRADO', mensaje: 'Esa ruta no existe' }, 404),
    )
    // Nada de /api pasa de acá sin sesión y sin el acceso que le corresponde.
    .use('/api/*', guardia(usuarios.servicio, ahora))
    .get('/api/salud', (c) => c.json({ ok: true }))
    .route('/api/sesion', rutasDeUsuarios.sesion)
    .route('/api/usuarios', rutasDeUsuarios.usuarios)
    .route('/api/clientes', clientes.rutas)
    .route('/api/planes', membresias.rutasPlanes)
    .route('/api/gestion-planes', planes.rutas)
    .route('/api/membresias', membresias.rutas)
    .route('/api/checkin', checkin.rutas)
    .route('/api/pagos', pagos.rutas)
    .route('/api/visitas', visitas.rutas)
    .route('/api/reportes', reportes.rutas);

  return app;
}

/** El tipo que importa el frontend para el cliente RPC. */
export type AppType = ReturnType<typeof crearApp>;
