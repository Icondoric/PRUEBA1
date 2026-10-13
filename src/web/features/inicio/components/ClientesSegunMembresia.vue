<script setup lang="ts">
/**
 * Cuántos clientes están en una situación (por vencer, vencida…), con el
 * enlace a esa misma lista ya filtrada.
 */
import type { Component } from 'vue';
import {
  type FiltrosLista,
  useListaClientes,
} from '@/web/features/clientes/api/clientes.api';
import CajaResumen from './CajaResumen.vue';

const props = defineProps<{
  membresia: NonNullable<FiltrosLista['membresia']>;
  titulo: string;
  pie: string;
  icono: Component;
}>();

// Solo interesa el total: se pide una fila.
const { data, error } = useListaClientes(() => ({
  membresia: props.membresia,
  porPagina: 1,
}));
</script>

<template>
  <CajaResumen
    :titulo="titulo"
    :valor="data ? String(data.total) : undefined"
    :pie="pie"
    :icono="icono"
    :destino="{ name: 'clientes', query: { membresia } }"
    :falla="!!error && !data"
  />
</template>
