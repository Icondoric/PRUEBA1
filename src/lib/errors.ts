/**
 * Errores de la aplicación.
 *
 * Decisión: excepciones tipadas, no Result. Un único middleware las traduce a
 * respuestas HTTP, así que ninguna capa de negocio sabe qué es un código 404.
 *
 * Reglas:
 *   - El dominio y la aplicación lanzan estos errores, nunca `new Error()`
 *     pelado y nunca un objeto con `status`.
 *   - `mensaje` lo lee una persona en recepción: en español, sin jerga, y
 *     diciendo qué hacer cuando se puede.
 *   - `detalles` es para el log y el frontend, no para mostrar crudo.
 *   - Un error que el usuario no puede resolver NO es un AppError: que
 *     explote y lo tome el handler como 500. Esconder fallas técnicas detrás
 *     de un mensaje amable es cómo se pierden datos sin que nadie se entere.
 */

export abstract class AppError extends Error {
  abstract readonly codigo: string;
  abstract readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429;
  readonly detalles: Record<string, unknown>;

  constructor(mensaje: string, detalles: Record<string, unknown> = {}) {
    super(mensaje);
    this.name = new.target.name;
    this.detalles = detalles;
  }

  aJSON() {
    return { error: this.codigo, mensaje: this.message, detalles: this.detalles };
  }
}

/** La entrada no cumple las reglas del negocio (no es un problema de formato). */
export class ReglaDeNegocioError extends AppError {
  readonly codigo = 'REGLA_DE_NEGOCIO';
  readonly status = 422 as const;
}

/** No existe lo que se pidió. */
export class NoEncontradoError extends AppError {
  readonly codigo = 'NO_ENCONTRADO';
  readonly status = 404 as const;

  constructor(que: string, identificador?: string | number) {
    super(
      identificador === undefined
        ? `No se encontró ${que}`
        : `No se encontró ${que}: ${identificador}`,
      { que, identificador },
    );
  }
}

/** Ya existe algo que debería ser único (CI repetido, por ejemplo). */
export class ConflictoError extends AppError {
  readonly codigo = 'CONFLICTO';
  readonly status = 409 as const;
}

export class NoAutenticadoError extends AppError {
  readonly codigo = 'NO_AUTENTICADO';
  readonly status = 401 as const;
  constructor(mensaje = 'Hay que iniciar sesión') {
    super(mensaje);
  }
}

export class SinPermisoError extends AppError {
  readonly codigo = 'SIN_PERMISO';
  readonly status = 403 as const;
  constructor(mensaje = 'Esta cuenta no puede hacer esta operación') {
    super(mensaje);
  }
}

/** El pedido trae más datos de los que el sistema acepta. */
export class DemasiadoGrandeError extends AppError {
  readonly codigo = 'DEMASIADO_GRANDE';
  readonly status = 413 as const;
  constructor(mensaje = 'Eso es demasiado largo para guardarlo') {
    super(mensaje);
  }
}

/** Demasiados intentos seguidos: hay que esperar. */
export class DemasiadosIntentosError extends AppError {
  readonly codigo = 'DEMASIADOS_INTENTOS';
  readonly status = 429 as const;
}

export function esAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
