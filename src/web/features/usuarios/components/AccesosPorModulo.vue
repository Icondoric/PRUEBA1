<script setup lang="ts">
/**
 * Las casillas de accesos, agrupadas por módulo.
 *
 * La lista sale del catálogo que manda el servidor: si mañana se agrega un
 * acceso, aparece acá solo.
 */
import type { CatalogoDeAccesos } from '@/modules/usuarios';
import { Button } from '@/web/shared/ui/button';

const props = defineProps<{
  catalogo: CatalogoDeAccesos['catalogo'];
  basicos: readonly string[];
  /** El dueño tiene todo: se muestra marcado y sin poder cambiarse. */
  bloqueado?: boolean;
}>();

const marcados = defineModel<string[]>({ required: true });

function alternar(clave: string, evento: Event) {
  if (!(evento.target instanceof HTMLInputElement)) return;
  marcados.value = evento.target.checked
    ? [...marcados.value, clave]
    : marcados.value.filter((c) => c !== clave);
}

const esBasico = (clave: string) => props.basicos.includes(clave);
</script>

<template>
  <div class="space-y-4">
    <div v-if="!bloqueado" class="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" @click="marcados = [...basicos]">
        Dejar lo básico de recepción
      </Button>
      <Button type="button" variant="ghost" size="sm" @click="marcados = []">
        Quitar todos
      </Button>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <fieldset
        v-for="modulo in catalogo"
        :key="modulo.modulo"
        class="space-y-2 rounded-lg border p-4"
      >
        <legend class="px-1 text-sm font-semibold">{{ modulo.modulo }}</legend>

        <label
          v-for="acceso in modulo.accesos"
          :key="acceso.clave"
          class="flex items-start gap-2 text-sm"
          :class="bloqueado ? 'text-muted-foreground' : 'cursor-pointer'"
        >
          <input
            type="checkbox"
            class="accent-primary mt-0.5 size-4 shrink-0"
            :checked="bloqueado || marcados.includes(acceso.clave)"
            :disabled="bloqueado"
            @change="alternar(acceso.clave, $event)"
          />
          <span>
            {{ acceso.nombre }}
            <span v-if="!esBasico(acceso.clave)" class="text-muted-foreground text-xs">
              · no viene con recepción
            </span>
          </span>
        </label>
      </fieldset>
    </div>
  </div>
</template>
