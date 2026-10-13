/**
 * Respaldo de la base.
 *
 * Esta es la única pieza del sistema que protege contra "se quemó la PC".
 * Tratala con el mismo respeto que a la lógica de cobros.
 *
 * Estrategia, deliberadamente aburrida:
 *   1. `VACUUM INTO` genera una copia consistente SIN cerrar la base ni parar
 *      el sistema. No copies el archivo .db con `cp`: si alguien está
 *      escribiendo, la copia sale corrupta y te enterás el día que la necesitás.
 *   2. La copia se escribe en una carpeta local Y en una carpeta sincronizada
 *      a la nube (Google Drive / OneDrive / Dropbox de escritorio). El cliente
 *      de sincronización hace la subida; nosotros no hablamos con ninguna API.
 *   3. Se rotan las copias: se conservan las últimas 14 diarias.
 *
 * Por qué una carpeta sincronizada y no S3: no hay credenciales que vencen,
 * no hay API que cambie, funciona igual en Windows, Mac y Linux, y el dueño
 * puede ver sus respaldos desde el celular. Para un gimnasio de 150 socios la
 * base pesa pocos MB.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  copyFileSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const RETENER = 14;

export interface OpcionesBackup {
  rutaDb: string;
  /** Carpeta local de respaldos. Siempre se escribe acá. */
  carpetaLocal: string;
  /** Carpeta sincronizada a la nube. Opcional: si no existe, se avisa. */
  carpetaNube?: string;
  ahora?: Date;
}

export interface ResultadoBackup {
  archivo: string;
  bytes: number;
  copiadoANube: boolean;
  eliminados: string[];
  advertencia: string | null;
}

function sello(d: Date): string {
  // 2026-10-11_1430 — ordenable alfabéticamente, legible por una persona
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

export function respaldar(opciones: OpcionesBackup): ResultadoBackup {
  const { rutaDb, carpetaLocal, carpetaNube, ahora = new Date() } = opciones;

  if (!existsSync(rutaDb)) throw new Error(`No existe la base: ${rutaDb}`);
  mkdirSync(carpetaLocal, { recursive: true });

  const nombre = `gimnasio_${sello(ahora)}.db`;
  const destino = join(carpetaLocal, nombre);

  // Copia consistente en caliente. Falla si el destino ya existe, a propósito.
  const db = new Database(rutaDb, { readonly: true });
  try {
    db.prepare('VACUUM INTO ?').run(destino);
  } finally {
    db.close();
  }

  // La copia no necesita las sesiones abiertas: quien restaure vuelve a
  // ingresar. Así un respaldo que alguien encuentre no trae ninguna.
  const copia = new Database(destino);
  try {
    const tieneSesiones = copia
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'sesiones'")
      .get();
    if (tieneSesiones) copia.prepare('DELETE FROM sesiones').run();
  } finally {
    copia.close();
  }

  const bytes = statSync(destino).size;
  if (bytes === 0) {
    rmSync(destino, { force: true });
    throw new Error('El respaldo salió vacío; se descartó.');
  }

  // Verificación: la copia tiene que abrirse y responder.
  const verif = new Database(destino, { readonly: true });
  try {
    const { total } = verif.prepare('SELECT COUNT(*) AS total FROM clientes').get() as {
      total: number;
    };
    if (typeof total !== 'number') throw new Error('Respaldo ilegible');
  } finally {
    verif.close();
  }

  let copiadoANube = false;
  let advertencia: string | null = null;

  if (carpetaNube) {
    if (existsSync(carpetaNube)) {
      copyFileSync(destino, join(carpetaNube, nombre));
      copiadoANube = true;
    } else {
      advertencia =
        `La carpeta de nube no existe: ${carpetaNube}. ` +
        'El respaldo quedó SOLO en esta PC.';
    }
  }

  const eliminados = rotar(carpetaLocal);
  if (carpetaNube && copiadoANube) rotar(carpetaNube);

  return { archivo: destino, bytes, copiadoANube, eliminados, advertencia };
}

/** Conserva las últimas RETENER copias; borra las más viejas. */
function rotar(carpeta: string): string[] {
  const copias = readdirSync(carpeta)
    .filter((f) => f.startsWith('gimnasio_') && f.endsWith('.db'))
    .sort()
    .reverse();

  const sobrantes = copias.slice(RETENER);
  for (const f of sobrantes) rmSync(join(carpeta, f), { force: true });
  return sobrantes;
}
