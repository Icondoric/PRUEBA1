<script setup lang="ts">
/**
 * Crear un plan nuevo, o cambiarle el nombre a uno que ya existe.
 *
 * La duración de un plan existente no se cambia: si el "Mensual" pasa a durar
 * 31 días, se crea otro plan y se da de baja el viejo. Así el historial sigue
 * diciendo la verdad.
 */
import { nextTick, onMounted, ref } from 'vue';
import CampoFormulario from '@/web/shared/components/CampoFormulario.vue';
import { ErrorDeApi } from '@/web/shared/lib/api';
import { aCentavos } from '@/web/shared/lib/formato';
import { Button } from '@/web/shared/ui/button';
import { Input } from '@/web/shared/ui/input';
import { type PlanAdministrable, useGestionDePlanes } from '../api/planes.api';

const props = defineProps<{
  /** Con plan: se le cambia el nombre. Sin plan: se crea uno. */
  plan?: PlanAdministrable;
}>();
const emit = defineEmits<{ cerrar: [] }>();

const dialogo = ref<HTMLDialogElement | null>(null);
const { crearPlan, renombrar } = useGestionDePlanes();

const nombre = ref(props.plan?.nombre ?? '');
const dias = ref('30');
const esPase = ref(false);
const precio = ref('');

type Campo = 'nombre' | 'dias' | 'precio';
const errores = ref<Partial<Record<Campo, string>>>({});
const aviso = ref('');

const CAMPO_DEL_SERVIDOR: Record<string, Campo> = {
  nombre: 'nombre',
  diasDuracion: 'dias',
  precioCentavos: 'precio',
};

async function enfocar(campo: Campo) {
  await nextTick();
  document.getElementById(`plan-${campo}`)?.focus();
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

async function guardar() {
  errores.value = {};
  aviso.value = '';

  try {
    if (props.plan) {
      await renombrar.mutateAsync({ id: props.plan.id, nombre: nombre.value });
    } else {
      const centavos = aCentavos(precio.value);
      if (centavos === null) {
        errores.value = {
          precio: 'Escribí el precio sin puntos de miles: 1900 o 1900,50',
        };
        void enfocar('precio');
        return;
      }
      const diasDuracion = esPase.value ? 1 : Number(dias.value);
      if (!Number.isInteger(diasDuracion)) {
        errores.value = { dias: 'Escribí la duración en días, sin decimales' };
        void enfocar('dias');
        return;
      }
      await crearPlan.mutateAsync({
        nombre: nombre.value,
        diasDuracion,
        esPaseDiario: esPase.value,
        precioCentavos: centavos,
      });
    }
    dialogo.value?.close();
  } catch (error) {
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
    aria-labelledby="titulo-plan-dialogo"
    class="bg-background text-foreground m-auto w-full max-w-lg rounded-xl border p-6 backdrop:bg-black/50"
    @close="emit('cerrar')"
  >
    <form class="space-y-5" novalidate @submit.prevent="guardar">
      <h2 id="titulo-plan-dialogo" class="text-lg font-semibold tracking-tight">
        {{ plan ? `Cambiar el nombre de ${plan.nombre}` : 'Crear plan' }}
      </h2>

      <CampoFormulario
        id="plan-nombre"
        v-slot="{ control }"
        etiqueta="Nombre"
        :ayuda="
          plan
            ? undefined
            : 'Como lo va a ver recepción al vender. Por ejemplo: Semestral.'
        "
        :error="errores.nombre"
      >
        <Input v-bind="control" v-model="nombre" autocomplete="off" autofocus />
      </CampoFormulario>

      <template v-if="!plan">
        <label class="flex w-fit items-center gap-2 text-sm">
          <input v-model="esPase" type="checkbox" class="accent-primary size-4" />
          Es un pase por sesión (vale solo el día que se paga)
        </label>

        <div class="grid gap-4 sm:grid-cols-2">
          <CampoFormulario
            v-if="!esPase"
            id="plan-dias"
            v-slot="{ control }"
            etiqueta="Duración (días)"
            ayuda="En días, no en meses: 30, 90, 365. No se puede cambiar después."
            :error="errores.dias"
          >
            <Input
              v-bind="control"
              v-model="dias"
              inputmode="numeric"
              autocomplete="off"
            />
          </CampoFormulario>

          <CampoFormulario
            id="plan-precio"
            v-slot="{ control }"
            etiqueta="Precio (Bs)"
            ayuda="Rige desde hoy. Después se puede cambiar."
            :error="errores.precio"
          >
            <Input
              v-bind="control"
              v-model="precio"
              inputmode="decimal"
              autocomplete="off"
            />
          </CampoFormulario>
        </div>
      </template>

      <p v-if="aviso" role="alert" class="text-destructive text-sm">{{ aviso }}</p>

      <div class="flex justify-end gap-2">
        <Button type="button" variant="outline" @click="dialogo?.close()"
          >Cancelar</Button
        >
        <Button
          type="submit"
          :disabled="crearPlan.isPending.value || renombrar.isPending.value"
        >
          {{ plan ? 'Guardar nombre' : 'Crear plan' }}
        </Button>
      </div>
    </form>
  </dialog>
</template>
