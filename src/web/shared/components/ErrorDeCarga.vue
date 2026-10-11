<script setup lang="ts">
/**
 * El estado de error de una pantalla que no pudo cargar sus datos: qué pasó,
 * en palabras de recepción, y el botón para reintentar ahí mismo.
 */
import { TriangleAlert } from '@lucide/vue';
import { Button } from '@/web/shared/ui/button';

defineProps<{ titulo: string; mensaje: string; reintentando?: boolean }>();
defineEmits<{ reintentar: [] }>();
</script>

<template>
  <div role="alert" class="flex max-w-prose items-start gap-3 rounded-lg border p-4">
    <TriangleAlert class="text-destructive mt-0.5 size-5 shrink-0" aria-hidden="true" />
    <div class="space-y-3">
      <div class="space-y-1">
        <p class="text-sm font-medium">{{ titulo }}</p>
        <p class="text-muted-foreground text-sm">{{ mensaje }}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        :disabled="reintentando"
        @click="$emit('reintentar')"
      >
        {{ reintentando ? 'Reintentando…' : 'Reintentar' }}
      </Button>
    </div>
  </div>
</template>
