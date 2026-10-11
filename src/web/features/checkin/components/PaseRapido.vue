<script setup lang="ts">
/**
 * Venta de un pase por sesión desde el mostrador, en un solo paso y sin mouse.
 *
 *   - Si el check-in acaba de rechazar a alguien, ya viene con esa persona.
 *   - Si no, se escribe el nombre. Mientras se escribe aparecen los clientes
 *     parecidos: con las flechas se elige uno en vez de crear un duplicado.
 *   - Enter cobra y deja pasar. Esc cierra sin hacer nada.
 *
 * Es un `<dialog>` nativo: atrapa el foco, cierra con Esc y lo devuelve al
 * cerrarse, sin código propio.
 */
import { refDebounced } from '@vueuse/core';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { Metodo } from '@/modules/pagos';
import { METODOS } from '@/modules/pagos';
import { useListaClientes } from '@/web/features/clientes/api/clientes.api';
import { NOMBRE_METODO } from '@/web/features/pagos/lib/metodos';
import { ErrorDeApi } from '@/web/shared/lib/api';
import { formatearBs } from '@/web/shared/lib/formato';
import { Button } from '@/web/shared/ui/button';
import { RadioGroup, RadioGroupItem } from '@/web/shared/ui/radio-group';
import { type PaseVendido, usePaseEnVenta, useVenderPase } from '../api/checkin.api';

const props = defineProps<{
  /** La persona a la que el check-in acaba de rechazar, si la hay. */
  cliente: { clienteId: number; nombreCompleto: string; nroSocio: number } | null;
}>();

const emit = defineEmits<{ vendido: [resultado: PaseVendido]; cerrar: [] }>();

const dialogo = ref<HTMLDialogElement | null>(null);
const campoNombre = ref<HTMLInputElement | null>(null);

const { data: enVenta, isPending: cargandoPase } = usePaseEnVenta();
const vender = useVenderPase();

const pase = computed(() => enVenta.value?.pase ?? null);

const nombre = ref('');
const metodo = ref<Metodo>('efectivo');
const aviso = ref('');

// Parecidos: recién con dos letras, y sin consultar en cada tecla.
const nombreEstable = refDebounced(nombre, 150);
const buscando = computed(() => !props.cliente && nombreEstable.value.trim().length >= 2);
const { data: parecidos } = useListaClientes(() => ({
  texto: buscando.value ? nombreEstable.value.trim() : '',
  porPagina: 5,
}));
const opciones = computed(() =>
  buscando.value ? (parecidos.value?.clientes ?? []) : [],
);

/** -1 = cliente nuevo con el nombre escrito; 0..n = uno de los parecidos. */
const elegido = ref(-1);
watch(opciones, () => {
  elegido.value = -1;
});

function mover(paso: 1 | -1) {
  const ultimo = opciones.value.length - 1;
  elegido.value = Math.min(ultimo, Math.max(-1, elegido.value + paso));
}

const destinatario = computed(() => {
  if (props.cliente) return props.cliente.nombreCompleto;
  const existente = opciones.value[elegido.value];
  if (existente) return existente.nombreCompleto;
  return nombre.value.trim();
});

const esMetodo = (valor: unknown): valor is Metodo => METODOS.some((m) => m === valor);
function elegirMetodo(valor: unknown) {
  if (esMetodo(valor)) metodo.value = valor;
}

async function cobrar() {
  aviso.value = '';
  const existente = props.cliente?.clienteId ?? opciones.value[elegido.value]?.id ?? null;

  if (existente === null && nombre.value.trim().length < 2) {
    aviso.value = 'Escribí el nombre de la persona.';
    campoNombre.value?.focus();
    return;
  }

  try {
    const resultado = await vender.mutateAsync(
      existente === null
        ? { nombre: nombre.value.trim(), metodo: metodo.value }
        : { clienteId: existente, metodo: metodo.value },
    );
    emit('vendido', resultado);
  } catch (error) {
    aviso.value =
      error instanceof ErrorDeApi
        ? error.message
        : 'No se pudo registrar. Revisá que el sistema esté encendido.';
  }
}

// El contenido aparece cuando llega el precio del pase, que puede ser después
// de abrir el diálogo. El foco se pone a mano en ese momento: en el nombre si
// hay que escribirlo, o en el botón si la persona ya está elegida (Enter cobra).
async function enfocarInicio() {
  await nextTick();
  if (props.cliente) document.getElementById('pase-cobrar')?.focus();
  else campoNombre.value?.focus();
}

watch(pase, (disponible) => {
  if (disponible) void enfocarInicio();
});

onMounted(() => {
  dialogo.value?.showModal();
  void enfocarInicio();
});
</script>

<template>
  <dialog
    ref="dialogo"
    aria-labelledby="titulo-pase"
    class="bg-background text-foreground m-auto w-full max-w-xl rounded-xl border p-8 backdrop:bg-black/60"
    @close="emit('cerrar')"
  >
    <form class="space-y-6" autocomplete="off" @submit.prevent="cobrar">
      <div class="flex items-baseline justify-between gap-4">
        <h2 id="titulo-pase" class="text-2xl font-semibold tracking-tight">
          Vender pase por sesión
        </h2>
        <p v-if="pase" class="text-2xl font-semibold tabular-nums">
          {{ formatearBs(pase.precio.precioCentavos) }}
        </p>
      </div>

      <p v-if="!cargandoPase && !pase" role="alert" class="text-destructive text-base">
        No hay un pase por sesión con precio cargado. Avisale al administrador.
      </p>

      <template v-else-if="pase">
        <p v-if="cliente" class="text-lg">
          Para <strong class="font-semibold">{{ cliente.nombreCompleto }}</strong
          >, socio nº {{ cliente.nroSocio }}
        </p>

        <div v-else class="space-y-2">
          <label for="pase-nombre" class="text-base font-medium">Nombre</label>
          <input
            id="pase-nombre"
            ref="campoNombre"
            v-model="nombre"
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="pase-parecidos"
            :aria-expanded="opciones.length > 0"
            :aria-activedescendant="elegido >= 0 ? `pase-opcion-${elegido}` : undefined"
            class="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-12 w-full rounded-md border bg-transparent px-3 text-xl outline-none focus-visible:ring-3"
            @keydown.down.prevent="mover(1)"
            @keydown.up.prevent="mover(-1)"
          />

          <div v-if="opciones.length > 0" class="space-y-1">
            <p class="text-muted-foreground text-sm">
              ¿Ya vino antes? Elegilo con las flechas para no crearlo de nuevo.
            </p>
            <ul id="pase-parecidos" role="listbox" class="rounded-md border">
              <li
                v-for="(opcion, indice) in opciones"
                :id="`pase-opcion-${indice}`"
                :key="opcion.id"
                role="option"
                :aria-selected="indice === elegido"
                class="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-base"
                :class="indice === elegido ? 'bg-primary text-primary-foreground' : ''"
                @click="elegido = indice"
              >
                <span class="truncate font-medium">{{ opcion.nombreCompleto }}</span>
                <span class="shrink-0 text-sm tabular-nums">
                  nº {{ opcion.nroSocio }} ·
                  {{ opcion.tipo === 'socio' ? 'Socio' : 'Eventual' }}
                </span>
              </li>
            </ul>
          </div>
        </div>

        <fieldset class="space-y-3">
          <legend id="pase-metodo" class="text-base font-medium">Cómo pagó</legend>
          <RadioGroup
            :model-value="metodo"
            aria-labelledby="pase-metodo"
            class="flex flex-wrap gap-x-6 gap-y-2"
            @update:model-value="elegirMetodo"
          >
            <label
              v-for="opcion in METODOS"
              :key="opcion"
              :for="`pase-metodo-${opcion}`"
              class="flex cursor-pointer items-center gap-2 text-base"
            >
              <RadioGroupItem :id="`pase-metodo-${opcion}`" :value="opcion" />
              {{ NOMBRE_METODO[opcion] }}
            </label>
          </RadioGroup>
        </fieldset>

        <p v-if="aviso" role="alert" class="text-destructive text-base">{{ aviso }}</p>

        <div class="flex flex-wrap items-center gap-3">
          <Button
            id="pase-cobrar"
            type="submit"
            size="lg"
            :disabled="vender.isPending.value"
          >
            <template v-if="vender.isPending.value">Registrando…</template>
            <template v-else>
              Cobrar {{ formatearBs(pase.precio.precioCentavos) }} y dejar pasar
            </template>
          </Button>
          <p v-if="destinatario" class="text-muted-foreground min-w-0 truncate text-sm">
            {{ cliente || opciones[elegido] ? 'A' : 'Cliente nuevo:' }} {{ destinatario }}
          </p>
        </div>
      </template>

      <p class="text-muted-foreground text-sm">Enter cobra · Esc cierra sin cobrar</p>
    </form>
  </dialog>
</template>
