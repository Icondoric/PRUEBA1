<script setup lang="ts">
/**
 * Un diálogo de confirmación simple: título, explicación y dos botones.
 *
 * Para acciones que conviene pensar un segundo (dar de baja, quitar un
 * precio). Los botones dicen lo que hacen; nunca "Sí" y "No".
 *
 * Es un `<dialog>` nativo: atrapa el foco, cierra con Esc y lo devuelve al
 * cerrarse.
 */
import { onMounted, ref } from 'vue';
import { Button } from '@/web/shared/ui/button';

defineProps<{
  titulo: string;
  /** Lo que dice el botón que confirma: verbo + objeto. */
  confirmar: string;
  /** Lo que dice el botón que cierra sin hacer nada. */
  cancelar?: string;
  destructivo?: boolean;
  /** La acción está en curso. */
  pendiente?: boolean;
  /** Si la acción falló, por qué. */
  error?: string;
}>();

const emit = defineEmits<{ confirmar: []; cerrar: [] }>();

const dialogo = ref<HTMLDialogElement | null>(null);

onMounted(() => {
  dialogo.value?.showModal();
});
</script>

<template>
  <dialog
    ref="dialogo"
    aria-labelledby="titulo-confirmacion"
    class="bg-background text-foreground m-auto w-full max-w-lg rounded-xl border p-6 backdrop:bg-black/50"
    @close="emit('cerrar')"
  >
    <div class="space-y-5">
      <div class="space-y-2">
        <h2 id="titulo-confirmacion" class="text-lg font-semibold tracking-tight">
          {{ titulo }}
        </h2>
        <div class="text-muted-foreground space-y-2 text-sm">
          <slot />
        </div>
      </div>

      <p v-if="error" role="alert" class="text-destructive text-sm">{{ error }}</p>

      <div class="flex justify-end gap-2">
        <Button type="button" variant="outline" autofocus @click="dialogo?.close()">
          {{ cancelar ?? 'Cancelar' }}
        </Button>
        <Button
          type="button"
          :variant="destructivo ? 'destructive' : 'default'"
          :disabled="pendiente"
          @click="emit('confirmar')"
        >
          {{ confirmar }}
        </Button>
      </div>
    </div>
  </dialog>
</template>
