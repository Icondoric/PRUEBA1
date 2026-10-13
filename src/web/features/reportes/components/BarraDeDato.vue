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
  <div class="bg-muted h-2.5 w-full overflow-hidden rounded-[4px]" aria-hidden="true">
    <!-- Crece desde cero al aparecer: el ancho ya es el final, solo se escala. -->
    <div
      class="animate-crecer h-full origin-left rounded-r-[4px]"
      :class="tenue ? 'bg-muted-foreground/50' : 'bg-grafico'"
      :style="{ width: ancho }"
    ></div>
  </div>
</template>
