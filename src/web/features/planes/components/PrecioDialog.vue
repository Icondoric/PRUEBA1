<script setup lang="ts">
/**
 * Cargar un precio nuevo o una promoción para un plan.
 *
 * Dos pasos, a propósito: primero se escribe, después se ve qué se va a cobrar
 * con ese cambio, y recién ahí se guarda. Un precio mal cargado se cobra mal a
 * todos los que vengan después.
 *
 * El precio se escribe en bolivianos y se convierte a centavos acá; al
 * servidor solo le llegan centavos enteros. Las reglas (no fechas pasadas, la
 * promo necesita fin y nombre) las decide el servidor.
 */
import { nextTick, onMounted, ref } from 'vue';
import CampoFormulario from '@/web/shared/components/CampoFormulario.vue';
import { ErrorDeApi } from '@/web/shared/lib/api';
import { aCentavos, formatearBs, formatearFecha } from '@/web/shared/lib/formato';
import { Button } from '@/web/shared/ui/button';
import { Input } from '@/web/shared/ui/input';
import {
  type DatosDePrecio,
  type PlanAdministrable,
  type SimulacionDePrecio,
  useGestionDePlanes,
  useSimularPrecio,
} from '../api/planes.api';

const props = defineProps<{
  plan: PlanAdministrable;
  esPromocion: boolean;
  hoy: string;
}>();
const emit = defineEmits<{ cerrar: [] }>();

const dialogo = ref<HTMLDialogElement | null>(null);
const { agregarPrecio } = useGestionDePlanes();
const simular = useSimularPrecio();

const precio = ref('');
const desde = ref(props.hoy);
const hasta = ref('');
const etiqueta = ref('');

type Campo = 'precio' | 'desde' | 'hasta' | 'etiqueta';
const errores = ref<Partial<Record<Campo, string>>>({});
const aviso = ref('');

/** Lo que se va a guardar, ya revisado por el servidor. null = todavía editando. */
const revisado = ref<{ datos: DatosDePrecio; simulacion: SimulacionDePrecio } | null>(
  null,
);

// Cómo se llama en pantalla cada campo que el servidor puede rechazar.
const CAMPO_DEL_SERVIDOR: Record<string, Campo> = {
  precioCentavos: 'precio',
  vigenteDesde: 'desde',
  vigenteHasta: 'hasta',
  etiqueta: 'etiqueta',
};

async function enfocar(campo: Campo) {
  await nextTick();
  document.getElementById(`precio-${campo}`)?.focus();
}

function mostrarError(error: unknown) {
  const campo =
    error instanceof ErrorDeApi && typeof error.detalles.campo === 'string'
      ? CAMPO_DEL_SERVIDOR[error.detalles.campo]
      : undefined;

  if (error instanceof ErrorDeApi && campo) {
    errores.value = { [campo]: error.message };
    void enfocar(campo);
  } else {
    aviso.value =
      error instanceof ErrorDeApi
        ? error.message
        : 'No se pudo guardar. Revisá que el sistema esté encendido.';
  }
}

async function revisar() {
  errores.value = {};
  aviso.value = '';

  const centavos = aCentavos(precio.value);
  if (centavos === null) {
    errores.value = { precio: 'Escribí el precio sin puntos de miles: 1900 o 1900,50' };
    void enfocar('precio');
    return;
  }

  const datos: DatosDePrecio = {
    precioCentavos: centavos,
    vigenteDesde: desde.value,
    vigenteHasta: props.esPromocion ? hasta.value : null,
    esPromocion: props.esPromocion,
    etiqueta: props.esPromocion ? etiqueta.value : null,
  };

  try {
    const simulacion = await simular.mutateAsync({ planId: props.plan.id, datos });
    revisado.value = { datos, simulacion };
    // El paso 2 aparece después de abrir el diálogo: el foco se pone a mano
    // en el botón de guardar, para que Enter confirme.
    await nextTick();
    document.getElementById('precio-guardar')?.focus();
  } catch (error) {
    mostrarError(error);
  }
}

async function volverAEditar() {
  revisado.value = null;
  await enfocar('precio');
}

async function guardar() {
  if (!revisado.value) return;
  aviso.value = '';
  try {
    await agregarPrecio.mutateAsync({
      planId: props.plan.id,
      datos: revisado.value.datos,
    });
    dialogo.value?.close();
  } catch (error) {
    revisado.value = null;
    mostrarError(error);
  }
}

onMounted(() => {
  dialogo.value?.showModal();
});
</script>

<template>
  <dialog
    ref="dialogo"
    aria-labelledby="titulo-precio"
    class="bg-background text-foreground m-auto w-full max-w-lg rounded-xl border p-6 backdrop:bg-black/50"
    @close="emit('cerrar')"
  >
    <!-- Paso 1: escribir -->
    <form v-if="!revisado" class="space-y-5" novalidate @submit.prevent="revisar">
      <div class="space-y-2">
        <h2 id="titulo-precio" class="text-lg font-semibold tracking-tight">
          {{ esPromocion ? 'Cargar promoción' : 'Cambiar precio' }} · {{ plan.nombre }}
        </h2>
        <p class="text-muted-foreground text-sm">
          <template v-if="esPromocion">
            Mientras dure, se cobra este precio en vez del habitual. Al terminar, vuelve
            solo el precio de siempre.
          </template>
          <template v-else>
            El precio actual no se borra: queda en el historial, y lo ya vendido no
            cambia.
          </template>
        </p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <CampoFormulario
          id="precio-precio"
          v-slot="{ control }"
          etiqueta="Precio (Bs)"
          :error="errores.precio"
        >
          <Input
            v-bind="control"
            v-model="precio"
            inputmode="decimal"
            autocomplete="off"
            autofocus
          />
        </CampoFormulario>

        <CampoFormulario
          id="precio-desde"
          v-slot="{ control }"
          etiqueta="Rige desde"
          ayuda="Hoy o una fecha futura."
          :error="errores.desde"
        >
          <Input v-bind="control" v-model="desde" type="date" :min="hoy" />
        </CampoFormulario>

        <template v-if="esPromocion">
          <CampoFormulario
            id="precio-hasta"
            v-slot="{ control }"
            etiqueta="Hasta"
            ayuda="El último día que vale."
            :error="errores.hasta"
          >
            <Input v-bind="control" v-model="hasta" type="date" :min="desde || hoy" />
          </CampoFormulario>

          <CampoFormulario
            id="precio-etiqueta"
            v-slot="{ control }"
            etiqueta="Nombre de la promoción"
            ayuda="Se ve al cobrar. Por ejemplo: Promo de noviembre."
            :error="errores.etiqueta"
          >
            <Input v-bind="control" v-model="etiqueta" autocomplete="off" />
          </CampoFormulario>
        </template>
      </div>

      <p v-if="aviso" role="alert" class="text-destructive text-sm">{{ aviso }}</p>

      <div class="flex justify-end gap-2">
        <Button type="button" variant="outline" @click="dialogo?.close()"
          >Cancelar</Button
        >
        <Button type="submit" :disabled="simular.isPending.value">
          {{ simular.isPending.value ? 'Revisando…' : 'Revisar antes de guardar' }}
        </Button>
      </div>
    </form>

    <!-- Paso 2: ver qué se va a cobrar, y recién ahí guardar -->
    <div v-else class="space-y-5">
      <h2 id="titulo-precio" class="text-lg font-semibold tracking-tight">
        Así queda {{ plan.nombre }}
      </h2>

      <dl class="space-y-3 rounded-lg border p-4" aria-live="polite">
        <div class="flex items-baseline justify-between gap-4">
          <dt class="text-sm">Si alguien paga hoy</dt>
          <dd class="text-base font-semibold tabular-nums">
            {{
              revisado.simulacion.hoy
                ? formatearBs(revisado.simulacion.hoy.precioCentavos)
                : 'Sin precio'
            }}
          </dd>
        </div>
        <div
          v-if="revisado.simulacion.desde !== hoy"
          class="flex items-baseline justify-between gap-4"
        >
          <dt class="text-sm">
            Si paga el {{ formatearFecha(revisado.simulacion.desde) }} o después
          </dt>
          <dd class="text-base font-semibold tabular-nums">
            {{
              revisado.simulacion.elDiaQueEmpieza
                ? formatearBs(revisado.simulacion.elDiaQueEmpieza.precioCentavos)
                : 'Sin precio'
            }}
          </dd>
        </div>
        <p v-if="esPromocion" class="text-muted-foreground text-sm">
          La promoción "{{ revisado.datos.etiqueta }}" vale hasta el
          {{ formatearFecha(revisado.datos.vigenteHasta) }} inclusive.
        </p>
      </dl>

      <p class="text-muted-foreground text-sm">
        <template v-if="revisado.simulacion.desde === hoy">
          Empieza a regir ahora mismo y ya no se va a poder quitar: para corregirlo habría
          que cargar otro precio encima.
        </template>
        <template v-else>
          Mientras no llegue esa fecha y nadie haya comprado con él, se puede quitar.
        </template>
      </p>

      <p v-if="aviso" role="alert" class="text-destructive text-sm">{{ aviso }}</p>

      <div class="flex justify-end gap-2">
        <Button type="button" variant="outline" @click="volverAEditar">
          Volver a editar
        </Button>
        <Button
          id="precio-guardar"
          type="button"
          :disabled="agregarPrecio.isPending.value"
          @click="guardar"
        >
          {{
            agregarPrecio.isPending.value
              ? 'Guardando…'
              : esPromocion
                ? 'Guardar promoción'
                : 'Guardar precio'
          }}
        </Button>
      </div>
    </div>
  </dialog>
</template>
