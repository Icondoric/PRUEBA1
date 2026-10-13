<script setup lang="ts">
/**
 * Cómo está la membresía de un cliente, en una línea: para la lista y para
 * cualquier lugar donde haga falta saberlo de un vistazo.
 *
 * Qué está al día, por vencer o vencido lo decide el servidor; acá solo se
 * redacta. El color nunca va solo: cada situación tiene su ícono y su texto.
 * Fuera del check-in el ámbar es marca y no aviso, así que "por vencer" se
 * marca con ícono y negrita.
 */
import { CircleCheck, CircleDashed, CircleX, Clock, TriangleAlert } from '@lucide/vue';
import { computed } from 'vue';
import type { HistorialMembresias } from '@/modules/membresias';
import { formatearFecha, plural } from '@/web/shared/lib/formato';

const props = defineProps<{ cobertura: HistorialMembresias['cobertura'] }>();

const vista = computed(() => {
  const c = props.cobertura;
  const dias = Math.abs(c.dias ?? 0);

  switch (c.situacion) {
    case 'sin_membresia':
      return {
        icono: CircleDashed,
        color: 'text-muted-foreground',
        texto: 'Sin membresía',
        detalle: '',
        urgente: false,
      };
    case 'vigente':
      if (c.esPaseDiario) {
        return {
          icono: CircleCheck,
          color: 'text-estado-permitido',
          texto: 'Pase válido hoy',
          detalle: '',
          urgente: false,
        };
      }
      if (c.porVencer) {
        return {
          icono: TriangleAlert,
          color: 'text-foreground',
          texto:
            dias === 0
              ? 'Vence hoy'
              : dias === 1
                ? 'Vence mañana'
                : `Vence en ${dias} días`,
          detalle: '',
          urgente: true,
        };
      }
      return {
        icono: CircleCheck,
        color: 'text-estado-permitido',
        texto: 'Al día',
        detalle: `hasta el ${formatearFecha(c.hasta)}`,
        urgente: false,
      };
    case 'vencida':
      return {
        icono: CircleX,
        color: 'text-destructive',
        texto: 'Vencida',
        detalle: `hace ${plural(dias, 'día', 'días')}`,
        urgente: true,
      };
    case 'futura':
      return {
        icono: Clock,
        color: 'text-muted-foreground',
        texto: `Empieza el ${formatearFecha(c.desde)}`,
        detalle: '',
        urgente: false,
      };
  }
  return null;
});
</script>

<template>
  <span v-if="vista" class="inline-flex max-w-full min-w-0 items-center gap-1.5 text-sm">
    <component
      :is="vista.icono"
      class="size-4 shrink-0"
      :class="vista.color"
      aria-hidden="true"
    />
    <span class="truncate">
      <span :class="vista.urgente ? 'font-semibold' : ''">{{ vista.texto }}</span>
      <span v-if="vista.detalle" class="text-muted-foreground hidden sm:inline">
        · {{ vista.detalle }}
      </span>
    </span>
  </span>
</template>
