/**
 * CAPA HTTP — esquemas Zod del borde.
 *
 * Validan FORMA (es un string, es un número, está presente), no reglas de
 * negocio. "El CI debe tener entre 4 y 12 dígitos" es una regla y vive en el
 * dominio, para que valga igual si mañana la llama un script de importación.
 *
 * Estos mismos esquemas los importa el frontend con vee-validate: una sola
 * definición de qué es un formulario válido, en las dos puntas.
 */

import { z } from 'zod';

export const clienteInputSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  apellido: z.string().optional().nullable(),
  ci: z.string().optional().nullable(),
  ciExtension: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  referidoPorClienteId: z.coerce.number().int().positive().optional().nullable(),
  /** Nº de socio o CI de quien lo trajo, como se teclea. Lo resuelve el servicio. */
  referidoPor: z.string().max(40).optional().nullable(),
});

export const listarQuerySchema = z.object({
  texto: z.string().optional(),
  tipo: z.enum(['socio', 'eventual']).optional(),
  /** 'baja' = los dados de baja (pide el acceso de baja). Por defecto, los activos. */
  estado: z.enum(['activos', 'baja']).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(25),
});

/** Lo importa también el diálogo de bloqueo. */
export const bloqueoInputSchema = z.object({
  motivo: z
    .string({ error: 'Escribí por qué se lo bloquea' })
    .trim()
    .min(1, 'Escribí por qué se lo bloquea')
    .max(300, 'El motivo no puede pasar de 300 caracteres'),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type ClienteInput = z.infer<typeof clienteInputSchema>;
export type ListarQuery = z.infer<typeof listarQuerySchema>;
