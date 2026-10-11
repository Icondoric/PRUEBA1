/**
 * El ÚNICO lugar donde un error se convierte en respuesta HTTP.
 *
 * Por qué uno solo: si cada ruta maneja sus errores, terminás con cinco
 * formatos distintos de respuesta de error y el frontend tiene que adivinar
 * cuál le tocó. Acá el contrato es uno: { error, mensaje, detalles }.
 */

import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { esAppError } from '@/lib/errors';

export function manejadorDeErrores(err: Error, c: Context) {
  if (esAppError(err)) {
    return c.json(err.aJSON(), err.status);
  }

  // Zod falla por acá vía @hono/zod-validator: es error de forma, no de negocio.
  if (err instanceof HTTPException) {
    return c.json(
      { error: 'ENTRADA_INVALIDA', mensaje: 'Revisá los datos del formulario' },
      err.status,
    );
  }

  // Lo que llega acá es un bug o la base caída. No lo disfrazamos de mensaje
  // amable: se registra entero y se devuelve un 500 honesto.
  console.error('[error no manejado]', err);

  return c.json(
    {
      error: 'ERROR_INTERNO',
      mensaje: 'Algo falló en el sistema. Avisale al administrador.',
    },
    500,
  );
}
