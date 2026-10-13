<script setup lang="ts">
/**
 * Las acciones sobre el estado de un cliente, al pie de su ficha:
 * bloquear / desbloquear (quien tenga ese acceso) y dar de baja / reactivar
 * (quien tenga ese otro acceso; el dueño, siempre).
 *
 * Dar de baja no borra nada, y la pantalla lo dice.
 */
import { nextTick, ref } from 'vue';
import { useForm } from 'vee-validate';
import { type ClienteVista, bloqueoInputSchema } from '@/modules/clientes';
import { useAccesos } from '@/web/features/sesion/api/sesion.api';
import CampoFormulario from '@/web/shared/components/CampoFormulario.vue';
import ConfirmarDialog from '@/web/shared/components/ConfirmarDialog.vue';
import { ErrorDeApi } from '@/web/shared/lib/api';
import { avisos } from '@/web/shared/lib/avisos';
import { esquemaDeFormulario } from '@/web/shared/lib/validacion';
import { Button } from '@/web/shared/ui/button';
import { useEstadoDeCliente } from '../api/clientes.api';

const props = defineProps<{ cliente: ClienteVista }>();

const { puede } = useAccesos();
const { bloquear, desbloquear, darDeBaja, reactivar } = useEstadoDeCliente();

const mensajeDe = (error: unknown) =>
  error instanceof ErrorDeApi
    ? error.message
    : 'No se pudo guardar. Revisá que el sistema esté encendido.';

const abierto = ref<'bloquear' | 'baja' | null>(null);
const aviso = ref('');

// ── bloquear: pide el motivo ──
const dialogoBloqueo = ref<HTMLDialogElement | null>(null);
const { handleSubmit, defineField, errors, setFieldError, resetForm } = useForm({
  validationSchema: esquemaDeFormulario(bloqueoInputSchema),
  initialValues: { motivo: '' },
});
const [motivo, motivoAttrs] = defineField('motivo', (estado) => ({
  validateOnBlur: false,
  validateOnModelUpdate: estado.errors.length > 0,
}));

async function abrirBloqueo() {
  resetForm();
  abierto.value = 'bloquear';
  await nextTick();
  dialogoBloqueo.value?.showModal();
}

async function enfocarMotivo() {
  await nextTick();
  document.getElementById('bloqueo-motivo')?.focus();
}

const confirmarBloqueo = handleSubmit(async (valores) => {
  try {
    await bloquear.mutateAsync({ id: props.cliente.id, motivo: valores.motivo });
    dialogoBloqueo.value?.close();
    avisos.exito('Cliente bloqueado.');
  } catch (error) {
    setFieldError('motivo', mensajeDe(error));
    void enfocarMotivo();
  }
}, enfocarMotivo);

// ── el resto: una confirmación o directo ──
async function hacer(accion: () => Promise<unknown>, hecho: string) {
  aviso.value = '';
  try {
    await accion();
    abierto.value = null;
    avisos.exito(hecho);
  } catch (error) {
    aviso.value = mensajeDe(error);
  }
}

function abrirBaja() {
  aviso.value = '';
  abierto.value = 'baja';
}
</script>

<template>
  <section
    v-if="puede('clientes.bloquear') || puede('clientes.baja')"
    aria-labelledby="titulo-estado-cliente"
    class="space-y-4 border-t pt-6"
  >
    <h2 id="titulo-estado-cliente" class="titulo-seccion">Acceso y estado</h2>

    <p v-if="aviso && abierto === null" role="alert" class="text-destructive text-sm">
      {{ aviso }}
    </p>

    <div v-if="puede('clientes.bloquear') && cliente.activo" class="space-y-2">
      <p class="text-muted-foreground max-w-prose text-sm">
        <template v-if="cliente.bloqueado">
          Está bloqueado: el check-in lo rechaza aunque tenga la membresía al día.
        </template>
        <template v-else>
          Bloquearlo hace que el check-in lo rechace aunque tenga la membresía al día. No
          toca su membresía ni sus pagos.
        </template>
      </p>
      <Button
        v-if="cliente.bloqueado"
        type="button"
        variant="outline"
        :disabled="desbloquear.isPending.value"
        @click="hacer(() => desbloquear.mutateAsync(cliente.id), 'Cliente desbloqueado.')"
      >
        Desbloquear cliente
      </Button>
      <Button v-else type="button" variant="outline" @click="abrirBloqueo">
        Bloquear cliente
      </Button>
    </div>

    <div v-if="puede('clientes.baja')" class="space-y-2">
      <p class="text-muted-foreground max-w-prose text-sm">
        <template v-if="cliente.activo">
          Dar de baja lo saca de las listas y de los reportes, y deja de poder entrar.
          <strong class="text-foreground font-medium">No se borra nada:</strong> su
          historial de membresías, pagos e ingresos queda guardado, y se puede reactivar.
        </template>
        <template v-else>
          Está dado de baja. Reactivarlo lo devuelve a las listas, con su mismo número de
          socio y todo su historial.
        </template>
      </p>
      <Button
        v-if="cliente.activo"
        type="button"
        variant="destructive"
        @click="abrirBaja"
      >
        Dar de baja cliente
      </Button>
      <Button
        v-else
        type="button"
        variant="outline"
        :disabled="reactivar.isPending.value"
        @click="hacer(() => reactivar.mutateAsync(cliente.id), 'Cliente reactivado.')"
      >
        Reactivar cliente
      </Button>
    </div>

    <dialog
      v-if="abierto === 'bloquear'"
      ref="dialogoBloqueo"
      aria-labelledby="titulo-bloqueo"
      class="bg-background text-foreground backdrop:bg-overlay m-auto w-full max-w-lg rounded-xl border p-6"
      @close="abierto = null"
    >
      <form class="space-y-5" novalidate @submit="confirmarBloqueo">
        <div class="space-y-2">
          <h2 id="titulo-bloqueo" class="titulo-seccion">
            ¿Bloquear a {{ cliente.nombreCompleto }}?
          </h2>
          <p class="text-muted-foreground text-sm">
            No va a poder entrar hasta que alguien lo desbloquee. El motivo se ve en su
            ficha.
          </p>
        </div>

        <CampoFormulario
          id="bloqueo-motivo"
          v-slot="{ control }"
          etiqueta="Motivo"
          ayuda="Lo va a leer recepción cuando la persona pregunte por qué no entra."
          :error="errors.motivo"
        >
          <textarea
            v-bind="{ ...control, ...motivoAttrs }"
            v-model="motivo"
            rows="3"
            autofocus
            class="border-input focus-visible:border-ring focus-visible:ring-ring aria-invalid:border-destructive w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3"
          ></textarea>
        </CampoFormulario>

        <div class="flex justify-end gap-2">
          <Button type="button" variant="outline" @click="dialogoBloqueo?.close()">
            No bloquear
          </Button>
          <Button
            type="submit"
            variant="destructive"
            :disabled="bloquear.isPending.value"
          >
            {{ bloquear.isPending.value ? 'Bloqueando…' : 'Bloquear cliente' }}
          </Button>
        </div>
      </form>
    </dialog>

    <ConfirmarDialog
      v-if="abierto === 'baja'"
      :titulo="`¿Dar de baja a ${cliente.nombreCompleto}?`"
      confirmar="Dar de baja cliente"
      cancelar="No dar de baja"
      destructivo
      :pendiente="darDeBaja.isPending.value"
      :error="aviso"
      @confirmar="
        hacer(
          () => darDeBaja.mutateAsync(cliente.id),
          'Cliente dado de baja. Su historial queda guardado.',
        )
      "
      @cerrar="abierto = null"
    >
      <p>Deja de aparecer en las listas y en los reportes, y no puede entrar.</p>
      <p>
        No se borra nada: su historial queda guardado y lo podés reactivar desde la lista
        de clientes, en "Dados de baja".
      </p>
    </ConfirmarDialog>
  </section>
</template>
