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
</script>

<template>
  <div class="max-w-6xl space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="space-y-1">
        <h1 tabindex="-1" class="titulo-pantalla">Usuarios</h1>
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

    <ErrorDeCarga
      v-if="error && !data"
      titulo="No se pudieron cargar los usuarios"
      :mensaje="error.message"
      :reintentando="isFetching"
      @reintentar="refetch()"
    />

    <div v-else-if="data" class="bg-card overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead class="hidden w-40 sm:table-cell">Usuario</TableHead>
            <TableHead class="hidden w-56 md:table-cell">Accesos</TableHead>
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
            <TableCell class="font-medium whitespace-normal">
              <RouterLink
                :to="{ name: 'usuario-editar', params: { id: usuario.id } }"
                class="focus-visible:ring-ring rounded-sm outline-none hover:underline focus-visible:ring-3"
                @click.stop
              >
                {{ usuario.nombre }}
              </RouterLink>
              <span class="text-muted-foreground block text-xs font-normal sm:hidden">
                {{ usuario.usuario }}
              </span>
            </TableCell>
            <TableCell class="hidden sm:table-cell">{{ usuario.usuario }}</TableCell>
            <TableCell class="hidden md:table-cell">
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
