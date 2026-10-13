<script setup lang="ts">
import { LogOut } from '@lucide/vue';
import { computed, nextTick, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { useAccesos, useCerrarSesion } from '@/web/features/sesion/api/sesion.api';
import { seccionesDe } from '@/web/router/secciones';
import InterruptorDeTema from '@/web/shared/components/InterruptorDeTema.vue';

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

const iniciales = computed(() =>
  (usuario.value?.nombre ?? '')
    .split(/\s+/)
    .slice(0, 2)
    .map((palabra) => palabra.charAt(0).toUpperCase())
    .join(''),
);

async function salir() {
  await cerrar.mutateAsync().catch(() => null);
  await router.replace({ name: 'ingresar' });
}

// Lo que comparten los enlaces y botones del menú: alto, forma y respuesta al
// presionar. El color lo pone cada uno.
const ITEM =
  'focus-visible:ring-ring flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-[color,background-color,transform] duration-100 outline-none focus-visible:ring-3 active:scale-[0.98]';
</script>

<template>
  <a
    href="#contenido"
    class="bg-background sr-only z-50 rounded-md border px-3 py-2 text-sm focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
  >
    Saltar al contenido
  </a>

  <div class="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
    <!-- En angosto es una barra fija arriba, translúcida: el contenido pasa por
         debajo. En ancho es una columna sólida, sin desenfoque. -->
    <aside
      class="vidrio md:bg-card sticky top-0 z-10 flex items-center gap-2 border-b px-3 py-2 md:h-dvh md:flex-col md:items-stretch md:gap-6 md:border-r md:border-b-0 md:py-5 md:[backdrop-filter:none]"
    >
      <div class="flex shrink-0 items-center gap-3 md:px-2">
        <!-- Lugar del logo: cuando exista, reemplaza a la inicial. -->
        <div
          class="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-md text-base font-bold"
          aria-hidden="true"
        >
          G
        </div>
        <p class="hidden text-base font-semibold tracking-tight md:block">Gimnasio</p>
      </div>

      <!-- En pantalla angosta las secciones se deslizan de costado, sin ensanchar la página. -->
      <nav
        aria-label="Secciones"
        class="min-w-0 flex-1 overflow-x-auto md:flex-none md:overflow-visible"
      >
        <ul class="flex gap-1 md:flex-col">
          <li v-for="seccion in secciones" :key="seccion.ruta">
            <RouterLink
              :to="{ name: seccion.ruta }"
              class="text-muted-foreground hover:bg-muted hover:text-foreground"
              :class="ITEM"
              active-class="!bg-accent !text-accent-foreground"
            >
              <component
                :is="seccion.icono"
                class="size-[1.125rem] shrink-0"
                aria-hidden="true"
              />
              {{ seccion.etiqueta }}
            </RouterLink>
          </li>
        </ul>
      </nav>

      <!-- Quién está usando el sistema, siempre a la vista, y cómo salir. -->
      <div
        v-if="usuario"
        class="flex shrink-0 items-center gap-1 md:mt-auto md:flex-col md:items-stretch md:border-t md:pt-4"
      >
        <RouterLink
          :to="{ name: 'mi-cuenta' }"
          class="hover:bg-muted focus-visible:ring-ring hidden min-w-0 items-center gap-3 rounded-md px-2 py-2 transition-colors duration-100 outline-none focus-visible:ring-3 md:flex"
          active-class="bg-muted"
        >
          <span
            class="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
            aria-hidden="true"
          >
            {{ iniciales }}
          </span>
          <span class="min-w-0">
            <span class="block truncate text-sm font-medium">{{ usuario.nombre }}</span>
            <span class="text-muted-foreground block text-xs">
              {{ esDueno ? 'Dueño' : 'Recepción' }} · Mi cuenta
            </span>
          </span>
        </RouterLink>
        <InterruptorDeTema compacto />
        <button
          type="button"
          class="text-muted-foreground hover:bg-muted hover:text-foreground"
          :class="ITEM"
          :disabled="cerrar.isPending.value"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          @click="salir"
        >
          <LogOut class="size-[1.125rem]" aria-hidden="true" />
          <!-- En angosto queda solo el ícono, para dejarle lugar a las secciones. -->
          <span class="hidden md:inline">Cerrar sesión</span>
        </button>
      </div>
    </aside>

    <main id="contenido" class="min-w-0 px-4 py-6 md:px-10 md:py-8">
      <RouterView />
    </main>
  </div>
</template>
