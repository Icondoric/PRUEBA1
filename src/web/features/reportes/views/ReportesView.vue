<script setup lang="ts">
/**
 * Reportes del dueño. SOLO PARA EL ROL ADMIN (se restringe con el login).
 *
 * Pensada primero para el celular: una columna, números grandes y listas en
 * vez de tablas anchas. Todas las cuentas vienen hechas del servidor; acá solo
 * se muestran y se exportan.
 *
 * Las barras son un refuerzo: el número está siempre escrito al lado.
 */
import { Ban, Banknote, Download, LogIn, Users } from '@lucide/vue';
import { refDebounced } from '@vueuse/core';
import { computed } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { NOMBRE_METODO } from '@/web/features/pagos/lib/metodos';
import ErrorDeCarga from '@/web/shared/components/ErrorDeCarga.vue';
import { type CeldaCsv, descargarCsv, montoParaCsv } from '@/web/shared/lib/csv';
import {
  formatearBs,
  formatearDiaMes,
  formatearFecha,
  formatearMes,
  plural,
} from '@/web/shared/lib/formato';
import { Badge } from '@/web/shared/ui/badge';
import { Button } from '@/web/shared/ui/button';
import { Label } from '@/web/shared/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/web/shared/ui/select';
import { Skeleton } from '@/web/shared/ui/skeleton';
import { useReporte } from '../api/reportes.api';
import BarraDeDato from '../components/BarraDeDato.vue';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const route = useRoute();
const router = useRouter();

const mesPedido = computed(() =>
  typeof route.query.mes === 'string' ? route.query.mes : '',
);

const { data, error, isPending, isFetching, isPlaceholderData, refetch } =
  useReporte(mesPedido);

const tardando = refDebounced(isPending, 150);
const mostrarEsqueleto = computed(() => isPending.value && tardando.value);

function elegirMes(mes: unknown) {
  const esElActual = mes === data.value?.meses.at(-1);
  void router.replace({ query: { mes: esElActual ? undefined : String(mes) } });
}

/** Las cuatro cajas de "Hoy". Los números vienen hechos del servidor. */
const hoy = computed(() => {
  const numeros = data.value?.hoyEnNumeros;
  if (!numeros) return [];
  return [
    {
      nombre: 'Socios activos',
      valor: String(numeros.sociosActivos),
      pie: 'Sin contar pases por sesión',
      icono: Users,
    },
    {
      nombre: 'Cobrado',
      valor: formatearBs(numeros.cobradoCentavos),
      pie: null,
      icono: Banknote,
    },
    { nombre: 'Entraron', valor: String(numeros.ingresos), pie: null, icono: LogIn },
    {
      nombre: 'Rebotaron',
      valor: String(numeros.rechazados),
      pie: 'Vencidos o sin membresía',
      icono: Ban,
    },
  ];
});

const maximo = (valores: number[]) => Math.max(0, ...valores);

const maxCobrado = computed(() =>
  maximo(data.value?.cobradoPorMes.map((m) => m.totalCentavos) ?? []),
);
const maxIngresos = computed(() =>
  maximo(data.value?.ingresosPorDia.map((d) => d.permitidos) ?? []),
);
const maxNuevos = computed(() =>
  maximo(data.value?.sociosNuevosPorMes.map((m) => m.cantidad) ?? []),
);
const maxPases = computed(() =>
  maximo(data.value?.pases.porMes.map((m) => m.cantidad) ?? []),
);

const totalIngresosDelMes = computed(() => ({
  permitidos:
    data.value?.ingresosPorDia.reduce((total, d) => total + d.permitidos, 0) ?? 0,
  rechazados:
    data.value?.ingresosPorDia.reduce((total, d) => total + d.rechazados, 0) ?? 0,
}));

/** Promedio con un decimal, como texto: '12,5'. Sin decimales sueltos. */
const asistencia = computed(() =>
  (data.value?.asistencia.porDiaDeSemana ?? []).map((d) => {
    const decimas = d.ocurrencias > 0 ? Math.round((d.ingresos * 10) / d.ocurrencias) : 0;
    return {
      nombre: DIAS[d.dia] ?? '',
      decimas,
      texto: `${Math.trunc(decimas / 10)},${decimas % 10}`,
    };
  }),
);
const maxAsistencia = computed(() => maximo(asistencia.value.map((d) => d.decimas)));

function exportar(nombre: string, encabezados: string[], filas: CeldaCsv[][]) {
  descargarCsv(`${nombre}_${data.value?.hoy ?? ''}`, encabezados, filas);
}

function exportarSocios(
  nombre: string,
  lista: NonNullable<typeof data.value>['porVencer']['socios'],
  columnaDias: string,
) {
  exportar(
    nombre,
    ['Nº socio', 'Nombre', 'Teléfono', 'Plan', 'Vencimiento', columnaDias],
    lista.map((s) => [
      s.nroSocio,
      s.nombreCompleto,
      s.telefono,
      s.planNombre,
      s.fechaFin,
      s.dias,
    ]),
  );
}

function exportarCobrado() {
  if (!data.value) return;
  exportar(
    'cobrado-por-mes',
    ['Mes', 'Total', 'Efectivo', 'QR', 'Transferencia', 'Tarjeta', 'Pagos', 'Anulados'],
    data.value.cobradoPorMes.map((m) => [
      m.mes,
      montoParaCsv(m.totalCentavos),
      ...m.porMetodo.map((t) => montoParaCsv(t.centavos)),
      m.cantidad,
      m.anulados,
    ]),
  );
}

function exportarIngresos() {
  if (!data.value) return;
  exportar(
    `ingresos-${data.value.mes}`,
    ['Fecha', 'Entraron', 'Rebotaron'],
    data.value.ingresosPorDia.map((d) => [d.fecha, d.permitidos, d.rechazados]),
  );
}

function exportarAsistencia() {
  exportar(
    'asistencia-por-dia',
    ['Día', 'Promedio de ingresos'],
    asistencia.value.map((d) => [d.nombre, d.texto]),
  );
}

function exportarNuevos() {
  if (!data.value) return;
  exportar(
    'socios-nuevos',
    ['Mes', 'Socios nuevos'],
    data.value.sociosNuevosPorMes.map((m) => [m.mes, m.cantidad]),
  );
}

function exportarPases() {
  if (!data.value) return;
  exportar(
    'pases-frecuentes',
    ['Nº socio', 'Nombre', 'Teléfono', 'Pases', 'Último pase', 'Ya es socio'],
    data.value.pases.frecuentes.map((c) => [
      c.nroSocio,
      c.nombreCompleto,
      c.telefono,
      c.cantidad,
      c.ultimoPase,
      c.yaEsSocio ? 'Sí' : 'No',
    ]),
  );
}
</script>

<template>
  <div class="max-w-4xl space-y-10">
    <div class="space-y-1">
      <h1 tabindex="-1" class="titulo-pantalla">Reportes</h1>
      <p v-if="data" class="text-muted-foreground text-sm">
        Datos al {{ formatearFecha(data.hoy) }}
      </p>
    </div>

    <ErrorDeCarga
      v-if="error && !data"
      titulo="No se pudieron cargar los reportes"
      :mensaje="error.message"
      :reintentando="isFetching"
      @reintentar="refetch()"
    />

    <div
      v-else-if="data"
      class="space-y-10 transition-opacity duration-150"
      :class="{ 'opacity-60': isPlaceholderData }"
      :aria-busy="isFetching"
    >
      <!-- Hoy -->
      <section aria-labelledby="r-hoy" class="space-y-3">
        <h2 id="r-hoy" class="titulo-seccion">Hoy</h2>
        <dl class="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div
            v-for="caja in hoy"
            :key="caja.nombre"
            class="bg-card text-card-foreground space-y-3 rounded-xl border p-4"
          >
            <div class="flex items-center justify-between gap-2">
              <dt class="text-muted-foreground text-sm font-medium">{{ caja.nombre }}</dt>
              <span
                class="bg-accent text-accent-foreground flex size-8 shrink-0 items-center justify-center rounded-md"
                aria-hidden="true"
              >
                <component :is="caja.icono" class="size-4" />
              </span>
            </div>
            <dd class="cifra">{{ caja.valor }}</dd>
            <dd v-if="caja.pie" class="text-muted-foreground text-xs">{{ caja.pie }}</dd>
          </div>
        </dl>
      </section>

      <!-- Por vencer -->
      <section aria-labelledby="r-por-vencer" class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 id="r-por-vencer" class="titulo-seccion">
            Vencen en los próximos {{ data.porVencer.dias }} días
            <span class="text-muted-foreground font-normal tabular-nums">
              ({{ data.porVencer.socios.length }})
            </span>
          </h2>
          <Button
            v-if="data.porVencer.socios.length > 0"
            variant="outline"
            size="sm"
            @click="
              exportarSocios('por-vencer', data.porVencer.socios, 'Días que faltan')
            "
          >
            <Download aria-hidden="true" />
            Exportar a CSV
          </Button>
        </div>

        <ul
          v-if="data.porVencer.socios.length > 0"
          class="bg-card divide-y rounded-xl border"
        >
          <li
            v-for="socio in data.porVencer.socios"
            :key="socio.clienteId"
            class="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div class="min-w-0">
              <RouterLink
                :to="{ name: 'cliente-ficha', params: { id: socio.clienteId } }"
                class="focus-visible:ring-ring block truncate rounded-sm text-sm font-medium outline-none hover:underline focus-visible:ring-3"
              >
                {{ socio.nombreCompleto }}
              </RouterLink>
              <p class="text-muted-foreground text-xs tabular-nums">
                nº {{ socio.nroSocio }} · {{ socio.planNombre }}
                <template v-if="socio.telefono">
                  ·
                  <a
                    :href="`tel:${socio.telefono}`"
                    class="underline underline-offset-2"
                    >{{ socio.telefono }}</a
                  >
                </template>
              </p>
            </div>
            <div class="shrink-0 text-right">
              <p class="text-sm font-medium tabular-nums">
                {{ socio.dias === 0 ? 'Hoy' : `En ${plural(socio.dias, 'día', 'días')}` }}
              </p>
              <p class="text-muted-foreground text-xs tabular-nums">
                {{ formatearFecha(socio.fechaFin) }}
              </p>
            </div>
          </li>
        </ul>
        <p v-else class="text-muted-foreground text-sm">
          Nadie vence en los próximos {{ data.porVencer.dias }} días.
        </p>
      </section>

      <!-- Vencidos -->
      <section aria-labelledby="r-vencidos" class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 id="r-vencidos" class="titulo-seccion">
            Vencidos en los últimos {{ data.vencidos.dias }} días
            <span class="text-muted-foreground font-normal tabular-nums">
              ({{ data.vencidos.recientes.length }})
            </span>
          </h2>
          <Button
            v-if="data.vencidos.recientes.length > 0"
            variant="outline"
            size="sm"
            @click="
              exportarSocios('vencidos', data.vencidos.recientes, 'Días de vencido')
            "
          >
            <Download aria-hidden="true" />
            Exportar a CSV
          </Button>
        </div>

        <ul
          v-if="data.vencidos.recientes.length > 0"
          class="bg-card divide-y rounded-xl border"
        >
          <li
            v-for="socio in data.vencidos.recientes"
            :key="socio.clienteId"
            class="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div class="min-w-0">
              <RouterLink
                :to="{ name: 'cliente-ficha', params: { id: socio.clienteId } }"
                class="focus-visible:ring-ring block truncate rounded-sm text-sm font-medium outline-none hover:underline focus-visible:ring-3"
              >
                {{ socio.nombreCompleto }}
              </RouterLink>
              <p class="text-muted-foreground text-xs tabular-nums">
                nº {{ socio.nroSocio }} · {{ socio.planNombre }}
                <template v-if="socio.telefono">
                  ·
                  <a
                    :href="`tel:${socio.telefono}`"
                    class="underline underline-offset-2"
                    >{{ socio.telefono }}</a
                  >
                </template>
              </p>
            </div>
            <div class="shrink-0 text-right">
              <p class="text-sm font-medium tabular-nums">
                Hace {{ plural(socio.dias, 'día', 'días') }}
              </p>
              <p class="text-muted-foreground text-xs tabular-nums">
                {{ formatearFecha(socio.fechaFin) }}
              </p>
            </div>
          </li>
        </ul>
        <p v-else class="text-muted-foreground text-sm">
          Nadie venció en los últimos {{ data.vencidos.dias }} días.
        </p>

        <p v-if="data.vencidos.antiguos > 0" class="text-muted-foreground text-sm">
          Además,
          {{
            plural(
              data.vencidos.antiguos,
              'socio venció hace más tiempo',
              'socios vencieron hace más tiempo',
            )
          }}
          y no volvió a renovar.
        </p>
      </section>

      <!-- Cobrado por mes -->
      <section aria-labelledby="r-cobrado" class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 id="r-cobrado" class="titulo-seccion">Cobrado por mes</h2>
          <Button variant="outline" size="sm" @click="exportarCobrado">
            <Download aria-hidden="true" />
            Exportar a CSV
          </Button>
        </div>

        <ul class="bg-card divide-y rounded-xl border">
          <li
            v-for="mes in data.cobradoPorMes"
            :key="mes.mes"
            class="space-y-2 px-4 py-3"
          >
            <div class="flex items-baseline justify-between gap-3">
              <p class="text-sm font-medium capitalize">{{ formatearMes(mes.mes) }}</p>
              <p class="text-sm font-semibold tabular-nums">
                {{ formatearBs(mes.totalCentavos) }}
              </p>
            </div>
            <BarraDeDato :valor="mes.totalCentavos" :maximo="maxCobrado" />
            <p class="text-muted-foreground text-xs tabular-nums">
              <template v-for="(total, indice) in mes.porMetodo" :key="total.metodo">
                <template v-if="indice > 0"> · </template>
                {{ NOMBRE_METODO[total.metodo] }} {{ formatearBs(total.centavos) }}
              </template>
            </p>
          </li>
        </ul>
      </section>

      <!-- Ingresos por día -->
      <section aria-labelledby="r-ingresos" class="space-y-3">
        <div class="flex flex-wrap items-end justify-between gap-2">
          <h2 id="r-ingresos" class="titulo-seccion">Ingresos por día</h2>
          <div class="flex flex-wrap items-end gap-2">
            <div class="space-y-1.5">
              <Label for="r-mes">Mes</Label>
              <Select :model-value="data.mes" @update:model-value="elegirMes">
                <SelectTrigger id="r-mes" class="w-44 capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="mes in [...data.meses].reverse()"
                    :key="mes"
                    :value="mes"
                    class="capitalize"
                  >
                    {{ formatearMes(mes) }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" @click="exportarIngresos">
              <Download aria-hidden="true" />
              Exportar a CSV
            </Button>
          </div>
        </div>

        <p class="text-muted-foreground text-sm tabular-nums">
          En {{ formatearMes(data.mes) }}: {{ totalIngresosDelMes.permitidos }} entraron ·
          {{ totalIngresosDelMes.rechazados }} rebotaron
        </p>

        <ul class="bg-card rounded-xl border px-4 py-2">
          <li
            v-for="dia in data.ingresosPorDia"
            :key="dia.fecha"
            class="grid grid-cols-[3rem_1fr_auto] items-center gap-3 py-1"
          >
            <span class="text-muted-foreground text-xs tabular-nums">
              {{ formatearDiaMes(dia.fecha) }}
            </span>
            <BarraDeDato :valor="dia.permitidos" :maximo="maxIngresos" />
            <span class="text-right text-sm tabular-nums">
              {{ dia.permitidos }}
              <span v-if="dia.rechazados > 0" class="text-muted-foreground text-xs">
                · {{ dia.rechazados }} reb.
              </span>
            </span>
          </li>
        </ul>
      </section>

      <!-- Asistencia -->
      <section aria-labelledby="r-asistencia" class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 id="r-asistencia" class="titulo-seccion">
            Asistencia por día de la semana
          </h2>
          <Button variant="outline" size="sm" @click="exportarAsistencia">
            <Download aria-hidden="true" />
            Exportar a CSV
          </Button>
        </div>
        <p class="text-muted-foreground text-sm">
          Promedio de personas que entran, en las últimas 8 semanas.
        </p>

        <ul class="bg-card rounded-xl border px-4 py-2">
          <li
            v-for="dia in asistencia"
            :key="dia.nombre"
            class="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-3 py-1.5"
          >
            <span class="text-sm">{{ dia.nombre }}</span>
            <BarraDeDato :valor="dia.decimas" :maximo="maxAsistencia" />
            <span class="text-right text-sm tabular-nums">{{ dia.texto }}</span>
          </li>
        </ul>
      </section>

      <!-- Socios nuevos -->
      <section aria-labelledby="r-nuevos" class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 id="r-nuevos" class="titulo-seccion">Socios nuevos</h2>
          <Button variant="outline" size="sm" @click="exportarNuevos">
            <Download aria-hidden="true" />
            Exportar a CSV
          </Button>
        </div>
        <p class="text-muted-foreground text-sm">
          Personas que compraron su primer plan. Quien solo compra pases no cuenta.
        </p>

        <ul class="bg-card rounded-xl border px-4 py-2">
          <li
            v-for="mes in data.sociosNuevosPorMes"
            :key="mes.mes"
            class="grid grid-cols-[8rem_1fr_2rem] items-center gap-3 py-1.5"
          >
            <span class="text-sm capitalize">{{ formatearMes(mes.mes) }}</span>
            <BarraDeDato :valor="mes.cantidad" :maximo="maxNuevos" />
            <span class="text-right text-sm tabular-nums">{{ mes.cantidad }}</span>
          </li>
        </ul>
      </section>

      <!-- Pases -->
      <section aria-labelledby="r-pases" class="space-y-3">
        <h2 id="r-pases" class="titulo-seccion">Pases por sesión vendidos</h2>

        <ul class="bg-card rounded-xl border px-4 py-2">
          <li
            v-for="mes in data.pases.porMes"
            :key="mes.mes"
            class="grid grid-cols-[8rem_1fr_2rem] items-center gap-3 py-1.5"
          >
            <span class="text-sm capitalize">{{ formatearMes(mes.mes) }}</span>
            <BarraDeDato :valor="mes.cantidad" :maximo="maxPases" tenue />
            <span class="text-right text-sm tabular-nums">{{ mes.cantidad }}</span>
          </li>
        </ul>

        <div class="flex flex-wrap items-center justify-between gap-2 pt-2">
          <h3 class="text-base font-semibold tracking-tight">
            Vinieron más de 3 veces con pase
            <span class="text-muted-foreground font-normal tabular-nums">
              ({{ data.pases.frecuentes.length }})
            </span>
          </h3>
          <Button
            v-if="data.pases.frecuentes.length > 0"
            variant="outline"
            size="sm"
            @click="exportarPases"
          >
            <Download aria-hidden="true" />
            Exportar a CSV
          </Button>
        </div>
        <p class="text-muted-foreground text-sm">
          En los últimos {{ data.pases.dias }} días. Son a quienes conviene ofrecerles un
          plan.
        </p>

        <ul
          v-if="data.pases.frecuentes.length > 0"
          class="bg-card divide-y rounded-xl border"
        >
          <li
            v-for="cliente in data.pases.frecuentes"
            :key="cliente.clienteId"
            class="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div class="min-w-0">
              <RouterLink
                :to="{ name: 'cliente-ficha', params: { id: cliente.clienteId } }"
                class="focus-visible:ring-ring block truncate rounded-sm text-sm font-medium outline-none hover:underline focus-visible:ring-3"
              >
                {{ cliente.nombreCompleto }}
              </RouterLink>
              <p class="text-muted-foreground text-xs tabular-nums">
                nº {{ cliente.nroSocio }} · último pase
                {{ formatearFecha(cliente.ultimoPase) }}
                <template v-if="cliente.telefono">
                  ·
                  <a
                    :href="`tel:${cliente.telefono}`"
                    class="underline underline-offset-2"
                    >{{ cliente.telefono }}</a
                  >
                </template>
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <Badge v-if="cliente.yaEsSocio" variant="secondary">Ya es socio</Badge>
              <p class="text-sm font-medium tabular-nums">
                {{ plural(cliente.cantidad, 'pase', 'pases') }}
              </p>
            </div>
          </li>
        </ul>
        <p v-else class="text-muted-foreground text-sm">
          Nadie vino más de 3 veces con pase en ese período.
        </p>
      </section>
    </div>

    <div v-else-if="mostrarEsqueleto" class="space-y-6" aria-hidden="true">
      <Skeleton class="h-32 w-full rounded-xl" />
      <Skeleton class="h-64 w-full" />
      <Skeleton class="h-64 w-full" />
    </div>
  </div>
</template>
