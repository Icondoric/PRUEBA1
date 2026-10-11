<script setup lang="ts">
/**
 * La tabla de pagos. La usan la pantalla de Pagos (con la columna del
 * cliente) y la ficha del cliente (sin ella).
 *
 * Anular abre el diálogo de confirmación, que vive acá para que las dos
 * pantallas se comporten igual.
 */
import { ref } from 'vue';
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

defineProps<{ pagos: PagoVista[]; mostrarCliente?: boolean }>();

const { puede } = useAccesos();

const porAnular = ref<PagoVista | null>(null);
</script>

<template>
  <div class="rounded-lg border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="w-28">Fecha</TableHead>
          <TableHead v-if="mostrarCliente">Cliente</TableHead>
          <TableHead>Concepto</TableHead>
          <TableHead class="w-32">Método</TableHead>
          <TableHead class="w-32 text-right">Monto</TableHead>
          <TableHead class="w-64">Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="pago in pagos" :key="pago.id" class="h-11">
          <TableCell class="tabular-nums">{{ formatearFecha(pago.fechaPago) }}</TableCell>
          <TableCell v-if="mostrarCliente" class="font-medium">
            <RouterLink
              :to="{ name: 'cliente-ficha', params: { id: pago.clienteId } }"
              class="focus-visible:ring-ring/50 rounded-sm outline-none hover:underline focus-visible:ring-3"
            >
              {{ pago.clienteNombreCompleto }}
            </RouterLink>
            <span class="text-muted-foreground font-normal tabular-nums">
              · nº {{ pago.nroSocio }}
            </span>
          </TableCell>
          <TableCell>
            {{ pago.planNombre ?? 'Cobro suelto' }}
            <span v-if="pago.nota" class="text-muted-foreground">· {{ pago.nota }}</span>
          </TableCell>
          <TableCell>{{ NOMBRE_METODO[pago.metodo] }}</TableCell>
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
              variant="ghost"
              size="sm"
              @click="porAnular = pago"
            >
              Anular pago
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>

  <AnularPagoDialog v-if="porAnular" :pago="porAnular" @cerrar="porAnular = null" />
</template>
