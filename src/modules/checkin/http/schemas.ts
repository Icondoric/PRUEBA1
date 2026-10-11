/**
 * CAPA HTTP — forma de la entrada del check-in.
 */

import { z } from 'zod';

export const checkinInputSchema = z.object({
  /** Lo que se tecleó: nº de socio o CI, con o sin puntos. Lo normaliza el dominio. */
  identificador: z.string().trim().min(1, 'Ingresá tu número de socio o tu CI').max(40),
});
