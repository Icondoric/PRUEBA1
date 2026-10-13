<script setup lang="ts">
/**
 * Inicio: lo que hay que saber y lo que más se hace, apenas se entra.
 *
 * Cada bloque se muestra solo a quien tiene el acceso para ver ese dato, y
 * carga y falla por su cuenta. No hay datos nuevos: todo sale de las mismas
 * consultas que usan Pagos, Clientes y Reportes.
 */
import { CircleX, Plus, ScanLine, Ticket, TriangleAlert } from '@lucide/vue';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useAccesos } from '@/web/features/sesion/api/sesion.api';
import { Button } from '@/web/shared/ui/button';
import ClientesSegunMembresia from '../components/ClientesSegunMembresia.vue';
import CobradoHoy from '../components/CobradoHoy.vue';
import NumerosDeHoy from '../components/NumerosDeHoy.vue';
import VencenEstosDias from '../components/VencenEstosDias.vue';

const { usuario, puede } = useAccesos();

const nombreDePila = computed(() => usuario.value?.nombre.trim().split(/\s+/)[0] ?? '');

const veClientes = computed(
  () => puede('clientes.gestionar') || puede('membresias.vender'),
);
const veCaja = computed(() => puede('pagos.caja_hoy') || puede('pagos.otras_fechas'));
</script>

<template>
  <div class="max-w-7xl space-y-8">
    <div class="space-y-1">
      <h1 tabindex="-1" class="titulo-pantalla">
        {{ nombreDePila ? `Hola, ${nombreDePila}` : 'Inicio' }}
      </h1>
      <p class="text-muted-foreground text-sm">Esto es lo de hoy.</p>
    </div>

    <!-- Lo que más se hace, a un clic. -->
    <div class="flex flex-wrap gap-2">
      <Button v-if="puede('clientes.gestionar')" as-child>
        <RouterLink :to="{ name: 'cliente-nuevo' }">
          <Plus aria-hidden="true" />
          Registrar cliente
        </RouterLink>
      </Button>
      <Button v-if="puede('checkin.usar')" as-child variant="outline">
        <RouterLink :to="{ name: 'checkin' }">
          <ScanLine aria-hidden="true" />
          Abrir check-in
        </RouterLink>
      </Button>
      <Button v-if="puede('visitas.gestionar')" as-child variant="outline">
        <RouterLink :to="{ name: 'visitas' }">
          <Ticket aria-hidden="true" />
          Registrar visita
        </RouterLink>
      </Button>
    </div>

    <div
      v-if="veCaja || veClientes || puede('reportes.ver')"
      class="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5"
    >
      <CobradoHoy v-if="veCaja" class="col-span-2 lg:col-span-1" />
      <template v-if="veClientes">
        <ClientesSegunMembresia
          membresia="por_vencer"
          titulo="Vencen en estos días"
          pie="Conviene ofrecerles renovar"
          :icono="TriangleAlert"
        />
        <ClientesSegunMembresia
          membresia="vencida"
          titulo="Vencidas"
          pie="Ya no pueden entrar"
          :icono="CircleX"
        />
      </template>
      <NumerosDeHoy v-if="puede('reportes.ver')" />
    </div>

    <VencenEstosDias v-if="veClientes" />
  </div>
</template>
