/**
 * CAPA DOMAIN — reglas de usuarios, contraseñas y sesiones. Puras: el reloj
 * (`ahora`) entra por parámetro.
 */

import { ReglaDeNegocioError } from '@/lib/errors';

const LARGO_MINIMO_PASSWORD = 8;
const LARGO_MAXIMO_PASSWORD = 200;

/** Tantos intentos fallidos seguidos y la cuenta descansa un rato. */
export const INTENTOS_ANTES_DE_BLOQUEAR = 5;
export const SEGUNDOS_DE_BLOQUEO = 60;

/** El nombre de usuario se guarda en minúsculas: "Ana" y "ana" son la misma cuenta. */
export function normalizarUsuario(entrada: string): string {
  return entrada.trim().toLowerCase();
}

export function validarUsuario(entrada: string): string {
  const usuario = normalizarUsuario(entrada);
  if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) {
    throw new ReglaDeNegocioError(
      'El usuario tiene que tener entre 3 y 30 caracteres: letras, números, punto o guion, sin espacios',
      { campo: 'usuario' },
    );
  }
  return usuario;
}

export function validarNombre(entrada: string): string {
  const nombre = entrada.trim();
  if (nombre.length < 2) {
    throw new ReglaDeNegocioError('El nombre es obligatorio', { campo: 'nombre' });
  }
  return nombre;
}

export function validarPassword(password: string): string {
  if (password.length < LARGO_MINIMO_PASSWORD) {
    throw new ReglaDeNegocioError(
      `La contraseña tiene que tener al menos ${LARGO_MINIMO_PASSWORD} caracteres`,
      { campo: 'password' },
    );
  }
  if (password.length > LARGO_MAXIMO_PASSWORD) {
    throw new ReglaDeNegocioError('La contraseña es demasiado larga', {
      campo: 'password',
    });
  }
  return password;
}

/** Una sesión vence por inactividad: `horas` desde la última vez que se usó. */
export function sesionVigente(ultimoUso: Date, ahora: Date, horas: number): boolean {
  return ahora.getTime() - ultimoUso.getTime() <= horas * 3_600_000;
}

export interface IntentosFallidos {
  cantidad: number;
  ultimo: Date;
}

/** Segundos que faltan para poder volver a intentar. 0 = puede intentar ya. */
export function segundosDeEspera(
  intentos: IntentosFallidos | undefined,
  ahora: Date,
): number {
  if (!intentos || intentos.cantidad < INTENTOS_ANTES_DE_BLOQUEAR) return 0;

  const transcurridos = (ahora.getTime() - intentos.ultimo.getTime()) / 1000;
  return Math.max(0, Math.ceil(SEGUNDOS_DE_BLOQUEO - transcurridos));
}
