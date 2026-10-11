<script setup lang="ts">
/**
 * Las etiquetas de un cliente: socio o eventual, y bloqueado si corresponde.
 * Siempre con texto (y un ícono en el bloqueo): el color solo no alcanza para
 * quien no distingue rojo de gris.
 */
import { Ban } from '@lucide/vue';
import type { ClienteVista } from '@/modules/clientes';
import { Badge } from '@/web/shared/ui/badge';

defineProps<{ cliente: Pick<ClienteVista, 'tipo' | 'bloqueado'> }>();
</script>

<template>
  <span class="inline-flex flex-wrap items-center gap-1.5">
    <Badge :variant="cliente.tipo === 'socio' ? 'secondary' : 'outline'">
      {{ cliente.tipo === 'socio' ? 'Socio' : 'Eventual' }}
    </Badge>
    <Badge v-if="cliente.bloqueado" variant="destructive">
      <Ban aria-hidden="true" />
      Bloqueado
    </Badge>
  </span>
</template>
