<script setup lang="ts">
/**
 * Ficha del cliente: sus datos y, debajo, su membresía e historial (que son de
 * la feature de membresías).
 */
import { ArrowLeft, Ban, Pencil } from '@lucide/vue';
import { refDebounced } from '@vueuse/core';
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import MembresiasDelCliente from '@/web/features/membresias/components/MembresiasDelCliente.vue';
import PagosDelCliente from '@/web/features/pagos/components/PagosDelCliente.vue';
import ErrorDeCarga from '@/web/shared/components/ErrorDeCarga.vue';
import { ErrorDeApi } from '@/web/shared/lib/api';
import { formatearCi, formatearFecha } from '@/web/shared/lib/formato';
import { Button } from '@/web/shared/ui/button';
import { Skeleton } from '@/web/shared/ui/skeleton';
import { useCliente } from '../api/clientes.api';
import ClienteEtiquetas from '../components/ClienteEtiquetas.vue';

const route = useRoute();
const id = computed(() => Number(route.params.id));

const { data: cliente, error, isPending, isFetching, refetch } = useCliente(id);

// Quién lo trajo: se resuelve a nombre con la misma query de siempre.
const { data: padrino } = useCliente(() => cliente.value?.referidoPorClienteId ?? 0);

const noExiste = computed(
  () => error.value instanceof ErrorDeApi && error.value.status === 404,
);

const tardando = refDebounced(isPending, 150);
const mostrarEsqueleto = computed(() => isPending.value && tardando.value);

// "Cliente registrado" / "Cambios guardados": lo deja el formulario al volver.
const confirmacion = computed(() => {
  const aviso: unknown = history.state?.aviso;
  return route.path && typeof aviso === 'string' ? aviso : '';
});
</script>

<template>
  <div class="max-w-3xl space-y-6">
    <RouterLink
      :to="{ name: 'clientes' }"
      class="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex items-center gap-1.5 rounded-sm text-sm outline-none focus-visible:ring-3"
    >
      <ArrowLeft class="size-4" aria-hidden="true" />
      Clientes
    </RouterLink>

    <template v-if="noExiste">
      <h1 tabindex="-1" class="text-2xl font-semibold tracking-tight">
        No se encontró ese cliente
      </h1>
      <p class="text-muted-foreground max-w-prose text-sm">
        Puede que el enlace esté mal o que el cliente haya sido dado de baja. Buscalo por
        nombre, CI o número de socio en la lista.
      </p>
    </template>

    <template v-else-if="error && !cliente">
      <h1 tabindex="-1" class="text-2xl font-semibold tracking-tight">
        Ficha del cliente
      </h1>
      <ErrorDeCarga
        titulo="No se pudo cargar la ficha"
        :mensaje="error.message"
        :reintentando="isFetching"
        @reintentar="refetch()"
      />
    </template>

    <template v-else-if="cliente">
      <p v-if="confirmacion" role="status" class="rounded-md border px-3 py-2 text-sm">
        {{ confirmacion }}
      </p>

      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-2">
          <h1 tabindex="-1" class="text-2xl font-semibold tracking-tight">
            {{ cliente.nombreCompleto }}
          </h1>
          <ClienteEtiquetas :cliente="cliente" />
        </div>
        <Button as-child variant="outline">
          <RouterLink :to="{ name: 'cliente-editar', params: { id: cliente.id } }">
            <Pencil aria-hidden="true" />
            Editar datos
          </RouterLink>
        </Button>
      </div>

      <div
        v-if="cliente.bloqueado"
        class="border-destructive/40 flex items-start gap-3 rounded-lg border p-4"
      >
        <Ban class="text-destructive mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div class="space-y-1">
          <p class="text-sm font-medium">Acceso bloqueado</p>
          <p class="text-muted-foreground text-sm">
            {{ cliente.motivoBloqueo ?? 'No se registró el motivo.' }}
          </p>
        </div>
      </div>

      <dl class="grid gap-x-8 gap-y-5 rounded-lg border p-5 sm:grid-cols-2">
        <div class="space-y-1">
          <dt class="text-muted-foreground text-sm">Nº de socio</dt>
          <dd class="text-sm font-medium tabular-nums">{{ cliente.nroSocio }}</dd>
        </div>
        <div class="space-y-1">
          <dt class="text-muted-foreground text-sm">CI</dt>
          <dd class="text-sm font-medium tabular-nums">
            {{ formatearCi(cliente.ci, cliente.ciExtension) }}
          </dd>
        </div>
        <div class="space-y-1">
          <dt class="text-muted-foreground text-sm">Teléfono</dt>
          <dd class="text-sm font-medium tabular-nums">{{ cliente.telefono ?? '—' }}</dd>
        </div>
        <div class="space-y-1">
          <dt class="text-muted-foreground text-sm">Fecha de registro</dt>
          <dd class="text-sm font-medium tabular-nums">
            {{ formatearFecha(cliente.fechaRegistro) }}
          </dd>
        </div>
        <div v-if="cliente.referidoPorClienteId" class="space-y-1">
          <dt class="text-muted-foreground text-sm">Referido por</dt>
          <dd class="text-sm font-medium">
            <RouterLink
              :to="{
                name: 'cliente-ficha',
                params: { id: cliente.referidoPorClienteId },
              }"
              class="focus-visible:ring-ring/50 rounded-sm underline underline-offset-4 outline-none focus-visible:ring-3"
            >
              {{
                padrino
                  ? `${padrino.nombreCompleto} (socio nº ${padrino.nroSocio})`
                  : 'Ver ficha'
              }}
            </RouterLink>
          </dd>
        </div>
        <div v-if="cliente.notas" class="space-y-1 sm:col-span-2">
          <dt class="text-muted-foreground text-sm">Notas</dt>
          <dd class="max-w-prose text-sm">{{ cliente.notas }}</dd>
        </div>
      </dl>

      <MembresiasDelCliente :cliente-id="cliente.id" />

      <PagosDelCliente :cliente-id="cliente.id" />
    </template>

    <template v-else>
      <h1 tabindex="-1" class="text-2xl font-semibold tracking-tight">
        <span class="sr-only">Cargando la ficha del cliente</span>
        <Skeleton v-if="mostrarEsqueleto" class="h-8 w-64" aria-hidden="true" />
      </h1>
      <Skeleton v-if="mostrarEsqueleto" class="h-40 w-full" aria-hidden="true" />
    </template>
  </div>
</template>
