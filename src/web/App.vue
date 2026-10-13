<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router';
import PilaDeAvisos from '@/web/shared/components/PilaDeAvisos.vue';
import AppLayout from '@/web/shared/layout/AppLayout.vue';

const route = useRoute();
</script>

<template>
  <!-- El check-in es un kiosco: ocupa toda la pantalla, sin barra lateral. -->
  <RouterView v-if="route.meta.kiosco" />
  <AppLayout v-else />

  <PilaDeAvisos />
</template>
