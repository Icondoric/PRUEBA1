/**
 * `pnpm backup` — envoltorio de línea de comandos de scripts/backup.ts.
 *
 * Variables de entorno:
 *   GYM_DB               archivo de la base       (default ./datos/gimnasio.db)
 *   GYM_RESPALDOS        carpeta local            (default ./respaldos)
 *   GYM_RESPALDOS_NUBE   carpeta sincronizada a la nube (sin default)
 *
 * Código de salida, para que la tarea programada se entere:
 *   0  respaldo hecho
 *   1  el respaldo falló
 *   2  el respaldo quedó solo en esta PC aunque había carpeta de nube configurada
 */

import { carpetaRespaldos, carpetaRespaldosNube, rutaDb } from '@/lib/config';
import { respaldar } from './backup';

const decir = (linea: string) => process.stdout.write(`${linea}\n`);

const carpetaNube = carpetaRespaldosNube();

try {
  const r = respaldar({
    rutaDb: rutaDb(),
    carpetaLocal: carpetaRespaldos(),
    carpetaNube,
  });

  decir(`Respaldo: ${r.archivo} (${(r.bytes / 1024).toFixed(0)} KB)`);
  decir(r.copiadoANube ? `Copiado a la nube: ${carpetaNube}` : 'NO se copió a la nube.');
  if (r.eliminados.length > 0) decir(`Copias viejas eliminadas: ${r.eliminados.length}`);

  if (r.advertencia) {
    console.warn(`ATENCIÓN: ${r.advertencia}`);
    process.exitCode = 2;
  } else if (!carpetaNube) {
    console.warn(
      'ATENCIÓN: GYM_RESPALDOS_NUBE no está definida. El respaldo quedó SOLO en esta PC: ' +
        'si se rompe el disco, se pierde también.',
    );
  }
} catch (error) {
  console.error('El respaldo FALLÓ:', error);
  process.exitCode = 1;
}
