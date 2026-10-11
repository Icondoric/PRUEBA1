/**
 * Puente entre un esquema Zod y vee-validate.
 *
 * `@vee-validate/zod` todavía depende de internals de Zod 3 y el proyecto usa
 * Zod 4, así que el adaptador es este: unas líneas que cumplen el contrato
 * `TypedSchema` de vee-validate. El formulario valida con EL MISMO esquema que
 * la ruta del servidor (`clienteInputSchema`), sin copia.
 */

import type { TypedSchema, TypedSchemaError } from 'vee-validate';
import type { z } from 'zod';

export function esquemaDeFormulario<T extends z.ZodType>(
  esquema: T,
): TypedSchema<z.input<T>, z.output<T>> {
  return {
    __type: 'VVTypedSchema',
    async parse(valores) {
      const resultado = await esquema.safeParseAsync(valores);
      if (resultado.success) return { value: resultado.data, errors: [] };

      const porCampo = new Map<string, string[]>();
      for (const problema of resultado.error.issues) {
        const campo = problema.path.join('.');
        porCampo.set(campo, [...(porCampo.get(campo) ?? []), problema.message]);
      }

      const errors: TypedSchemaError[] = [...porCampo].map(([path, mensajes]) => ({
        path,
        errors: mensajes,
      }));
      return { errors };
    },
  };
}
