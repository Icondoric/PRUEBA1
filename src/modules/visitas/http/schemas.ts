/**
 * CAPA HTTP — forma de las entradas de visitas. Lo importa también el
 * formulario.
 */

import { z } from 'zod';
import { MOTIVOS_VISITA } from '../domain/visita';

export const visitaInputSchema = z.object({
  nombre: z
    .string({ error: 'El nombre es obligatorio' })
    .min(1, 'El nombre es obligatorio')
    .max(80, 'No puede pasar de 80 caracteres'),
  motivo: z.enum(MOTIVOS_VISITA, { error: 'Elegí el motivo' }),
  invitadoPor: z.string().max(40).optional().nullable(),
  telefono: z.string().max(30).optional().nullable(),
  nota: z
    .string()
    .max(200, 'La nota no puede pasar de 200 caracteres')
    .optional()
    .nullable(),
});

export const listarVisitasQuerySchema = z.object({
  desde: z.string().max(10).optional(),
  hasta: z.string().max(10).optional(),
});
