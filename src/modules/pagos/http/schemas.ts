/**
 * CAPA HTTP — forma de las entradas de pagos.
 */

import { z } from 'zod';
import { METODOS } from '../domain/pago';

export const listarPagosQuerySchema = z.object({
  desde: z.string().max(10).optional(),
  hasta: z.string().max(10).optional(),
  metodo: z.enum(METODOS).optional(),
});

export const pagosDeClienteQuerySchema = z.object({
  clienteId: z.coerce.number().int().positive(),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/** Lo importa también el diálogo de anulación. */
export const anulacionInputSchema = z.object({
  motivo: z
    .string({ error: 'Escribí por qué se anula el pago' })
    .trim()
    .min(1, 'Escribí por qué se anula el pago')
    .max(300, 'El motivo no puede pasar de 300 caracteres'),
});
