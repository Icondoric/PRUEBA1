/**
 * LO QUE EL NAVEGADOR PUEDE IMPORTAR DE ESTE MÓDULO.
 *
 * El `index.ts` de usuarios arrastra el servicio, y el servicio usa
 * `node:crypto` para las contraseñas: eso no existe en un navegador. Por eso
 * el frontend, cuando necesita un VALOR (no un tipo) de este módulo, lo toma
 * de acá, que solo reexporta reglas puras y esquemas.
 *
 * Los tipos se siguen importando del `index.ts` con `import type`: se borran
 * al compilar y no arrastran nada.
 */

export {
  CATALOGO_DE_ACCESOS,
  PERMISOS_BASICOS,
  type Permiso,
  type Rol,
  esDueno,
  puede,
  puedeAlguno,
} from './domain/permisos';
export {
  loginInputSchema,
  miPasswordSchema,
  passwordInputSchema,
  usuarioNuevoSchema,
} from './http/schemas';
