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
 * Direcciones de red donde escucha el servidor. Una, o varias separadas por
 * coma.
 *
 * Default `127.0.0.1`: solo la PC de recepción. Para que el dueño entre por
 * Tailscale, lo seguro es sumar SOLO la dirección de Tailscale de esta PC:
 * `HOST=127.0.0.1,100.x.y.z`. Así el sistema no queda a la vista en el wifi
 * del gimnasio.
 *
 * `HOST=0.0.0.0` (todas las redes) también funciona, pero deja el sistema
 * visible para cualquiera conectado al wifi, y el tráfico va sin cifrar.
 * Ver docs/INSTALACION.md antes de usarlo.
 */
export function hosts(): string[] {
  const lista = (process.env.HOST ?? '')
    .split(',')
    .map((direccion) => direccion.trim())
    .filter(Boolean);
  return lista.length > 0 ? [...new Set(lista)] : ['127.0.0.1'];
}

/** Carpeta local de respaldos. */
export function carpetaRespaldos(): string {
  return process.env.GYM_RESPALDOS?.trim() || './respaldos';
}

/** Carpeta sincronizada a la nube (Drive, OneDrive…). Sin default: depende de cada PC. */
export function carpetaRespaldosNube(): string | undefined {
  return process.env.GYM_RESPALDOS_NUBE?.trim() || undefined;
}

/**
 * Horas sin uso tras las que una sesión se cierra sola.
 *
 * Default 8: un turno. Recepción entra una vez por turno, y el kiosco del
 * check-in no se corta mientras se use.
 */
export function horasDeSesion(): number {
  const crudo = process.env.GYM_SESION_HORAS?.trim();
  if (!crudo) return 8;

  const n = Number(crudo);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(
      `GYM_SESION_HORAS inválido: "${crudo}". Tiene que ser un número mayor que 0.`,
    );
  }
  return n;
}
