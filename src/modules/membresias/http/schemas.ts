/**
 * CAPA HTTP — esquemas Zod del borde. Validan FORMA, no reglas.
 *
 * "La fecha de inicio no puede ser anterior a hoy" es una regla y vive en el
 * dominio (`cotizarVenta`). Acá solo se comprueba que haya venido un texto.
 *
 * `ventaInputSchema` lo importa también la pantalla de venta.
 */

import { z } from 'zod';

export const METODOS_PAGO = ['efectivo', 'qr', 'transferencia', 'tarjeta'] as const;

const id = (queEs: string) =>
  z.coerce
    .number({ error: `Elegí ${queEs}` })
    .int()
    .positive(`Elegí ${queEs}`);

export const cotizacionQuerySchema = z.object({
  clienteId: id('un cliente'),
  planId: id('un plan'),
  inicio: z.string().optional(),
});

export const ventaInputSchema = z.object({
  clienteId: id('un cliente'),
  planId: id('un plan'),
  metodo: z.enum(METODOS_PAGO, { error: 'Elegí cómo pagó' }),
  inicio: z.string().optional().nullable(),
  nota: z
    .string()
    .max(200, 'La nota no puede pasar de 200 caracteres')
    .optional()
    .nullable(),
});

export const historialQuerySchema = z.object({
  clienteId: id('un cliente'),
});

export type VentaInput = z.infer<typeof ventaInputSchema>;
