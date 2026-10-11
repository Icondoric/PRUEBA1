<script setup lang="ts">
/**
 * Check-in. Es un kiosco: se lee desde lejos y se usa sin mouse.
 *
 *   - El campo tiene el foco SIEMPRE. Se teclea el número y Enter.
 *   - La respuesta ocupa toda la pantalla: verde, amarillo o rojo, con ícono y
 *     texto además del color.
 *   - Se limpia sola a los 3 segundos. No hay que esperar: el siguiente puede
 *     teclear mientras todavía se ve el resultado anterior.
 *   - Sin animaciones: acá mandan tamaño, contraste y velocidad.
 *
 * Quién entra lo decide el servidor (`evaluarAcceso`). Esta pantalla solo
 * muestra el veredicto.
 */
import { CircleCheck, CircleHelp, CircleX, TriangleAlert } from '@lucide/vue';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { ErrorDeApi } from '@/web/shared/lib/api';
import { formatearFecha } from '@/web/shared/lib/formato';
import { type ResultadoCheckin, useRegistrarIngreso } from '../api/checkin.api';
import { sonar } from '../lib/sonido';

const SEGUNDOS_EN_PANTALLA = 3;

type Pantalla =
  | { tipo: 'espera' }
  | { tipo: 'resultado'; resultado: ResultadoCheckin }
  | { tipo: 'falla'; mensaje: string };

const registrar = useRegistrarIngreso();

const campo = ref<HTMLInputElement | null>(null);
const texto = ref('');
const pantalla = ref<Pantalla>({ tipo: 'espera' });

let temporizador: ReturnType<typeof setTimeout> | undefined;
let turno = 0;

function mostrar(nueva: Pantalla) {
  pantalla.value = nueva;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    pantalla.value = { tipo: 'espera' };
  }, SEGUNDOS_EN_PANTALLA * 1000);
}

async function enviar() {
  const identificador = texto.value.trim();
  if (!identificador) return;

  // El campo queda libre en el acto para la persona que sigue.
  texto.value = '';
  const esteTurno = ++turno;

  try {
    const resultado = await registrar.mutateAsync(identificador);
    // Si alguien ya tecleó otro número, esta respuesta llegó tarde: no pisa.
    if (esteTurno !== turno) return;

    mostrar({ tipo: 'resultado', resultado });
    sonar(resultado.encontrado && resultado.permitir ? 'permitido' : 'rechazado');
  } catch (error) {
    if (esteTurno !== turno) return;

    mostrar({
      tipo: 'falla',
      mensaje:
        error instanceof ErrorDeApi
          ? error.message
          : 'Revisá que el sistema esté encendido y volvé a intentar.',
    });
    sonar('rechazado');
  }
}

// Foco permanente: si se pierde (un clic en cualquier lado), vuelve solo.
function enfocar() {
  requestAnimationFrame(() => campo.value?.focus());
}

onMounted(() => {
  enfocar();
  window.addEventListener('focus', enfocar);
});

onBeforeUnmount(() => {
  clearTimeout(temporizador);
  window.removeEventListener('focus', enfocar);
});

type Tono = 'neutro' | 'ok' | 'aviso' | 'rechazo';

const vista = computed(() => {
  const p = pantalla.value;

  if (p.tipo === 'espera') return null;

  if (p.tipo === 'falla') {
    return {
      tono: 'rechazo' as Tono,
      icono: TriangleAlert,
      titulo: 'No se pudo registrar el ingreso',
      nombre: null,
      mensaje: p.mensaje,
      detalle: null,
    };
  }

  const r = p.resultado;

  if (!r.encontrado) {
    return {
      tono: 'rechazo' as Tono,
      icono: CircleHelp,
      titulo: 'Número no encontrado',
      nombre: null,
      mensaje: `“${r.identificador}” no es un número de socio ni un CI registrado.`,
      detalle: 'Consultá en recepción.',
    };
  }

  const tono: Tono = !r.permitir
    ? 'rechazo'
    : r.resultado === 'por_vencer'
      ? 'aviso'
      : 'ok';

  return {
    tono,
    icono: !r.permitir
      ? CircleX
      : r.resultado === 'por_vencer'
        ? TriangleAlert
        : CircleCheck,
    titulo: r.permitir ? 'Adelante' : 'No podés ingresar',
    nombre: r.socio.nombreCompleto,
    mensaje: r.mensaje,
    detalle: r.proximaDesde
      ? `Tu membresía empieza el ${formatearFecha(r.proximaDesde)}.`
      : null,
  };
});

const iniciales = computed(() =>
  (vista.value?.nombre ?? '')
    .split(/\s+/)
    .slice(0, 2)
    .map((palabra) => palabra.charAt(0).toUpperCase())
    .join(''),
);

const FONDO: Record<Tono, string> = {
  neutro: 'bg-background text-foreground',
  ok: 'bg-acceso-ok text-acceso-ok-foreground',
  aviso: 'bg-acceso-aviso text-acceso-aviso-foreground',
  rechazo: 'bg-acceso-rechazo text-acceso-rechazo-foreground',
};
</script>

<template>
  <main class="flex min-h-dvh flex-col" :class="FONDO[vista?.tono ?? 'neutro']">
    <form
      class="flex flex-col items-center gap-3 px-6 pt-10"
      autocomplete="off"
      @submit.prevent="enviar"
    >
      <label for="checkin-identificador" class="text-xl font-medium">
        Número de socio o CI
      </label>
      <input
        id="checkin-identificador"
        ref="campo"
        v-model="texto"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        enterkeyhint="go"
        class="bg-background text-foreground h-20 w-full max-w-lg rounded-xl border-2 border-current px-6 text-center text-4xl font-semibold tabular-nums outline-none focus-visible:ring-4 focus-visible:ring-current/40"
        @blur="enfocar"
      />
    </form>

    <!-- `assertive`: el resultado se anuncia en el acto, es para lo único que está la pantalla. -->
    <div
      class="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-16 text-center"
      aria-live="assertive"
      aria-atomic="true"
    >
      <template v-if="vista">
        <div class="flex items-center gap-4">
          <component :is="vista.icono" class="size-16 shrink-0" aria-hidden="true" />
          <p class="text-5xl font-semibold tracking-tight">{{ vista.titulo }}</p>
        </div>

        <div v-if="vista.nombre" class="flex flex-col items-center gap-5">
          <!-- Todavía no se cargan fotos: van las iniciales. -->
          <div
            class="flex size-40 items-center justify-center rounded-full border-4 border-current text-6xl font-semibold"
            aria-hidden="true"
          >
            {{ iniciales }}
          </div>
          <p class="text-6xl leading-tight font-semibold tracking-tight text-balance">
            {{ vista.nombre }}
          </p>
        </div>

        <p class="max-w-4xl text-4xl font-medium text-balance">{{ vista.mensaje }}</p>
        <p v-if="vista.detalle" class="text-2xl">{{ vista.detalle }}</p>
      </template>

      <p v-else class="text-muted-foreground max-w-2xl text-3xl text-balance">
        Tecleá tu número de socio o tu CI y presioná Enter
      </p>
    </div>

    <!-- Solo con mouse y fuera del orden de tabulación: el teclado es del check-in. -->
    <RouterLink
      :to="{ name: 'clientes' }"
      tabindex="-1"
      class="absolute right-4 bottom-4 text-sm underline underline-offset-4 opacity-70 hover:opacity-100"
    >
      Salir del check-in
    </RouterLink>
  </main>
</template>
