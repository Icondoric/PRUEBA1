/**
 * CAPA HTTP — esquemas Zod del borde. Validan FORMA, no reglas.
 *
 * "La fecha de inicio no puede ser anterior a hoy" es una regla y vive en el
 * dominio (`cotizarVenta`). Acá solo se comprueba que haya venido un texto.
 *
 * `ventaInputSchema` lo importa también la pantalla de venta.
 */

import { z } from 'zod';
import { METODOS } from '@/modules/pagos';

/** Los métodos de pago los define el módulo de pagos; acá solo se reusan. */
export const METODOS_PAGO = METODOS;

const id = (queEs: string) =>
  z.coerce
    .number({ error: `Elegí ${queEs}` })
    .int()
    .positive(`Elegí ${queEs}`);

export const cotizacionQuerySchema = z.object({
  clienteId: id('un cliente'),
  planId: id('un plan'),
  inicio: z.string().max(10).optional(),
});

export const ventaInputSchema = z.object({
  clienteId: id('un cliente'),
  planId: id('un plan'),
  metodo: z.enum(METODOS_PAGO, { error: 'Elegí cómo pagó' }),
  inicio: z.string().max(10).optional().nullable(),
  nota: z
    .string()
    .max(200, 'La nota no puede pasar de 200 caracteres')
    .optional()
    .nullable(),
});

/** Hasta 100 clientes, como "3,8,15": los de una página de la lista. */
export const coberturasQuerySchema = z.object({
  clienteIds: z
    .string()
    .max(1000)
    .regex(/^\d{1,9}(,\d{1,9})*$/, 'Se esperan números de cliente separados por coma')
    .transform((texto) => [...new Set(texto.split(',').map(Number))])
    .refine((ids) => ids.length <= 100, 'No más de 100 clientes por consulta'),
});

export const historialQuerySchema = z.object({
  clienteId: id('un cliente'),
});

export type VentaInput = z.infer<typeof ventaInputSchema>;
