/**
 * Puente entre un esquema Zod y vee-validate.
 *
 * `@vee-validate/zod` todavía depende de internals de Zod 3 y el proyecto usa
 * Zod 4, así que el adaptador es este: unas líneas que cumplen el contrato
 * `TypedSchema` de vee-validate. El formulario valida con EL MISMO esquema que
 * la ruta del servidor (`clienteInputSchema`), sin copia.
 */

import type { TypedSchema, TypedSchemaError } from 'vee-validate';
import { ref, watch } from 'vue';
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

/**
 * Los errores de campo que devuelve el SERVIDOR ("ese CI ya es de otro", "la
 * contraseña actual no es esa").
 *
 * Por qué no se usan los de vee-validate: cada vez que el foco sale de un
 * campo, vee-validate vuelve a pasar el esquema y pisa los errores con lo que
 * diga el esquema. Como para el esquema ese valor está bien, el aviso del
 * servidor desaparecía apenas el foco saltaba al campo con el problema.
 *
 * Acá viven aparte: se muestran hasta que la persona CAMBIA ese campo.
 *
 *   const { values, errors } = useForm(...)
 *   const { delServidor, ponerError } = useErroresDelServidor(values)
 *   <Campo :error="errors.ci ?? delServidor.ci" />
 */
export function useErroresDelServidor(valores: Record<string, unknown>) {
  const delServidor = ref<Record<string, string | undefined>>({});

  watch(
    () => ({ ...valores }),
    (ahora, antes) => {
      const quedan = Object.entries(delServidor.value).filter(
        ([campo]) => ahora[campo] === antes[campo],
      );
      if (quedan.length !== Object.keys(delServidor.value).length) {
        delServidor.value = Object.fromEntries(quedan);
      }
    },
  );

  return {
    delServidor,
    ponerError(campo: string, mensaje: string) {
      delServidor.value = { ...delServidor.value, [campo]: mensaje };
    },
    limpiarErrores() {
      delServidor.value = {};
    },
  };
}
