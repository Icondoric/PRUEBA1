<script setup lang="ts">
/**
 * Pagos: el historial de un rango de fechas y cuánto entró por cada método.
 *
 * Abre en el día de hoy, que es lo que recepción necesita para cerrar la caja.
 * Los filtros viven en la URL, igual que en la lista de clientes.
 */
import { refDebounced } from '@vueuse/core';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { METODOS, type Metodo } from '@/modules/pagos';
import ErrorDeCarga from '@/web/shared/components/ErrorDeCarga.vue';
import { formatearBs, formatearFecha, plural } from '@/web/shared/lib/formato';
import { Button } from '@/web/shared/ui/button';
import { Input } from '@/web/shared/ui/input';
import { Label } from '@/web/shared/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/web/shared/ui/select';
import { Skeleton } from '@/web/shared/ui/skeleton';
import { usePagos } from '../api/pagos.api';
import TablaPagos from '../components/TablaPagos.vue';
import { NOMBRE_METODO } from '../lib/metodos';

const route = useRoute();
const router = useRouter();

const deLaUrl = (valor: unknown) => (typeof valor === 'string' ? valor : '');
const esMetodo = (valor: unknown): valor is Metodo => METODOS.some((m) => m === valor);

const filtros = computed(() => {
  const metodo = deLaUrl(route.query.metodo);
  return {
    desde: deLaUrl(route.query.desde),
    hasta: deLaUrl(route.query.hasta),
    metodo: esMetodo(metodo) ? metodo : undefined,
  };
});

const { data, error, isPending, isFetching, isPlaceholderData, refetch } =
  usePagos(filtros);

function irA(cambios: { desde?: string; hasta?: string; metodo?: string }) {
  const nuevo = { ...filtros.value, ...cambios };
  // Al tocar una sola fecha, la otra queda como se ve en pantalla: si no, el
  // rango se achicaría a un solo día sin que nadie lo pida.
  if (nuevo.desde || nuevo.hasta) {
    nuevo.desde ||= data.value?.desde ?? '';
    nuevo.hasta ||= data.value?.hasta ?? '';
  }
  void router.replace({
    query: {
      desde: nuevo.desde || undefined,
      hasta: nuevo.hasta || undefined,
      metodo: esMetodo(nuevo.metodo) ? nuevo.metodo : undefined,
    },
  });
}

const hayFiltros = computed(
  () =>
    filtros.value.desde !== '' ||
    filtros.value.hasta !== '' ||
    filtros.value.metodo !== undefined,
);

const tardando = refDebounced(isPending, 150);
const mostrarEsqueleto = computed(() => isPending.value && tardando.value);

const periodo = computed(() => {
  if (!data.value) return '';
  const { desde, hasta, hoy } = data.value;
  if (desde === hasta) return desde === hoy ? 'hoy' : `el ${formatearFecha(desde)}`;
  return `del ${formatearFecha(desde)} al ${formatearFecha(hasta)}`;
});
</script>

<template>
  <div class="space-y-5">
    <h1 tabindex="-1" class="text-2xl font-semibold tracking-tight">Pagos</h1>

    <form class="flex flex-wrap items-end gap-3" @submit.prevent>
      <div class="space-y-1.5">
        <Label for="pagos-desde">Desde</Label>
        <Input
          id="pagos-desde"
          type="date"
          class="w-44"
          :model-value="filtros.desde || data?.desde || ''"
          :max="data?.hoy"
          @update:model-value="irA({ desde: String($event) })"
        />
      </div>
      <div class="space-y-1.5">
        <Label for="pagos-hasta">Hasta</Label>
        <Input
          id="pagos-hasta"
          type="date"
          class="w-44"
          :model-value="filtros.hasta || data?.hasta || ''"
          :max="data?.hoy"
          @update:model-value="irA({ hasta: String($event) })"
        />
      </div>
      <div class="space-y-1.5">
        <Label for="pagos-metodo">Método</Label>
        <Select
          :model-value="filtros.metodo ?? 'todos'"
          @update:model-value="irA({ metodo: String($event) })"
        >
          <SelectTrigger id="pagos-metodo" class="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem v-for="metodo in METODOS" :key="metodo" :value="metodo">
              {{ NOMBRE_METODO[metodo] }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button
        v-if="hayFiltros"
        type="button"
        variant="ghost"
        @click="irA({ desde: '', hasta: '', metodo: undefined })"
      >
        Ver solo hoy
      </Button>
    </form>

    <ErrorDeCarga
      v-if="error && !data"
      titulo="No se pudieron cargar los pagos"
      :mensaje="error.message"
      :reintentando="isFetching"
      @reintentar="refetch()"
    />

    <template v-else-if="data">
      <!-- Si el rango pedido no es válido, se avisa y se sigue viendo lo anterior. -->
      <p v-if="error" role="alert" class="text-destructive text-sm">
        {{ error.message }}
      </p>

      <div
        class="space-y-5 transition-opacity duration-150"
        :class="{ 'opacity-60': isPlaceholderData }"
        :aria-busy="isFetching"
      >
        <section aria-labelledby="titulo-caja" class="space-y-3">
          <h2 id="titulo-caja" class="text-lg font-semibold tracking-tight">
            Cobrado {{ periodo }}
          </h2>

          <dl class="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div class="bg-muted/50 space-y-1 rounded-lg border p-4">
              <dt class="text-muted-foreground text-sm">Total</dt>
              <dd class="text-xl font-semibold tabular-nums">
                {{ formatearBs(data.totales.totalCentavos) }}
              </dd>
              <dd class="text-muted-foreground text-xs">
                {{ plural(data.totales.cantidad, 'pago', 'pagos') }}
              </dd>
            </div>
            <div
              v-for="total in data.totales.porMetodo"
              :key="total.metodo"
              class="space-y-1 rounded-lg border p-4"
            >
              <dt class="text-muted-foreground text-sm">
                {{ NOMBRE_METODO[total.metodo] }}
              </dt>
              <dd class="text-xl font-semibold tabular-nums">
                {{ formatearBs(total.centavos) }}
              </dd>
              <dd class="text-muted-foreground text-xs">
                {{ plural(total.cantidad, 'pago', 'pagos') }}
              </dd>
            </div>
          </dl>

          <p v-if="data.totales.anulados > 0" class="text-muted-foreground text-sm">
            {{ plural(data.totales.anulados, 'pago anulado', 'pagos anulados') }} en este
            período: {{ data.totales.anulados === 1 ? 'no suma' : 'no suman' }} en el
            total.
          </p>
        </section>

        <TablaPagos v-if="data.pagos.length > 0" :pagos="data.pagos" mostrar-cliente />

        <div
          v-else
          class="flex flex-col items-center gap-3 rounded-lg border px-4 py-16 text-center"
        >
          <p class="text-sm font-medium">No hay pagos {{ periodo }}</p>
          <p class="text-muted-foreground max-w-prose text-sm">
            Los pagos aparecen acá cuando se vende una membresía o un pase por sesión.
          </p>
          <Button
            v-if="hayFiltros"
            variant="outline"
            size="sm"
            @click="irA({ desde: '', hasta: '', metodo: undefined })"
          >
            Ver solo hoy
          </Button>
        </div>
      </div>
    </template>

    <div v-else-if="mostrarEsqueleto" class="space-y-5" aria-hidden="true">
      <Skeleton class="h-24 w-full" />
      <Skeleton class="h-64 w-full" />
    </div>
  </div>
</template>
