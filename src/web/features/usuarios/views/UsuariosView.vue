<script setup lang="ts">
/**
 * Usuarios: quiénes pueden entrar al sistema. Solo la ve el dueño.
 */
import { Plus } from '@lucide/vue';
import { refDebounced } from '@vueuse/core';
import { computed } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import ErrorDeCarga from '@/web/shared/components/ErrorDeCarga.vue';
import { plural } from '@/web/shared/lib/formato';
import { Badge } from '@/web/shared/ui/badge';
import { Button } from '@/web/shared/ui/button';
import { Skeleton } from '@/web/shared/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/web/shared/ui/table';
import { useUsuarios } from '../api/usuarios.api';

const router = useRouter();
const { data, error, isPending, isFetching, refetch } = useUsuarios();

const tardando = refDebounced(isPending, 150);
const mostrarEsqueleto = computed(() => isPending.value && tardando.value);

const confirmacion = computed(() => {
  const aviso: unknown = history.state?.aviso;
  return typeof aviso === 'string' ? aviso : '';
});
</script>

<template>
  <div class="max-w-4xl space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="space-y-1">
        <h1 tabindex="-1" class="text-2xl font-semibold tracking-tight">Usuarios</h1>
        <p class="text-muted-foreground max-w-prose text-sm">
          Cada persona entra con su propio usuario. Así queda registrado quién cobró cada
          cosa.
        </p>
      </div>
      <Button as-child>
        <RouterLink :to="{ name: 'usuario-nuevo' }">
          <Plus aria-hidden="true" />
          Crear usuario
        </RouterLink>
      </Button>
    </div>

    <p v-if="confirmacion" role="status" class="rounded-md border px-3 py-2 text-sm">
      {{ confirmacion }}
    </p>

    <ErrorDeCarga
      v-if="error && !data"
      titulo="No se pudieron cargar los usuarios"
      :mensaje="error.message"
      :reintentando="isFetching"
      @reintentar="refetch()"
    />

    <div v-else-if="data" class="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead class="w-40">Usuario</TableHead>
            <TableHead class="w-56">Accesos</TableHead>
            <TableHead class="w-32">Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="usuario in data.usuarios"
            :key="usuario.id"
            class="h-11 cursor-pointer"
            @click="router.push({ name: 'usuario-editar', params: { id: usuario.id } })"
          >
            <TableCell class="font-medium">
              <RouterLink
                :to="{ name: 'usuario-editar', params: { id: usuario.id } }"
                class="focus-visible:ring-ring/50 rounded-sm outline-none hover:underline focus-visible:ring-3"
                @click.stop
              >
                {{ usuario.nombre }}
              </RouterLink>
            </TableCell>
            <TableCell>{{ usuario.usuario }}</TableCell>
            <TableCell>
              <template v-if="usuario.rol === 'admin'">Dueño: todos</template>
              <template v-else-if="usuario.permisos.length === 0">Ninguno</template>
              <template v-else>
                {{ plural(usuario.permisos.length, 'acceso', 'accesos') }}
              </template>
            </TableCell>
            <TableCell>
              <Badge :variant="usuario.activo ? 'secondary' : 'outline'">
                {{ usuario.activo ? 'Activo' : 'Desactivado' }}
              </Badge>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <Skeleton v-else-if="mostrarEsqueleto" class="h-40 w-full" aria-hidden="true" />
  </div>
</template>
