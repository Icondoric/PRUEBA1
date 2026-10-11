/**
 * CAPA HTTP — forma de la entrada de los reportes.
 */

import { z } from 'zod';

export const reporteQuerySchema = z.object({
  /** 'YYYY-MM'. Que sea un mes válido y del período lo decide el dominio. */
  mes: z.string().optional(),
});
