/**
 * CAPA HTTP — forma de las entradas del mostrador.
 */

import { z } from 'zod';
import { METODOS_PAGO } from '@/modules/membresias';

export const checkinInputSchema = z.object({
  /** Lo que se tecleó: nº de socio o CI, con o sin puntos. Lo normaliza el dominio. */
  identificador: z.string().trim().min(1, 'Ingresá tu número de socio o tu CI').max(40),
});

/**
 * Venta rápida de un pase. Viene `clienteId` (ya es cliente) o `nombre` (es
 * nuevo). Que el nombre sea válido lo decide el dominio de clientes.
 */
export const paseInputSchema = z.object({
  clienteId: z.coerce.number().int().positive().optional().nullable(),
  nombre: z.string().max(80).optional().nullable(),
  metodo: z.enum(METODOS_PAGO, { error: 'Elegí cómo pagó' }),
});
