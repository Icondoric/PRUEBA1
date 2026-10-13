<script setup lang="ts">
/**
 * Los números del negocio de hoy. Salen de los reportes, así que solo los ve
 * quien tiene ese acceso (el dueño).
 */
import { LogIn, Users } from '@lucide/vue';
import { useReporte } from '@/web/features/reportes/api/reportes.api';
import { plural } from '@/web/shared/lib/formato';
import CajaResumen from './CajaResumen.vue';

const { data, error } = useReporte('');
</script>

<template>
  <CajaResumen
    titulo="Socios activos"
    :valor="data ? String(data.hoyEnNumeros.sociosActivos) : undefined"
    pie="Sin contar pases por sesión"
    :icono="Users"
    :destino="{ name: 'reportes' }"
    :falla="!!error && !data"
  />
  <CajaResumen
    titulo="Entraron hoy"
    :valor="data ? String(data.hoyEnNumeros.ingresos) : undefined"
    :pie="
      data
        ? `${plural(data.hoyEnNumeros.rechazados, 'rebotó', 'rebotaron')} en la puerta`
        : undefined
    "
    :icono="LogIn"
    :destino="{ name: 'reportes' }"
    :falla="!!error && !data"
  />
</template>
