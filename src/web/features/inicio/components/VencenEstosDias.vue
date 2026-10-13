<script setup lang="ts">
/**
 * A quién conviene ofrecerle renovar: los que vencen en estos días, con el
 * botón para hacerlo sin pasar por la ficha.
 */
import { refDebounced } from '@vueuse/core';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useListaClientes } from '@/web/features/clientes/api/clientes.api';
import { useCoberturas } from '@/web/features/membresias/api/membresias.api';
import EstadoDeMembresia from '@/web/features/membresias/components/EstadoDeMembresia.vue';
import { useAccesos } from '@/web/features/sesion/api/sesion.api';
import ErrorDeCarga from '@/web/shared/components/ErrorDeCarga.vue';
import { Button } from '@/web/shared/ui/button';
import { Skeleton } from '@/web/shared/ui/skeleton';

const A_LA_VISTA = 8;

const { puede } = useAccesos();

const { data, error, isPending, isFetching, refetch } = useListaClientes({
  membresia: 'por_vencer',
  porPagina: A_LA_VISTA,
});

const ids = computed(() => data.value?.clientes.map((c) => c.id) ?? []);
const { data: coberturas } = useCoberturas(ids);
const coberturaDe = computed(
  () => new Map(coberturas.value?.coberturas.map((c) => [c.clienteId, c]) ?? []),
);

const tardando = refDebounced(isPending, 150);
const mostrarEsqueleto = computed(() => isPending.value && tardando.value);

const listaCompleta = { name: 'clientes', query: { membresia: 'por_vencer' } };
</script>

<template>
  <section aria-labelledby="inicio-vencen" class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 id="inicio-vencen" class="titulo-seccion">
        Vencen en estos días
        <span v-if="data" class="text-muted-foreground font-normal tabular-nums">
          ({{ data.total }})
        </span>
      </h2>
      <Button v-if="data && data.total > A_LA_VISTA" as-child variant="outline" size="sm">
        <RouterLink :to="listaCompleta">Ver los {{ data.total }}</RouterLink>
      </Button>
    </div>

    <ErrorDeCarga
      v-if="error && !data"
      titulo="No se pudo cargar quién vence"
      :mensaje="error.message"
      :reintentando="isFetching"
      @reintentar="refetch()"
    />

    <ul
      v-else-if="data && data.clientes.length > 0"
      class="bg-card divide-y overflow-hidden rounded-xl border"
    >
      <li
        v-for="cliente in data.clientes"
        :key="cliente.id"
        class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
      >
        <div class="min-w-0">
          <RouterLink
            :to="{ name: 'cliente-ficha', params: { id: cliente.id } }"
            class="focus-visible:ring-ring block truncate rounded-sm text-sm font-medium outline-none hover:underline focus-visible:ring-3"
          >
            {{ cliente.nombreCompleto }}
          </RouterLink>
          <p class="text-muted-foreground text-xs tabular-nums">
            nº {{ cliente.nroSocio }}
            <template v-if="cliente.telefono"> · {{ cliente.telefono }}</template>
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-3">
          <EstadoDeMembresia
            v-if="coberturaDe.get(cliente.id)"
            :cobertura="coberturaDe.get(cliente.id)!"
          />
          <Button v-if="puede('membresias.vender')" as-child variant="outline" size="sm">
            <RouterLink :to="{ name: 'membresia-nueva', params: { id: cliente.id } }">
              Renovar
              <span class="sr-only">la membresía de {{ cliente.nombreCompleto }}</span>
            </RouterLink>
          </Button>
        </div>
      </li>
    </ul>

    <!-- Nadie por vencer es una buena noticia, no un hueco. -->
    <p
      v-else-if="data"
      class="bg-card text-muted-foreground rounded-xl border px-4 py-6 text-center text-sm"
    >
      Nadie vence en estos días.
    </p>

    <Skeleton
      v-else-if="mostrarEsqueleto"
      class="h-40 w-full rounded-xl"
      aria-hidden="true"
    />
  </section>
</template>
