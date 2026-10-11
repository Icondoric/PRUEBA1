/**
 * CAPA HTTP — forma de las entradas de sesión y de usuarios.
 *
 * Qué es un usuario o una contraseña válidos lo decide el dominio
 * (`credenciales.ts`); acá solo se comprueba que haya venido texto.
 */

import { z } from 'zod';

export const loginInputSchema = z.object({
  usuario: z.string({ error: 'Escribí tu usuario' }).min(1, 'Escribí tu usuario').max(60),
  password: z
    .string({ error: 'Escribí tu contraseña' })
    .min(1, 'Escribí tu contraseña')
    .max(300),
});

export const usuarioNuevoSchema = z.object({
  usuario: z.string({ error: 'Elegí un usuario' }).min(1, 'Elegí un usuario').max(60),
  nombre: z
    .string({ error: 'El nombre es obligatorio' })
    .min(1, 'El nombre es obligatorio'),
  password: z
    .string({ error: 'Escribí una contraseña' })
    .min(1, 'Escribí una contraseña')
    .max(300),
  permisos: z.array(z.string()).optional(),
});

export const usuarioCambiosSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio').optional(),
  activo: z.boolean().optional(),
  permisos: z.array(z.string()).optional(),
});

export const passwordInputSchema = z.object({
  password: z
    .string({ error: 'Escribí una contraseña' })
    .min(1, 'Escribí una contraseña')
    .max(300),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
