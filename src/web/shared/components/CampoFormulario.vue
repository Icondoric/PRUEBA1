<script setup lang="ts">
/**
 * Un campo de formulario: etiqueta real, control, ayuda y error.
 *
 * El control lo pone quien lo usa; este componente le pasa por el slot el `id`
 * y los atributos ARIA para que el mensaje de error quede asociado al campo y
 * no flotando al lado.
 */
import { computed } from 'vue';
import { Label } from '@/web/shared/ui/label';

const props = defineProps<{
  id: string;
  etiqueta: string;
  error?: string;
  ayuda?: string;
  opcional?: boolean;
}>();

const idError = computed(() => `${props.id}-error`);
const idAyuda = computed(() => `${props.id}-ayuda`);

const control = computed(() => ({
  id: props.id,
  'aria-invalid': props.error ? ('true' as const) : undefined,
  'aria-describedby':
    [props.error ? idError.value : null, props.ayuda ? idAyuda.value : null]
      .filter(Boolean)
      .join(' ') || undefined,
}));
</script>

<template>
  <div class="space-y-1.5">
    <Label :for="id">
      {{ etiqueta }}
      <span v-if="opcional" class="text-muted-foreground font-normal">(opcional)</span>
    </Label>

    <slot :control="control" />

    <p v-if="ayuda && !error" :id="idAyuda" class="text-muted-foreground text-xs">
      {{ ayuda }}
    </p>
    <p v-if="error" :id="idError" class="text-destructive text-sm">{{ error }}</p>
  </div>
</template>
