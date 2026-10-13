<script setup lang="ts">
/**
 * La tabla de pagos. La usan la pantalla de Pagos (con la columna del
 * cliente) y la ficha del cliente (sin ella).
 *
 * Anular abre el diálogo de confirmación, que vive acá para que las dos
 * pantallas se comporten igual.
 */
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useAccesos } from '@/web/features/sesion/api/sesion.api';
import { formatearBs, formatearFecha } from '@/web/shared/lib/formato';
import { Badge } from '@/web/shared/ui/badge';
import { Button } from '@/web/shared/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/web/shared/ui/table';
import type { PagoVista } from '../api/pagos.api';
import { NOMBRE_METODO } from '../lib/metodos';
import AnularPagoDialog from './AnularPagoDialog.vue';

const props = defineProps<{ pagos: PagoVista[]; mostrarCliente?: boolean }>();

const { puede } = useAccesos();

const porAnular = ref<PagoVista | null>(null);

// Con la columna del cliente la tabla necesita más ancho, así que las
// columnas de detalle aparecen más tarde. Lo que no entra como columna va
// en una segunda línea, debajo del cliente o del concepto.
const clases = computed(() =>
  props.mostrarCliente
    ? {
        columna: 'hidden xl:table-cell',
        linea: 'xl:hidden',
        estado: 'w-28 xl:w-64',
        boton: 'sr-only xl:not-sr-only',
      }
    : {
        columna: 'hidden md:table-cell',
        linea: 'md:hidden',
        estado: 'w-28 md:w-64',
        boton: 'sr-only md:not-sr-only',
      },
);
</script>

<template>
  <div class="bg-card overflow-hidden rounded-xl border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="w-28" :class="clases.columna">Fecha</TableHead>
          <TableHead v-if="mostrarCliente">Cliente</TableHead>
          <TableHead :class="mostrarCliente ? clases.columna : ''">Concepto</TableHead>
          <TableHead class="w-32" :class="clases.columna">Método</TableHead>
          <TableHead class="w-24 text-right lg:w-32">Monto</TableHead>
          <TableHead :class="clases.estado">Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="pago in pagos" :key="pago.id" class="h-11">
          <TableCell class="tabular-nums" :class="clases.columna">
            {{ formatearFecha(pago.fechaPago) }}
          </TableCell>
          <TableCell v-if="mostrarCliente" class="font-medium whitespace-normal">
            <RouterLink
              :to="{ name: 'cliente-ficha', params: { id: pago.clienteId } }"
              class="focus-visible:ring-ring rounded-sm outline-none hover:underline focus-visible:ring-3"
            >
              {{ pago.clienteNombreCompleto }}
            </RouterLink>
            <span class="text-muted-foreground font-normal tabular-nums">
              · nº {{ pago.nroSocio }}
            </span>
            <!-- En angosto: fecha, concepto y método van acá, no en tres columnas. -->
            <span
              class="text-muted-foreground block text-xs font-normal tabular-nums"
              :class="clases.linea"
            >
              {{ formatearFecha(pago.fechaPago) }} ·
              {{ pago.planNombre ?? 'Cobro suelto' }} ·
              {{ NOMBRE_METODO[pago.metodo] }}
            </span>
          </TableCell>
          <TableCell :class="mostrarCliente ? clases.columna : 'whitespace-normal'">
            {{ pago.planNombre ?? 'Cobro suelto' }}
            <span v-if="pago.nota" class="text-muted-foreground">· {{ pago.nota }}</span>
            <span
              v-if="!mostrarCliente"
              class="text-muted-foreground block text-xs tabular-nums"
              :class="clases.linea"
            >
              {{ formatearFecha(pago.fechaPago) }} · {{ NOMBRE_METODO[pago.metodo] }}
            </span>
          </TableCell>
          <TableCell :class="clases.columna">{{ NOMBRE_METODO[pago.metodo] }}</TableCell>
          <TableCell
            class="text-right tabular-nums"
            :class="{ 'text-muted-foreground line-through': pago.anulado }"
          >
            {{ formatearBs(pago.montoCentavos, { conCentavos: true }) }}
          </TableCell>
          <TableCell class="whitespace-normal">
            <template v-if="pago.anulado">
              <Badge variant="destructive">Anulado</Badge>
              <p class="text-muted-foreground mt-1 text-xs">
                {{ pago.motivoAnulacion }}
                <template v-if="pago.anuladoPorNombre">
                  · anulado por {{ pago.anuladoPorNombre }}
                </template>
              </p>
            </template>
            <Button
              v-else-if="puede('pagos.anular')"
              variant="outline"
              size="sm"
              @click="porAnular = pago"
            >
              <span>Anular<span :class="clases.boton"> pago</span></span>
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>

  <AnularPagoDialog v-if="porAnular" :pago="porAnular" @cerrar="porAnular = null" />
</template>
