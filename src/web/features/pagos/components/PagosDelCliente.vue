<script setup lang="ts">
/**
 * La sección "Pagos" de la ficha del cliente: todo lo que pagó, y anular.
 */
import ErrorDeCarga from '@/web/shared/components/ErrorDeCarga.vue';
import { usePagosDeCliente } from '../api/pagos.api';
import TablaPagos from './TablaPagos.vue';

const props = defineProps<{ clienteId: number }>();

const { data, error, isFetching, refetch } = usePagosDeCliente(() => props.clienteId);
</script>

<template>
  <section aria-labelledby="titulo-pagos" class="space-y-4">
    <h2 id="titulo-pagos" class="text-lg font-semibold tracking-tight">Pagos</h2>

    <ErrorDeCarga
      v-if="error && !data"
      titulo="No se pudieron cargar los pagos"
      :mensaje="error.message"
      :reintentando="isFetching"
      @reintentar="refetch()"
    />

    <template v-else-if="data">
      <TablaPagos v-if="data.pagos.length > 0" :pagos="data.pagos" />
      <p v-else class="text-muted-foreground text-sm">Todavía no hizo ningún pago.</p>
    </template>
  </section>
</template>
