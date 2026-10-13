<script setup lang="ts">
import { House, LogOut, Menu, X } from '@lucide/vue';
import { computed, nextTick, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { useAccesos, useCerrarSesion } from '@/web/features/sesion/api/sesion.api';
import { seccionesDe } from '@/web/router/secciones';
import InterruptorDeTema from '@/web/shared/components/InterruptorDeTema.vue';

const route = useRoute();
const router = useRouter();
const { usuario, esDueno } = useAccesos();
const cerrar = useCerrarSesion();

// En el celular las secciones no entran en una barra: van en un panel aparte.
const menu = ref<HTMLDialogElement | null>(null);

// Al cambiar de pantalla el foco pasa al título nuevo. Sin esto, quien navega
// con teclado queda parado sobre un enlace que ya no existe. Mira solo el
// path: cambiar un filtro (query) no debe sacar el foco del buscador.
watch(
  () => route.path,
  async () => {
    menu.value?.close();
    await nextTick();
    document.querySelector<HTMLElement>('#contenido h1')?.focus();
  },
  { flush: 'post' },
);

// Inicio lo ven todos; del resto, cada uno ve solo las secciones a las que
// tiene acceso.
const enlaces = computed(() => [
  { ruta: 'inicio', etiqueta: 'Inicio', icono: House },
  ...(usuario.value ? seccionesDe(usuario.value) : []),
]);

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

/** Un clic fuera del panel (en el fondo atenuado) lo cierra, como Esc. */
function cerrarSiEsElFondo(evento: MouseEvent) {
  if (evento.target === menu.value) menu.value?.close();
}

// Lo que comparten los enlaces y botones del menú: alto, forma y respuesta al
// presionar. El color lo pone cada uno.
const ITEM =
  'focus-visible:ring-ring flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-[color,background-color,transform] duration-100 outline-none focus-visible:ring-3 active:scale-[0.98]';
const APAGADO = 'text-muted-foreground hover:bg-muted hover:text-foreground';
// "Inicio" es `/`, que es el comienzo de todas las rutas: se marca solo si es
// exactamente esa. Las demás, también cuando se está en una pantalla de adentro.
const ACTIVO = '!bg-accent !text-accent-foreground';
</script>

<template>
  <a
    href="#contenido"
    class="bg-background sr-only z-50 rounded-md border px-3 py-2 text-sm focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
  >
    Saltar al contenido
  </a>

  <div class="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
    <!-- Hasta 1024 px es una barra fija arriba, translúcida: el contenido pasa por
         debajo. En ancho es una columna sólida, sin desenfoque. -->
    <aside
      class="vidrio lg:bg-card sticky top-0 z-10 flex items-center gap-3 border-b px-3 py-2 lg:h-dvh lg:flex-col lg:items-stretch lg:gap-6 lg:border-r lg:border-b-0 lg:py-5 lg:[backdrop-filter:none]"
    >
      <div class="flex min-w-0 flex-1 items-center gap-3 lg:flex-none lg:px-2">
        <!-- Lugar del logo: cuando exista, reemplaza a la inicial. -->
        <div
          class="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-md text-base font-bold"
          aria-hidden="true"
        >
          G
        </div>
        <p class="hidden text-base font-semibold tracking-tight lg:block">Gimnasio</p>
        <!-- En angosto, en vez de las secciones se ve en cuál se está. -->
        <p class="truncate text-base font-semibold tracking-tight lg:hidden">
          {{ route.meta.titulo }}
        </p>
      </div>

      <button
        type="button"
        class="lg:hidden"
        :class="[ITEM, APAGADO]"
        aria-haspopup="dialog"
        @click="menu?.showModal()"
      >
        <Menu class="size-[1.125rem]" aria-hidden="true" />
        Menú
      </button>

      <nav aria-label="Secciones" class="hidden lg:block">
        <ul class="flex flex-col gap-1">
          <li v-for="enlace in enlaces" :key="enlace.ruta">
            <RouterLink
              :to="{ name: enlace.ruta }"
              :class="[ITEM, APAGADO]"
              :active-class="enlace.ruta === 'inicio' ? '' : ACTIVO"
              :exact-active-class="ACTIVO"
            >
              <component
                :is="enlace.icono"
                class="size-[1.125rem] shrink-0"
                aria-hidden="true"
              />
              {{ enlace.etiqueta }}
            </RouterLink>
          </li>
        </ul>
      </nav>

      <!-- Quién está usando el sistema, siempre a la vista, y cómo salir. -->
      <div
        v-if="usuario"
        class="hidden shrink-0 flex-col items-stretch gap-1 border-t pt-4 lg:mt-auto lg:flex"
      >
        <RouterLink
          :to="{ name: 'mi-cuenta' }"
          class="hover:bg-muted focus-visible:ring-ring flex min-w-0 items-center gap-3 rounded-md px-2 py-2 transition-colors duration-100 outline-none focus-visible:ring-3"
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
        <InterruptorDeTema />
        <button
          type="button"
          :class="[ITEM, APAGADO]"
          :disabled="cerrar.isPending.value"
          @click="salir"
        >
          <LogOut class="size-[1.125rem]" aria-hidden="true" />
          Cerrar sesión
        </button>
      </div>
    </aside>

    <main id="contenido" class="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <RouterView />
    </main>
  </div>

  <!-- El menú del celular. Es un <dialog> nativo: atrapa el foco, cierra con
       Esc y lo devuelve al botón "Menú" sin código propio. -->
  <dialog
    ref="menu"
    aria-labelledby="titulo-menu"
    class="bg-card text-card-foreground backdrop:bg-overlay m-0 ml-auto h-dvh max-h-none w-72 max-w-[85vw] overflow-y-auto border-l p-4 lg:hidden"
    @click="cerrarSiEsElFondo"
  >
    <div class="flex min-h-full flex-col gap-4">
      <div class="flex items-center justify-between gap-2">
        <h2 id="titulo-menu" class="px-3 text-base font-semibold tracking-tight">Menú</h2>
        <button
          type="button"
          :class="[ITEM, APAGADO]"
          aria-label="Cerrar menú"
          title="Cerrar menú"
          @click="menu?.close()"
        >
          <X class="size-[1.125rem]" aria-hidden="true" />
        </button>
      </div>

      <nav aria-label="Secciones">
        <ul class="flex flex-col gap-1">
          <li v-for="enlace in enlaces" :key="enlace.ruta">
            <RouterLink
              :to="{ name: enlace.ruta }"
              class="h-11"
              :class="[ITEM, APAGADO]"
              :active-class="enlace.ruta === 'inicio' ? '' : ACTIVO"
              :exact-active-class="ACTIVO"
              @click="menu?.close()"
            >
              <component
                :is="enlace.icono"
                class="size-[1.125rem] shrink-0"
                aria-hidden="true"
              />
              {{ enlace.etiqueta }}
            </RouterLink>
          </li>
        </ul>
      </nav>

      <div v-if="usuario" class="mt-auto flex flex-col gap-1 border-t pt-4">
        <RouterLink
          :to="{ name: 'mi-cuenta' }"
          class="hover:bg-muted focus-visible:ring-ring flex min-w-0 items-center gap-3 rounded-md px-2 py-2 outline-none focus-visible:ring-3"
          active-class="bg-muted"
          @click="menu?.close()"
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
        <InterruptorDeTema />
        <button
          type="button"
          :class="[ITEM, APAGADO]"
          :disabled="cerrar.isPending.value"
          @click="salir"
        >
          <LogOut class="size-[1.125rem]" aria-hidden="true" />
          Cerrar sesión
        </button>
      </div>
    </div>
  </dialog>
</template>
