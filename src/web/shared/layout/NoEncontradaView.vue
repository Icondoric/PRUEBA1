<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { Button } from '@/web/shared/ui/button';
</script>

<template>
  <div class="max-w-prose space-y-4">
    <h1 tabindex="-1" class="titulo-pantalla">Página no encontrada</h1>
    <p class="text-muted-foreground text-sm">
      Esa dirección no existe en el sistema. Puede que el enlace esté mal escrito.
    </p>
    <Button as-child>
      <RouterLink :to="{ name: 'clientes' }">Ir a clientes</RouterLink>
    </Button>
  </div>
</template>
