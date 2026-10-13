<script setup lang="ts">
/**
 * Cambia entre modo claro y oscuro. El botón dice lo que va a pasar, no el
 * modo en el que se está.
 *
 * `compacto`: deja solo el ícono en pantalla angosta (el texto sigue para los
 * lectores de pantalla y en el `title`).
 */
import { Moon, Sun } from '@lucide/vue';
import { computed } from 'vue';
import { useTema } from '@/web/shared/lib/tema';

defineProps<{ compacto?: boolean }>();

const { tema, alternar } = useTema();

const etiqueta = computed(() =>
  tema.value === 'oscuro' ? 'Usar modo claro' : 'Usar modo oscuro',
);
</script>

<template>
  <button
    type="button"
    class="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-[color,background-color,transform] duration-100 outline-none focus-visible:ring-3 active:scale-[0.98]"
    :title="etiqueta"
    @click="alternar"
  >
    <component
      :is="tema === 'oscuro' ? Sun : Moon"
      class="size-[1.125rem]"
      aria-hidden="true"
    />
    <span :class="compacto ? 'sr-only md:not-sr-only' : ''">{{ etiqueta }}</span>
  </button>
</template>
