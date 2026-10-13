<script setup lang="ts">
/**
 * Una caja del resumen del día: un número grande que lleva a su pantalla.
 *
 * Solo dibuja. Los datos los trae quien la usa, así cada caja carga y falla
 * por su cuenta sin tumbar a las demás.
 */
import type { Component } from 'vue';
import { RouterLink, type RouteLocationRaw } from 'vue-router';
import { Skeleton } from '@/web/shared/ui/skeleton';

defineProps<{
  titulo: string;
  /** `undefined` mientras carga. */
  valor: string | undefined;
  pie?: string;
  icono: Component;
  /** A dónde lleva al hacer clic. */
  destino: RouteLocationRaw;
  /** No se pudo traer el dato. */
  falla?: boolean;
}>();
</script>

<template>
  <RouterLink
    :to="destino"
    class="bg-card text-card-foreground hover:border-foreground/30 focus-visible:ring-ring block space-y-3 rounded-xl border p-4 transition-[border-color,transform] duration-100 outline-none focus-visible:ring-3 active:scale-[0.98]"
  >
    <div class="flex items-center justify-between gap-2">
      <p class="text-muted-foreground text-sm font-medium">{{ titulo }}</p>
      <span
        class="bg-accent text-accent-foreground flex size-8 shrink-0 items-center justify-center rounded-md"
        aria-hidden="true"
      >
        <component :is="icono" class="size-4" />
      </span>
    </div>

    <p v-if="falla" class="text-muted-foreground text-sm">No se pudo cargar.</p>
    <template v-else>
      <p v-if="valor !== undefined" class="cifra">{{ valor }}</p>
      <Skeleton v-else class="h-9 w-24" aria-hidden="true" />
      <p v-if="pie" class="text-muted-foreground text-xs">{{ pie }}</p>
    </template>
  </RouterLink>
</template>
