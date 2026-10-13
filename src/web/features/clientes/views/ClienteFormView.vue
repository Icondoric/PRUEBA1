<script setup lang="ts">
/**
 * Alta y edición de un cliente. Es la misma pantalla: con `:id` en la ruta
 * edita, sin él registra uno nuevo.
 */
import { ArrowLeft } from '@lucide/vue';
import { computed } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import ErrorDeCarga from '@/web/shared/components/ErrorDeCarga.vue';
import { ErrorDeApi } from '@/web/shared/lib/api';
import {
  type DatosCliente,
  useActualizarCliente,
  useCliente,
  useRegistrarCliente,
} from '../api/clientes.api';
import ClienteForm from '../components/ClienteForm.vue';

const route = useRoute();
const router = useRouter();

// 0 = alta. `useCliente` no consulta con id 0.
const id = computed(() =>
  route.name === 'cliente-editar' ? Number(route.params.id) : 0,
);
const editando = computed(() => id.value > 0);

const { data: cliente, error: errorDeCarga, isFetching, refetch } = useCliente(id);
// Quién lo refirió se guarda como cliente, pero se edita por número de socio:
// hay que esperar a tenerlo para armar el formulario con el campo ya lleno.
const { data: padrino, isPending: buscandoPadrino } = useCliente(
  () => cliente.value?.referidoPorClienteId ?? 0,
);
const listoParaEditar = computed(
  () =>
    !!cliente.value && (!cliente.value.referidoPorClienteId || !buscandoPadrino.value),
);
const inicial = computed(() =>
  cliente.value
    ? {
        ...cliente.value,
        referidoPor: padrino.value ? String(padrino.value.nroSocio) : '',
      }
    : undefined,
);

const registrar = useRegistrarCliente();
const actualizar = useActualizarCliente();

const guardando = computed(() => registrar.isPending.value || actualizar.isPending.value);

const errorAlGuardar = computed(() => {
  const error = editando.value ? actualizar.error.value : registrar.error.value;
  if (!error) return null;
  // Lo que no vino del servidor (se cortó la conexión) se muestra igual, con
  // el mismo formato, para que el formulario tenga un solo camino de error.
  return error instanceof ErrorDeApi
    ? error
    : new ErrorDeApi(
        'SIN_CONEXION',
        'No se pudo guardar. Revisá que el sistema esté encendido.',
        0,
      );
});

const volver = computed(() =>
  editando.value
    ? { name: 'cliente-ficha', params: { id: id.value } }
    : { name: 'clientes' },
);

async function guardar(datos: DatosCliente) {
  const guardado = editando.value
    ? await actualizar.mutateAsync({ id: id.value, datos }).catch(() => null)
    : await registrar.mutateAsync(datos).catch(() => null);

  // Si falló, el error ya está en la mutación y el formulario lo muestra.
  if (!guardado) return;

  await router.replace({
    name: 'cliente-ficha',
    params: { id: guardado.id },
    state: { aviso: editando.value ? 'Cambios guardados.' : 'Cliente registrado.' },
  });
}
</script>

<template>
  <div class="space-y-6">
    <RouterLink
      :to="volver"
      class="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-sm text-sm outline-none focus-visible:ring-3"
    >
      <ArrowLeft class="size-4" aria-hidden="true" />
      {{ editando ? 'Ficha del cliente' : 'Clientes' }}
    </RouterLink>

    <h1 tabindex="-1" class="titulo-pantalla">
      {{ editando ? 'Editar cliente' : 'Registrar cliente' }}
    </h1>

    <ErrorDeCarga
      v-if="editando && errorDeCarga && !cliente"
      titulo="No se pudieron cargar los datos del cliente"
      :mensaje="errorDeCarga.message"
      :reintentando="isFetching"
      @reintentar="refetch()"
    />

    <!-- La `key` rearma el formulario con los datos del cliente cuando llegan. -->
    <ClienteForm
      v-else-if="!editando || listoParaEditar"
      :key="cliente?.id ?? 'nuevo'"
      :inicial="inicial"
      :texto-guardar="editando ? 'Guardar cambios' : 'Registrar cliente'"
      :guardando="guardando"
      :error="errorAlGuardar"
      @guardar="guardar"
      @cancelar="router.push(volver)"
    />
  </div>
</template>
