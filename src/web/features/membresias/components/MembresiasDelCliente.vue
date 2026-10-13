<script setup lang="ts">
/**
 * La sección "Membresía" de la ficha: en qué situación está el cliente hoy,
 * el botón para venderle o renovarle, y su historial.
 *
 * Qué está vigente o vencido lo calcula el servidor; acá solo se redacta.
 */
import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Clock,
  TriangleAlert,
} from '@lucide/vue';
import { refDebounced } from '@vueuse/core';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import type { EstadoMembresia } from '@/modules/membresias';
import { useAccesos } from '@/web/features/sesion/api/sesion.api';
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

const { puede } = useAccesos();

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
      if (c.porVencer) {
        return {
          urgente: true,
          icono: TriangleAlert,
          titulo: c.dias === 0 ? 'Vence hoy' : `Vence el ${formatearFecha(c.hasta)}`,
          detalle:
            c.dias === 0
              ? 'Hoy es el último día. Conviene ofrecerle renovar.'
              : c.dias === 1
                ? 'Le queda 1 día. Conviene ofrecerle renovar.'
                : `Le quedan ${dias(c.dias ?? 0)}. Conviene ofrecerle renovar.`,
        };
      }
      return {
        icono: CircleCheck,
        titulo: `Vigente hasta el ${formatearFecha(c.hasta)}`,
        detalle:
          c.dias === 0
            ? 'Hoy es el último día.'
            : c.dias === 1
              ? 'Le queda 1 día.'
              : `Le quedan ${dias(c.dias ?? 0)}.`,
      };
    case 'vencida':
      return {
        urgente: true,
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
    <h2 id="titulo-membresia" class="titulo-seccion">Membresía</h2>

    <ErrorDeCarga
      v-if="error && !data"
      titulo="No se pudo cargar la membresía"
      :mensaje="error.message"
      :reintentando="isFetching"
      @reintentar="refetch()"
    />

    <template v-else-if="data && resumen">
      <!-- Lo urgente (vencida o por vencer) se marca con borde más fuerte, ícono
           y título en negrita: no depende del color. -->
      <div
        class="bg-card flex flex-wrap items-center justify-between gap-4 rounded-xl border p-5"
        :class="'urgente' in resumen ? 'border-foreground/40 border-2' : ''"
      >
        <div class="flex items-start gap-3">
          <component
            :is="resumen.icono"
            class="mt-0.5 size-5 shrink-0"
            :class="'urgente' in resumen ? 'text-foreground' : 'text-muted-foreground'"
            aria-hidden="true"
          />
          <div class="space-y-1">
            <p
              :class="
                'urgente' in resumen ? 'text-base font-semibold' : 'text-sm font-medium'
              "
            >
              {{ resumen.titulo }}
            </p>
            <p class="text-muted-foreground text-sm">{{ resumen.detalle }}</p>
          </div>
        </div>
        <Button v-if="puede('membresias.vender')" as-child>
          <RouterLink :to="{ name: 'membresia-nueva', params: { id: clienteId } }">
            {{
              data.cobertura.situacion === 'sin_membresia'
                ? 'Vender membresía'
                : 'Renovar membresía'
            }}
          </RouterLink>
        </Button>
      </div>

      <div
        v-if="data.membresias.length > 0"
        class="bg-card overflow-hidden rounded-xl border"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan</TableHead>
              <TableHead class="hidden w-32 sm:table-cell">Desde</TableHead>
              <TableHead class="hidden w-32 sm:table-cell">Hasta</TableHead>
              <TableHead class="w-24 text-right sm:w-32">Precio</TableHead>
              <TableHead class="w-32 sm:w-44">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="m in data.membresias" :key="m.id" class="h-11">
              <TableCell class="font-medium whitespace-normal">
                {{ m.planNombre }}
                <span v-if="m.etiquetaPrecio" class="text-muted-foreground font-normal">
                  · {{ m.etiquetaPrecio }}
                </span>
                <!-- En angosto las fechas van acá, en vez de en dos columnas más. -->
                <span
                  class="text-muted-foreground block text-xs font-normal tabular-nums sm:hidden"
                >
                  {{ formatearFecha(m.fechaInicio) }} al {{ formatearFecha(m.fechaFin) }}
                </span>
              </TableCell>
              <TableCell class="hidden tabular-nums sm:table-cell">
                {{ formatearFecha(m.fechaInicio) }}
              </TableCell>
              <TableCell class="hidden tabular-nums sm:table-cell">
                {{ formatearFecha(m.fechaFin) }}
              </TableCell>
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
