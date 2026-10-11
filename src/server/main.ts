/**
 * Arranque del proceso. Un solo puerto para todo:
 *
 *   /api/*   → la app de Hono (crearApp)
 *   el resto → la SPA de Vue
 *               · desarrollo: Vite en modo middleware, con HMR sobre este mismo
 *                 servidor HTTP
 *               · producción: los archivos de dist/web, y index.html para
 *                 cualquier ruta que resuelve vue-router
 *
 * La SPA se monta acá y no dentro de crearApp para que `AppType` siga siendo
 * solo el contrato de la API.
 */

import { mkdirSync } from 'node:fs';
import { type IncomingMessage, type ServerResponse, createServer } from 'node:http';
import { dirname } from 'node:path';
import { getRequestListener } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { host, puerto, rutaDb } from '@/lib/config';
import { crearDb, migrar } from '@/lib/db';
import { crearApp } from './index';

type Manejador = (req: IncomingMessage, res: ServerResponse) => void;

// `vite build` reemplaza import.meta.env; corriendo con tsx no existe.
const esProduccion = import.meta.env?.PROD === true;

const archivoDb = rutaDb();
mkdirSync(dirname(archivoDb), { recursive: true });

const db = crearDb(archivoDb);
// Si una migración falla, el proceso no arranca: mejor eso que atender el
// mostrador con un esquema a medias.
migrar(db);

const manejarApi = getRequestListener(crearApp(db).fetch);

let manejarSpa: Manejador;

const servidor = createServer((req, res) => {
  const ruta = req.url ?? '/';
  if (ruta === '/api' || ruta.startsWith('/api/')) manejarApi(req, res);
  else manejarSpa(req, res);
});

if (esProduccion) {
  const estaticos = new Hono()
    .use('*', serveStatic({ root: './dist/web' }))
    .get('*', serveStatic({ path: './dist/web/index.html' }));
  manejarSpa = getRequestListener(estaticos.fetch);
} else {
  // Import dinámico: Vite es devDependency y en producción no está instalado.
  const { createServer: crearVite } = await import('vite');
  const vite = await crearVite({
    appType: 'spa',
    server: { middlewareMode: true, hmr: { server: servidor } },
  });
  manejarSpa = (req, res) => vite.middlewares(req, res);
}

servidor.listen(puerto(), host(), () => {
  process.stdout.write(
    `Gimnasio en http://${host()}:${puerto()} — ` +
      `${esProduccion ? 'producción' : 'desarrollo'}, base: ${archivoDb}\n`,
  );
});

function apagar() {
  servidor.closeAllConnections();
  servidor.close(() => {
    db.$client.close();
    process.exit(0);
  });
}

process.on('SIGINT', apagar);
process.on('SIGTERM', apagar);
