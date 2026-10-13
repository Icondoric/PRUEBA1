<script setup lang="ts">
/** Lo cobrado hoy. La ve quien puede ver la caja del día. */
import { Banknote } from '@lucide/vue';
import { computed } from 'vue';
import { usePagos } from '@/web/features/pagos/api/pagos.api';
import { NOMBRE_METODO } from '@/web/features/pagos/lib/metodos';
import { formatearBs, plural } from '@/web/shared/lib/formato';
import CajaResumen from './CajaResumen.vue';

const { data, error } = usePagos({});

const pie = computed(() => {
  const totales = data.value?.totales;
  if (!totales) return undefined;
  if (totales.cantidad === 0) return 'Todavía no se cobró nada';

  // Por método, solo los que tuvieron movimiento: es lo que se cuenta al cerrar.
  const porMetodo = totales.porMetodo
    .filter((t) => t.centavos > 0)
    .map((t) => `${NOMBRE_METODO[t.metodo]} ${formatearBs(t.centavos)}`)
    .join(' · ');
  return `${plural(totales.cantidad, 'pago', 'pagos')} · ${porMetodo}`;
});
</script>

<template>
  <CajaResumen
    titulo="Cobrado hoy"
    :valor="data ? formatearBs(data.totales.totalCentavos) : undefined"
    :pie="pie"
    :icono="Banknote"
    :destino="{ name: 'pagos' }"
    :falla="!!error && !data"
  />
</template>
