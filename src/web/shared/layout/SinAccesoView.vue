<script setup lang="ts">
/**
 * Cuando alguien entra a una pantalla para la que no tiene acceso (o no tiene
 * ninguno). Dice qué pasa y a quién pedírselo.
 */
import { useAccesos } from '@/web/features/sesion/api/sesion.api';

const { usuario } = useAccesos();
</script>

<template>
  <div class="max-w-prose space-y-4">
    <h1 tabindex="-1" class="titulo-pantalla">No tenés acceso a esta parte</h1>
    <p class="text-muted-foreground text-sm">
      Tu usuario<template v-if="usuario"> ({{ usuario.usuario }})</template> no tiene
      permiso para ver esta pantalla. Los accesos los da el dueño desde "Usuarios": pedile
      que te habilite lo que necesitás.
    </p>
    <p class="text-muted-foreground text-sm">
      Mientras tanto, usá las secciones que sí aparecen en el menú.
    </p>
  </div>
</template>
