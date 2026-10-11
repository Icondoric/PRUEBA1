<script setup lang="ts">
/**
 * Confirmación para anular un pago.
 *
 * Acá sí va un diálogo y no un "deshacer": anular no tiene vuelta atrás y
 * además cancela la membresía. Pide el motivo, que es obligatorio.
 */
import { nextTick, onMounted, ref } from 'vue';
import { useForm } from 'vee-validate';
import { anulacionInputSchema } from '@/modules/pagos';
import CampoFormulario from '@/web/shared/components/CampoFormulario.vue';
import { ErrorDeApi } from '@/web/shared/lib/api';
import { formatearBs, formatearFecha } from '@/web/shared/lib/formato';
import { esquemaDeFormulario } from '@/web/shared/lib/validacion';
import { Button } from '@/web/shared/ui/button';
import { type PagoVista, useAnularPago } from '../api/pagos.api';

const props = defineProps<{ pago: PagoVista }>();
const emit = defineEmits<{ cerrar: [] }>();

const dialogo = ref<HTMLDialogElement | null>(null);
const anular = useAnularPago();
const aviso = ref('');

const { handleSubmit, defineField, errors, setFieldError } = useForm({
  validationSchema: esquemaDeFormulario(anulacionInputSchema),
  initialValues: { motivo: '' },
});

const [motivo, motivoAttrs] = defineField('motivo', (estado) => ({
  validateOnBlur: false,
  validateOnModelUpdate: estado.errors.length > 0,
}));

async function enfocarMotivo() {
  await nextTick();
  document.getElementById('anulacion-motivo')?.focus();
}

const confirmar = handleSubmit(async (valores) => {
  aviso.value = '';
  try {
    await anular.mutateAsync({ id: props.pago.id, motivo: valores.motivo });
    dialogo.value?.close();
  } catch (error) {
    if (error instanceof ErrorDeApi && error.detalles.campo === 'motivo') {
      setFieldError('motivo', error.message);
      void enfocarMotivo();
    } else {
      aviso.value =
        error instanceof ErrorDeApi
          ? error.message
          : 'No se pudo anular. Revisá que el sistema esté encendido.';
    }
  }
}, enfocarMotivo);

onMounted(() => {
  dialogo.value?.showModal();
});
</script>

<template>
  <dialog
    ref="dialogo"
    aria-labelledby="titulo-anulacion"
    class="bg-background text-foreground m-auto w-full max-w-lg rounded-xl border p-6 backdrop:bg-black/50"
    @close="emit('cerrar')"
  >
    <form class="space-y-5" novalidate @submit="confirmar">
      <div class="space-y-2">
        <h2 id="titulo-anulacion" class="text-lg font-semibold tracking-tight">
          ¿Anular este pago?
        </h2>
        <p class="text-sm">
          {{ formatearBs(pago.montoCentavos) }} de {{ pago.clienteNombreCompleto }}, del
          {{ formatearFecha(pago.fechaPago)
          }}<template v-if="pago.planNombre"> ({{ pago.planNombre }})</template>.
        </p>
        <p class="text-muted-foreground text-sm">
          El pago queda en el historial marcado como anulado y deja de sumar en la caja.
          <template v-if="pago.membresiaId">
            La membresía que pagaba se cancela y deja de dar acceso.
          </template>
          No se puede deshacer.
        </p>
      </div>

      <CampoFormulario
        id="anulacion-motivo"
        v-slot="{ control }"
        etiqueta="Motivo"
        ayuda="Por ejemplo: se cargó el plan equivocado, se cobró dos veces."
        :error="errors.motivo"
      >
        <textarea
          v-bind="{ ...control, ...motivoAttrs }"
          v-model="motivo"
          rows="3"
          autofocus
          class="border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3"
        ></textarea>
      </CampoFormulario>

      <p v-if="aviso" role="alert" class="text-destructive text-sm">{{ aviso }}</p>

      <div class="flex justify-end gap-2">
        <Button type="button" variant="outline" @click="dialogo?.close()"
          >No anular</Button
        >
        <Button type="submit" variant="destructive" :disabled="anular.isPending.value">
          {{ anular.isPending.value ? 'Anulando…' : 'Anular pago' }}
        </Button>
      </div>
    </form>
  </dialog>
</template>
