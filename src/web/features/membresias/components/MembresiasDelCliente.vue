<script setup lang="ts">
/**
 * La sección "Membresía" de la ficha: en qué situación está el cliente hoy,
 * el botón para venderle o renovarle, y su historial.
 *
 * Qué está vigente o vencido lo calcula el servidor; acá solo se redacta.
 */
import { CircleAlert, CircleCheck, CircleDashed, Clock } from '@lucide/vue';
import { refDebounced } from '@vueuse/core';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import type { EstadoMembresia } from '@/modules/membresias';
import ErrorDeCarga from '@/web/shared/components/ErrorDeCarga.vue';
import { formatearBs, formatearFecha, plural } from '@/web/shared/lib/formato';
import { Badge } from '@/web/shared/ui/badge';
import { Button } from '@/web/shared/ui/button';
import { Skeleton } from '@/web/shared/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/web/shared/ui/table';
import { useHistorialMembresias } from '../api/membresias.api';

const props = defineProps<{ clienteId: number }>();

const { data, error, isPending, isFetching, refetch } = useHistorialMembresias(
  () => props.clienteId,
);

const tardando = refDebounced(isPending, 150);
const mostrarEsqueleto = computed(() => isPending.value && tardando.value);

const dias = (n: number) => plural(Math.abs(n), 'día', 'días');

const resumen = computed(() => {
  const c = data.value?.cobertura;
  if (!c) return null;

  switch (c.situacion) {
    case 'sin_membresia':
      return {
        icono: CircleDashed,
        titulo: 'Sin membresía',
        detalle: 'Todavía no compró ningún plan ni pase.',
      };
    case 'vigente':
      if (c.esPaseDiario) {
        return {
          icono: CircleCheck,
          titulo: 'Pase por sesión, válido hoy',
          detalle: 'No tiene una mensualidad vigente.',
        };
      }
      return {
        icono: CircleCheck,
        titulo: `Vigente hasta el ${formatearFecha(c.hasta)}`,
        detalle:
          c.dias === 0 ? 'Hoy es el último día.' : `Le quedan ${dias(c.dias ?? 0)}.`,
      };
    case 'vencida':
      return {
        icono: CircleAlert,
        titulo: `Venció el ${formatearFecha(c.hasta)}`,
        detalle: `Hace ${dias(c.dias ?? 0)}.`,
      };
    case 'futura':
      return {
        icono: Clock,
        titulo: `Empieza el ${formatearFecha(c.desde)}`,
        detalle: `Ya está paga, hasta el ${formatearFecha(c.hasta)}. Hoy todavía no está vigente.`,
      };
  }
  return null;
});

const ETIQUETAS: Record<EstadoMembresia, string> = {
  vigente: 'Vigente',
  vencida: 'Vencida',
  futura: 'Todavía no empieza',
  cancelada: 'Cancelada',
  congelada: 'Congelada',
};
</script>

<template>
  <section aria-labelledby="titulo-membresia" class="space-y-4">
    <h2 id="titulo-membresia" class="text-lg font-semibold tracking-tight">Membresía</h2>

    <ErrorDeCarga
      v-if="error && !data"
      titulo="No se pudo cargar la membresía"
      :mensaje="error.message"
      :reintentando="isFetching"
      @reintentar="refetch()"
    />

    <template v-else-if="data && resumen">
      <div
        class="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-5"
      >
        <div class="flex items-start gap-3">
          <component
            :is="resumen.icono"
            class="text-muted-foreground mt-0.5 size-5 shrink-0"
            aria-hidden="true"
          />
          <div class="space-y-1">
            <p class="text-sm font-medium">{{ resumen.titulo }}</p>
            <p class="text-muted-foreground text-sm">{{ resumen.detalle }}</p>
          </div>
        </div>
        <Button as-child>
          <RouterLink :to="{ name: 'membresia-nueva', params: { id: clienteId } }">
            {{
              data.cobertura.situacion === 'sin_membresia'
                ? 'Vender membresía'
                : 'Renovar membresía'
            }}
          </RouterLink>
        </Button>
      </div>

      <div v-if="data.membresias.length > 0" class="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan</TableHead>
              <TableHead class="w-32">Desde</TableHead>
              <TableHead class="w-32">Hasta</TableHead>
              <TableHead class="w-32 text-right">Precio</TableHead>
              <TableHead class="w-44">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="m in data.membresias" :key="m.id" class="h-11">
              <TableCell class="font-medium">
                {{ m.planNombre }}
                <span v-if="m.etiquetaPrecio" class="text-muted-foreground font-normal">
                  · {{ m.etiquetaPrecio }}
                </span>
              </TableCell>
              <TableCell class="tabular-nums">{{
                formatearFecha(m.fechaInicio)
              }}</TableCell>
              <TableCell class="tabular-nums">{{ formatearFecha(m.fechaFin) }}</TableCell>
              <TableCell class="text-right tabular-nums">
                {{ formatearBs(m.precioCentavos, { conCentavos: true }) }}
              </TableCell>
              <TableCell>
                <Badge :variant="m.estado === 'vigente' ? 'secondary' : 'outline'">
                  {{ ETIQUETAS[m.estado] }}
                </Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </template>

    <Skeleton v-else-if="mostrarEsqueleto" class="h-20 w-full" aria-hidden="true" />
  </section>
</template>
