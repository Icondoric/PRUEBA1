<script setup lang="ts">
import { LogOut } from '@lucide/vue';
import { computed, nextTick, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { useAccesos, useCerrarSesion } from '@/web/features/sesion/api/sesion.api';
import { seccionesDe } from '@/web/router/secciones';

const route = useRoute();
const router = useRouter();
const { usuario, esDueno } = useAccesos();
const cerrar = useCerrarSesion();

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

// Cada uno ve en el menú solo las secciones a las que tiene acceso.
const secciones = computed(() => (usuario.value ? seccionesDe(usuario.value) : []));

async function salir() {
  await cerrar.mutateAsync().catch(() => null);
  await router.replace({ name: 'ingresar' });
}
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
      <p class="shrink-0 px-2 text-base font-semibold tracking-tight">Gimnasio</p>

      <!-- En pantalla angosta las secciones se deslizan de costado, sin ensanchar la página. -->
      <nav
        aria-label="Secciones"
        class="min-w-0 flex-1 overflow-x-auto md:flex-none md:overflow-visible"
      >
        <ul class="flex gap-1 md:flex-col">
          <li v-for="seccion in secciones" :key="seccion.ruta">
            <RouterLink
              :to="{ name: seccion.ruta }"
              class="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 flex h-9 items-center gap-2 rounded-md px-2 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-3"
              active-class="bg-accent !text-foreground"
            >
              <component :is="seccion.icono" class="size-4" aria-hidden="true" />
              {{ seccion.etiqueta }}
            </RouterLink>
          </li>
        </ul>
      </nav>

      <!-- Quién está usando el sistema, siempre a la vista, y cómo salir. -->
      <div
        v-if="usuario"
        class="flex shrink-0 items-center gap-2 md:mt-auto md:flex-col md:items-stretch md:border-t md:pt-4"
      >
        <div class="hidden min-w-0 px-2 md:block">
          <p class="truncate text-sm font-medium">{{ usuario.nombre }}</p>
          <p class="text-muted-foreground text-xs">
            {{ esDueno ? 'Dueño' : 'Recepción' }}
          </p>
        </div>
        <button
          type="button"
          class="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 flex h-9 items-center gap-2 rounded-md px-2 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-3"
          :disabled="cerrar.isPending.value"
          @click="salir"
        >
          <LogOut class="size-4" aria-hidden="true" />
          Cerrar sesión
        </button>
      </div>
    </aside>

    <main id="contenido" class="min-w-0 px-4 py-6 md:px-8">
      <RouterView />
    </main>
  </div>
</template>
