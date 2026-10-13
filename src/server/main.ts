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
import { hosts, puerto, rutaDb } from '@/lib/config';
import { crearDb, migrar } from '@/lib/db';
import { crearApp } from './index';
import { cabecerasDePagina } from './middleware/proteccion';

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

const atender: Manejador = (req, res) => {
  const ruta = req.url ?? '/';
  if (ruta === '/api' || ruta.startsWith('/api/')) manejarApi(req, res);
  else manejarSpa(req, res);
};

// Un servidor por cada dirección donde se escucha (ver `hosts` en config).
const direcciones = hosts();
const servidores = direcciones.map(() => {
  const servidor = createServer(atender);
  // Nadie necesita tener un pedido abierto medio minuto: un formulario llega
  // en milisegundos. Esto corta al que abre conexiones y no termina de hablar.
  servidor.headersTimeout = 15_000;
  servidor.requestTimeout = 30_000;
  servidor.maxConnections = 256;
  return servidor;
});

if (esProduccion) {
  const estaticos = new Hono()
    .use('*', cabecerasDePagina())
    .use('*', serveStatic({ root: './dist/web' }))
    .get('*', serveStatic({ path: './dist/web/index.html' }));
  manejarSpa = getRequestListener(estaticos.fetch);
} else {
  // Import dinámico: Vite es devDependency y en producción no está instalado.
  const { createServer: crearVite } = await import('vite');
  const vite = await crearVite({
    appType: 'spa',
    server: { middlewareMode: true, hmr: { server: servidores[0] } },
  });
  manejarSpa = (req, res) => vite.middlewares(req, res);
}

servidores.forEach((servidor, i) => {
  const direccion = direcciones[i];
  servidor.listen(puerto(), direccion, () => {
    process.stdout.write(
      `Gimnasio en http://${direccion}:${puerto()} — ` +
        `${esProduccion ? 'producción' : 'desarrollo'}, base: ${archivoDb}\n`,
    );
  });
});

if (direcciones.includes('0.0.0.0') || direcciones.includes('::')) {
  process.stdout.write(
    'ATENCIÓN: el sistema escucha en TODAS las redes, también el wifi. ' +
      'El tráfico va sin cifrar. Ver docs/INSTALACION.md, punto 4.\n',
  );
}

function apagar() {
  let abiertos = servidores.length;
  for (const servidor of servidores) {
    servidor.closeAllConnections();
    servidor.close(() => {
      abiertos -= 1;
      if (abiertos > 0) return;
      db.$client.close();
      process.exit(0);
    });
  }
}

process.on('SIGINT', apagar);
process.on('SIGTERM', apagar);
