<script setup lang="ts">
/**
 * Una barra horizontal para comparar cantidades dentro de una lista.
 *
 * Es un refuerzo visual: el número siempre va escrito al lado, así que la
 * barra se oculta a los lectores de pantalla. Arranca en cero y su largo es
 * proporcional al máximo de la lista.
 */
import { computed } from 'vue';

const props = defineProps<{ valor: number; maximo: number; tenue?: boolean }>();

const ancho = computed(() =>
  props.maximo > 0
    ? `${Math.max(0, Math.min(100, (props.valor / props.maximo) * 100))}%`
    : '0%',
);
</script>

<template>
  <div class="bg-muted h-2 w-full overflow-hidden rounded-full" aria-hidden="true">
    <div
      class="h-full rounded-full"
      :class="tenue ? 'bg-muted-foreground/50' : 'bg-primary'"
      :style="{ width: ancho }"
    ></div>
  </div>
</template>
