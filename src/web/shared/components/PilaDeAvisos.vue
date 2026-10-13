<script setup lang="ts">
/**
 * Donde aparecen los avisos: abajo a la derecha (abajo y al centro en angosto).
 *
 * - Entran y salen por el mismo camino, y solo con `transform` y `opacity`.
 * - Con movimiento reducido quedan en un fundido (lo resuelve styles.css).
 * - El color nunca va solo: cada aviso lleva ícono y texto.
 * - La región se anuncia a los lectores de pantalla; un error, en el acto.
 */
import { CircleAlert, CircleCheck, X } from '@lucide/vue';
import { useAvisos } from '@/web/shared/lib/avisos';

const { lista, quitar, pausar, reanudar } = useAvisos();
</script>

<template>
  <TransitionGroup
    tag="ol"
    aria-label="Avisos"
    class="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 md:inset-x-auto md:right-6 md:bottom-6 md:items-end"
    enter-active-class="transition-[opacity,transform] duration-200 ease-out"
    leave-active-class="transition-[opacity,transform] duration-150 ease-in"
    enter-from-class="translate-y-3 opacity-0"
    leave-to-class="translate-y-3 opacity-0"
    move-class="transition-transform duration-200 ease-out"
  >
    <li
      v-for="aviso in lista"
      :key="aviso.id"
      :role="aviso.tipo === 'error' ? 'alert' : 'status'"
      class="bg-popover text-popover-foreground dark:bg-secondary pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border py-3 pr-2 pl-4 shadow-lg dark:shadow-none"
      @mouseenter="pausar(aviso.id)"
      @mouseleave="reanudar(aviso.id)"
      @focusin="pausar(aviso.id)"
      @focusout="reanudar(aviso.id)"
    >
      <component
        :is="aviso.tipo === 'error' ? CircleAlert : CircleCheck"
        class="mt-0.5 size-5 shrink-0"
        :class="aviso.tipo === 'error' ? 'text-destructive' : 'text-primary-text'"
        aria-hidden="true"
      />
      <p class="min-w-0 flex-1 py-0.5 text-sm font-medium">{{ aviso.texto }}</p>
      <button
        type="button"
        class="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring flex size-8 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-3 active:scale-[0.95]"
        aria-label="Cerrar aviso"
        title="Cerrar aviso"
        @click="quitar(aviso.id)"
      >
        <X class="size-4" aria-hidden="true" />
      </button>
    </li>
  </TransitionGroup>
</template>
