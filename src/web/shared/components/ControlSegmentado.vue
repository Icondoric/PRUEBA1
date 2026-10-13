<script setup lang="ts">
/**
 * Elegir una opción entre pocas (cómo pagó, un filtro), todas a la vista.
 *
 * Es un grupo de radios con otra forma: las flechas mueven la elección y Tab
 * entra y sale del grupo de una vez. Para más de cuatro o cinco opciones, o
 * textos largos, usar un `select`.
 */
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui';

defineProps<{
  opciones: readonly { valor: string; etiqueta: string }[];
  /** `id` del texto que nombra al grupo (la etiqueta o el `legend`). */
  etiquetadoPor: string;
}>();

const elegido = defineModel<string>({ required: true });
</script>

<template>
  <RadioGroupRoot
    v-model="elegido"
    orientation="horizontal"
    :aria-labelledby="etiquetadoPor"
    class="bg-muted inline-flex max-w-full flex-wrap gap-1 rounded-lg p-1"
  >
    <RadioGroupItem
      v-for="opcion in opciones"
      :key="opcion.valor"
      :value="opcion.valor"
      class="text-muted-foreground hover:text-foreground data-[state=checked]:bg-background data-[state=checked]:text-foreground data-[state=checked]:border-border focus-visible:ring-ring h-9 rounded-md border border-transparent px-3 text-sm font-medium whitespace-nowrap transition-[color,background-color,transform] duration-100 outline-none focus-visible:ring-3 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {{ opcion.etiqueta }}
    </RadioGroupItem>
  </RadioGroupRoot>
</template>
