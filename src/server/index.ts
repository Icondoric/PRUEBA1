/**
 * El servidor. Un solo proceso: API + la SPA de Vue en el mismo puerto.
 *
 * El `export type AppType` del final es el contrato con el frontend. Hono
 * deriva de las rutas el tipo exacto de cada endpoint, y el cliente de Vue lo
 * importa. Si mañana renombrás un campo en el backend, el frontend deja de
 * compilar en el acto, sin generar nada ni mantener tipos a mano.
 */

import { Hono } from 'hono';
import { logger } from 'hono/logger';
import type { DB } from '@/lib/db';
import { moduloClientes } from '@/modules/clientes';
import { moduloMembresias } from '@/modules/membresias';
import { moduloUsuarios } from '@/modules/usuarios';
import { manejadorDeErrores } from './middleware/errores';

export function crearApp(db: DB) {
  const clientes = moduloClientes(db);
  const usuarios = moduloUsuarios(db);
  const membresias = moduloMembresias(db, {
    clientes: clientes.servicio,
    // Provisorio hasta que haya login: ver modules/usuarios.
    operadorActual: () => usuarios.servicio.operadorActual().id,
  });

  const app = new Hono()
    .use('*', logger())
    .onError(manejadorDeErrores)
    // Mismo contrato { error, mensaje } que el resto: una ruta de API que no
    // existe no debe devolver texto plano ni el HTML de la SPA.
    .notFound((c) =>
      c.json({ error: 'NO_ENCONTRADO', mensaje: 'Esa ruta no existe' }, 404),
    )
    .get('/api/salud', (c) => c.json({ ok: true }))
    .route('/api/clientes', clientes.rutas)
    .route('/api/planes', membresias.rutasPlanes)
    .route('/api/membresias', membresias.rutas);

  return app;
}

/** El tipo que importa el frontend para el cliente RPC. */
export type AppType = ReturnType<typeof crearApp>;
