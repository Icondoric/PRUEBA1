/**
 * CAPA HTTP — forma de las entradas para administrar planes y precios.
 *
 * Los montos llegan SIEMPRE en centavos enteros: convertir "200,50" a 20050 es
 * trabajo del formulario, y acá un decimal directamente no pasa.
 */

import { z } from 'zod';

const centavos = z
  .number({ error: 'Escribí el precio' })
  .int('El precio no puede tener fracciones de centavo')
  .max(100_000_000, 'Ese precio es demasiado alto: revisá los ceros');

export const planNuevoSchema = z.object({
  nombre: z
    .string({ error: 'El nombre es obligatorio' })
    .min(1, 'El nombre es obligatorio')
    .max(60, 'No puede pasar de 60 caracteres'),
  diasDuracion: z.coerce.number({ error: 'Escribí cuántos días dura' }).int(),
  esPaseDiario: z.boolean(),
  precioCentavos: centavos,
});

export const nombreDePlanSchema = z.object({
  nombre: z
    .string({ error: 'El nombre es obligatorio' })
    .min(1, 'El nombre es obligatorio')
    .max(60, 'No puede pasar de 60 caracteres'),
});

export const estadoDePlanSchema = z.object({
  activo: z.boolean(),
});

export const precioInputSchema = z.object({
  precioCentavos: centavos,
  vigenteDesde: z.string({ error: 'Indicá desde qué fecha rige' }).max(10),
  vigenteHasta: z.string().max(10).optional().nullable(),
  esPromocion: z.boolean(),
  etiqueta: z.string().max(60).optional().nullable(),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
