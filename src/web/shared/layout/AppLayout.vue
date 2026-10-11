<script setup lang="ts">
import { ScanLine, Users } from '@lucide/vue';
import { nextTick, watch } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';

const route = useRoute();

// Al cambiar de pantalla el foco pasa al título nuevo. Sin esto, quien navega
// con teclado queda parado sobre un enlace que ya no existe. Mira solo el
// path: cambiar un filtro (query) no debe sacar el foco del buscador.
watch(
  () => route.path,
  async () => {
    await nextTick();
    document.querySelector<HTMLElement>('#contenido h1')?.focus();
  },
  { flush: 'post' },
);

// Solo las secciones que existen. Las que faltan se agregan cuando se construyan.
const secciones = [
  { a: '/clientes', etiqueta: 'Clientes', icono: Users },
  { a: '/checkin', etiqueta: 'Check-in', icono: ScanLine },
];
</script>

<template>
  <a
    href="#contenido"
    class="bg-background sr-only z-50 rounded-md border px-3 py-2 text-sm focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
  >
    Saltar al contenido
  </a>

  <div class="min-h-dvh md:grid md:grid-cols-[13rem_1fr]">
    <aside
      class="bg-muted/50 flex items-center gap-4 border-b px-4 py-2 md:flex-col md:items-stretch md:gap-6 md:border-r md:border-b-0 md:py-5"
    >
      <p class="px-2 text-base font-semibold tracking-tight">Gimnasio</p>

      <nav aria-label="Secciones">
        <ul class="flex gap-1 md:flex-col">
          <li v-for="seccion in secciones" :key="seccion.a">
            <RouterLink
              :to="seccion.a"
              class="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 flex h-9 items-center gap-2 rounded-md px-2 text-sm font-medium outline-none focus-visible:ring-3"
              active-class="bg-accent !text-foreground"
            >
              <component :is="seccion.icono" class="size-4" aria-hidden="true" />
              {{ seccion.etiqueta }}
            </RouterLink>
          </li>
        </ul>
      </nav>
    </aside>

    <main id="contenido" class="min-w-0 px-4 py-6 md:px-8">
      <RouterView />
    </main>
  </div>
</template>
