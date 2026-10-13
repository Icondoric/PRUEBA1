/**
 * Guardado y verificación de contraseñas y tokens de sesión.
 *
 * Con lo que trae Node (`scrypt`), sin dependencias. La contraseña nunca se
 * guarda: se guarda un hash con sal propia, que no se puede revertir.
 *
 * Formato: `scrypt$<sal hex>$<hash hex>`.
 */

import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const LARGO_HASH = 64;

export function hashearPassword(password: string): string {
  const sal = randomBytes(16);
  const hash = scryptSync(password, sal, LARGO_HASH);
  return `scrypt$${sal.toString('hex')}$${hash.toString('hex')}`;
}

export function passwordCoincide(password: string, guardado: string): boolean {
  const [esquema, salHex, hashHex] = guardado.split('$');
  if (esquema !== 'scrypt' || !salHex || !hashHex) return false;

  const esperado = Buffer.from(hashHex, 'hex');
  if (esperado.length !== LARGO_HASH) return false;

  const calculado = scryptSync(password, Buffer.from(salHex, 'hex'), LARGO_HASH);
  // Comparación en tiempo constante: no filtra cuántos bytes coincidieron.
  return timingSafeEqual(calculado, esperado);
}

/** Un hash que no corresponde a ninguna contraseña: nadie entra con él. */
export function hashInutilizable(): string {
  return hashearPassword(randomBytes(32).toString('hex'));
}

let senuelo: string | undefined;

/**
 * Gasta lo mismo que verificar una contraseña de verdad, contra un hash que no
 * es de nadie. Se usa cuando el usuario no existe: si esa respuesta saliera
 * más rápido, el tiempo solo alcanzaría para averiguar qué cuentas existen.
 */
export function gastarComoVerificacion(password: string): void {
  senuelo ??= hashInutilizable();
  passwordCoincide(password, senuelo);
}

/** El token viaja en la cookie; en la base queda solo su hash. */
export function nuevoToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashDeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
