/**
 * Configuración por variables de entorno. Un solo lugar para los defaults, así
 * el servidor, el seed y el respaldo apuntan siempre al mismo archivo.
 *
 * Las rutas son relativas a la carpeta desde donde se arranca el proceso y van
 * con `/`: Node las resuelve igual en Windows, macOS y Linux.
 */

/** Archivo SQLite. Mismo default que drizzle.config.ts. */
export function rutaDb(): string {
  return process.env.GYM_DB?.trim() || './datos/gimnasio.db';
}

export function puerto(): number {
  const crudo = process.env.PORT?.trim();
  if (!crudo) return 3000;

  const n = Number(crudo);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(
      `PORT inválido: "${crudo}". Tiene que ser un entero entre 1 y 65535.`,
    );
  }
  return n;
}

/**
 * Interfaz de red donde escucha el servidor.
 *
 * Default `127.0.0.1`: solo la PC de recepción. Todavía no hay login, así que
 * escuchar en todas las interfaces dejaría la API abierta a cualquiera en el
 * wifi del gimnasio. Para que el dueño entre por Tailscale: `HOST=0.0.0.0`,
 * y recién cuando exista el módulo de auth.
 */
export function host(): string {
  return process.env.HOST?.trim() || '127.0.0.1';
}

/** Carpeta local de respaldos. */
export function carpetaRespaldos(): string {
  return process.env.GYM_RESPALDOS?.trim() || './respaldos';
}

/** Carpeta sincronizada a la nube (Drive, OneDrive…). Sin default: depende de cada PC. */
export function carpetaRespaldosNube(): string | undefined {
  return process.env.GYM_RESPALDOS_NUBE?.trim() || undefined;
}
