/**
 * Cliente RPC tipado. El puente entre Vue y Hono.
 *
 * `AppType` viene del servidor, así que `api.clientes.$get()` conoce los
 * parámetros que acepta y la forma exacta de lo que devuelve. Si en el backend
 * renombrás `nroSocio`, el frontend deja de compilar en ese mismo instante.
 * Cero tipos duplicados, cero código generado, cero Postman para saber qué
 * devuelve un endpoint.
 */

import { hc } from 'hono/client';
import type { AppType } from '@/server';

export const client = hc<AppType>('/');
export const api = client.api;

/**
 * Convierte una respuesta de error en algo mostrable.
 *
 * El backend siempre responde { error, mensaje, detalles }, así que esto es
 * una sola función y no un `if` distinto en cada pantalla. Ese es el pago de
 * tener un único middleware de errores.
 */
export interface ErrorApi {
  error: string;
  mensaje: string;
  detalles?: Record<string, unknown>;
}

export class ErrorDeApi extends Error {
  constructor(
    readonly codigo: string,
    mensaje: string,
    readonly status: number,
    readonly detalles: Record<string, unknown> = {},
  ) {
    super(mensaje);
    this.name = 'ErrorDeApi';
  }
}

/**
 * Envuelve una llamada del cliente RPC: si la respuesta no es OK, lanza un
 * ErrorDeApi con el mensaje que escribió el backend (que ya está redactado
 * para que lo lea recepción, no un stack trace).
 */
export async function pedir<T>(promesa: Promise<Response>): Promise<T> {
  const res = await promesa;

  if (!res.ok) {
    let cuerpo: Partial<ErrorApi> = {};
    try {
      cuerpo = (await res.json()) as ErrorApi;
    } catch {
      // una respuesta sin JSON (502, caída de red): el mensaje genérico sirve
    }
    throw new ErrorDeApi(
      cuerpo.error ?? 'ERROR_DESCONOCIDO',
      cuerpo.mensaje ?? 'No se pudo completar la operación',
      res.status,
      cuerpo.detalles ?? {},
    );
  }

  return (await res.json()) as T;
}
