<script setup lang="ts">
/**
 * Listado de clientes: búsqueda, filtros, cómo está la membresía de cada uno
 * y paginación.
 *
 * Los filtros viven en la URL (`?texto=&tipo=&pagina=`): volver atrás desde
 * una ficha deja la lista exactamente donde estaba, y un enlace se puede
 * compartir. La pantalla no guarda nada del servidor: todo sale de vue-query.
 */
import { Plus, Search } from '@lucide/vue';
import { refDebounced } from '@vueuse/core';
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useCoberturas } from '@/web/features/membresias/api/membresias.api';
import EstadoDeMembresia from '@/web/features/membresias/components/EstadoDeMembresia.vue';
import { useAccesos } from '@/web/features/sesion/api/sesion.api';
import ErrorDeCarga from '@/web/shared/components/ErrorDeCarga.vue';
import { formatearCi, plural } from '@/web/shared/lib/formato';
import { Button } from '@/web/shared/ui/button';
import { Input } from '@/web/shared/ui/input';
import { Label } from '@/web/shared/ui/label';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/web/shared/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/web/shared/ui/select';
import { Skeleton } from '@/web/shared/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/web/shared/ui/table';
import { type FiltrosLista, useListaClientes } from '../api/clientes.api';
import ClienteEtiquetas from '../components/ClienteEtiquetas.vue';

const POR_PAGINA = 25;

const route = useRoute();
const { puede } = useAccesos();
const router = useRouter();

const deLaUrl = (valor: unknown) => (typeof valor === 'string' ? valor : '');

const esTipo = (valor: unknown): valor is NonNullable<FiltrosLista['tipo']> =>
  valor === 'socio' || valor === 'eventual';

const MEMBRESIAS = {
  al_dia: 'Al día',
  por_vencer: 'Por vencer',
  vencida: 'Vencida',
  sin_membresia: 'Sin membresía',
} as const;

const esMembresia = (valor: unknown): valor is keyof typeof MEMBRESIAS =>
  typeof valor === 'string' && valor in MEMBRESIAS;

const filtros = computed(() => {
  const tipo = deLaUrl(route.query.tipo);
  const membresia = deLaUrl(route.query.membresia);
  const pagina = Number(deLaUrl(route.query.pagina));
  return {
    texto: deLaUrl(route.query.texto),
    tipo: esTipo(tipo) ? tipo : undefined,
    membresia: esMembresia(membresia) ? membresia : undefined,
    // Los dados de baja los ve quien tiene el acceso para reactivarlos.
    estado: route.query.estado === 'baja' ? ('baja' as const) : undefined,
    pagina: Number.isInteger(pagina) && pagina > 0 ? pagina : 1,
    porPagina: POR_PAGINA,
  };
});

const hayFiltros = computed(
  () =>
    filtros.value.texto !== '' ||
    filtros.value.tipo !== undefined ||
    filtros.value.membresia !== undefined ||
    filtros.value.estado !== undefined,
);

const { data, error, isPending, isFetching, isPlaceholderData, refetch } =
  useListaClientes(filtros);

// Cómo está la membresía de los que se ven: una sola consulta por página.
const idsALaVista = computed(() => data.value?.clientes.map((c) => c.id) ?? []);
const { data: coberturas } = useCoberturas(idsALaVista);
const coberturaDe = computed(
  () => new Map(coberturas.value?.coberturas.map((c) => [c.clienteId, c]) ?? []),
);

function irA(
  cambios: {
    texto?: string;
    tipo?: string;
    membresia?: string;
    estado?: string;
    pagina?: number;
  },
  modo: 'push' | 'replace',
) {
  const nuevo = { ...filtros.value, ...cambios };
  void router[modo]({
    query: {
      texto: nuevo.texto || undefined,
      tipo: esTipo(nuevo.tipo) ? nuevo.tipo : undefined,
      membresia: esMembresia(nuevo.membresia) ? nuevo.membresia : undefined,
      estado: nuevo.estado === 'baja' ? 'baja' : undefined,
      pagina: nuevo.pagina > 1 ? String(nuevo.pagina) : undefined,
    },
  });
}

// La caja de búsqueda responde en el acto; la consulta espera a que se deje
// de teclear. Enter la dispara sin esperar.
const textoBusqueda = ref(filtros.value.texto);
const textoEstable = refDebounced(textoBusqueda, 200);

function buscar(texto: string) {
  if (texto.trim() !== filtros.value.texto)
    irA({ texto: texto.trim(), pagina: 1 }, 'replace');
}
watch(textoEstable, buscar);

// Si la URL cambia por fuera (botón atrás, "Quitar filtros"), la caja la sigue.
watch(
  () => filtros.value.texto,
  (texto) => {
    if (texto !== textoBusqueda.value.trim()) textoBusqueda.value = texto;
  },
);

function quitarFiltros() {
  textoBusqueda.value = '';
  irA(
    { texto: '', tipo: undefined, membresia: undefined, estado: undefined, pagina: 1 },
    'push',
  );
}

// El esqueleto aparece solo si la carga tarda: contra localhost casi nunca, y
// un parpadeo de 20ms es peor que nada.
const tardando = refDebounced(isPending, 150);
const mostrarEsqueleto = computed(() => isPending.value && tardando.value);

const resumen = computed(() => {
  if (!data.value) return '';
  const { total, pagina, porPagina, clientes } = data.value;
  if (total === 0) return 'Sin resultados';
  const desde = (pagina - 1) * porPagina + 1;
  return `${desde}–${desde + clientes.length - 1} de ${plural(total, 'cliente', 'clientes')}`;
});

const descripcionFiltros = computed(() => {
  const partes: string[] = [];
  if (filtros.value.texto) partes.push(`“${filtros.value.texto}”`);
  if (filtros.value.tipo)
    partes.push(filtros.value.tipo === 'socio' ? 'socios' : 'eventuales');
  if (filtros.value.membresia)
    partes.push(`membresía: ${MEMBRESIAS[filtros.value.membresia].toLowerCase()}`);
  return partes.join(' en ');
});
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 tabindex="-1" class="titulo-pantalla">Clientes</h1>
      <Button v-if="puede('clientes.gestionar')" as-child>
        <RouterLink :to="{ name: 'cliente-nuevo' }">
          <Plus aria-hidden="true" />
          Registrar cliente
        </RouterLink>
      </Button>
    </div>

    <form
      role="search"
      class="flex flex-wrap items-end gap-3"
      @submit.prevent="buscar(textoBusqueda)"
    >
      <div class="w-full space-y-1.5 sm:w-80">
        <Label for="buscar-cliente">Buscar</Label>
        <div class="relative">
          <Search
            class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            id="buscar-cliente"
            v-model="textoBusqueda"
            type="search"
            class="pl-8"
            placeholder="Nombre, CI o nº de socio"
            autocomplete="off"
          />
        </div>
      </div>

      <div class="space-y-1.5">
        <Label for="filtro-tipo">Tipo</Label>
        <Select
          :model-value="filtros.tipo ?? 'todos'"
          @update:model-value="irA({ tipo: String($event), pagina: 1 }, 'push')"
        >
          <SelectTrigger id="filtro-tipo" class="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="socio">Socios</SelectItem>
            <SelectItem value="eventual">Eventuales</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="space-y-1.5">
        <Label for="filtro-membresia">Membresía</Label>
        <Select
          :model-value="filtros.membresia ?? 'todas'"
          @update:model-value="irA({ membresia: String($event), pagina: 1 }, 'push')"
        >
          <SelectTrigger id="filtro-membresia" class="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem v-for="(nombre, clave) in MEMBRESIAS" :key="clave" :value="clave">
              {{ nombre }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div v-if="puede('clientes.baja')" class="space-y-1.5">
        <Label for="filtro-estado">Estado</Label>
        <Select
          :model-value="filtros.estado ?? 'activos'"
          @update:model-value="irA({ estado: String($event), pagina: 1 }, 'push')"
        >
          <SelectTrigger id="filtro-estado" class="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="activos">Activos</SelectItem>
            <SelectItem value="baja">Dados de baja</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button v-if="hayFiltros" type="button" variant="ghost" @click="quitarFiltros">
        Quitar filtros
      </Button>
    </form>

    <ErrorDeCarga
      v-if="error && !data"
      titulo="No se pudo cargar la lista de clientes"
      :mensaje="error.message"
      :reintentando="isFetching"
      @reintentar="refetch()"
    />

    <template v-else>
      <!-- Al refrescar o cambiar de página se sigue viendo lo anterior, atenuado. -->
      <div
        class="bg-card min-h-96 overflow-hidden rounded-xl border transition-opacity duration-150"
        :class="{ 'opacity-60': isPlaceholderData }"
        :aria-busy="isFetching"
      >
        <Table class="table-fixed">
          <TableHeader class="bg-background sticky top-0">
            <TableRow>
              <TableHead class="w-14 text-right sm:w-24">Nº</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead class="hidden w-36 sm:table-cell">CI</TableHead>
              <TableHead class="hidden w-32 xl:table-cell">Teléfono</TableHead>
              <TableHead class="hidden w-36 md:table-cell">Tipo</TableHead>
              <TableHead class="w-40 sm:w-60">Membresía</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody v-if="mostrarEsqueleto" aria-hidden="true">
            <TableRow v-for="n in 10" :key="n" class="h-11">
              <TableCell><Skeleton class="ml-auto h-4 w-8" /></TableCell>
              <TableCell><Skeleton class="h-4 w-40" /></TableCell>
              <TableCell class="hidden sm:table-cell">
                <Skeleton class="h-4 w-24" />
              </TableCell>
              <TableCell class="hidden xl:table-cell">
                <Skeleton class="h-4 w-20" />
              </TableCell>
              <TableCell class="hidden md:table-cell">
                <Skeleton class="h-5 w-16 rounded-full" />
              </TableCell>
              <TableCell><Skeleton class="h-4 w-28" /></TableCell>
            </TableRow>
          </TableBody>

          <TableBody v-else-if="data && data.clientes.length > 0">
            <TableRow
              v-for="cliente in data.clientes"
              :key="cliente.id"
              class="h-11 cursor-pointer"
              @click="router.push({ name: 'cliente-ficha', params: { id: cliente.id } })"
            >
              <TableCell class="text-right tabular-nums">{{
                cliente.nroSocio
              }}</TableCell>
              <TableCell class="truncate font-medium">
                <RouterLink
                  :to="{ name: 'cliente-ficha', params: { id: cliente.id } }"
                  class="focus-visible:ring-ring rounded-sm outline-none hover:underline focus-visible:ring-3"
                  @click.stop
                >
                  {{ cliente.nombreCompleto }}
                </RouterLink>
              </TableCell>
              <TableCell class="hidden tabular-nums sm:table-cell">
                {{ formatearCi(cliente.ci, cliente.ciExtension) }}
              </TableCell>
              <TableCell class="hidden tabular-nums xl:table-cell">
                {{ cliente.telefono ?? '—' }}
              </TableCell>
              <TableCell class="hidden md:table-cell">
                <ClienteEtiquetas :cliente="cliente" />
              </TableCell>
              <TableCell>
                <!-- Llega un instante después que la lista: el lugar ya está reservado. -->
                <EstadoDeMembresia
                  v-if="coberturaDe.get(cliente.id)"
                  :cobertura="coberturaDe.get(cliente.id)!"
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <!-- Vacío por filtros: decir cuál y ofrecer la salida. -->
        <div
          v-if="data && data.clientes.length === 0 && hayFiltros"
          class="flex flex-col items-center gap-3 px-4 py-16 text-center"
        >
          <p class="text-sm font-medium">
            Ningún cliente coincide con {{ descripcionFiltros }}
          </p>
          <p class="text-muted-foreground max-w-prose text-sm">
            Probá con otro nombre, el CI sin puntos o el número de socio.
          </p>
          <Button variant="outline" size="sm" @click="quitarFiltros"
            >Quitar filtros</Button
          >
        </div>

        <!-- Vacío de primera vez: explicar qué va acá y cómo empezar. -->
        <div
          v-else-if="data && data.clientes.length === 0"
          class="flex flex-col items-center gap-3 px-4 py-16 text-center"
        >
          <p class="text-sm font-medium">Todavía no hay clientes</p>
          <p class="text-muted-foreground max-w-prose text-sm">
            Acá aparecen los socios y quienes compran un pase por sesión. Para un pase
            alcanza con el nombre.
          </p>
          <Button v-if="puede('clientes.gestionar')" as-child size="sm">
            <RouterLink :to="{ name: 'cliente-nuevo' }">Registrar cliente</RouterLink>
          </Button>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-muted-foreground text-sm tabular-nums" role="status">
          {{ resumen }}
        </p>

        <Pagination
          v-if="data && data.paginas > 1"
          v-slot="{ page }"
          class="mx-0 w-auto"
          :total="data.total"
          :items-per-page="data.porPagina"
          :page="filtros.pagina"
          :sibling-count="1"
          show-edges
          @update:page="irA({ pagina: $event }, 'push')"
        >
          <PaginationContent v-slot="{ items }">
            <PaginationPrevious>Anterior</PaginationPrevious>
            <!-- En pantalla angosta los números no entran: va "3 de 7". -->
            <span class="px-2 text-sm tabular-nums sm:hidden">
              {{ page }} de {{ data.paginas }}
            </span>
            <template v-for="(item, indice) in items" :key="indice">
              <PaginationItem
                v-if="item.type === 'page'"
                class="hidden sm:inline-flex"
                :value="item.value"
                :is-active="item.value === page"
                :aria-label="`Página ${item.value}`"
              >
                {{ item.value }}
              </PaginationItem>
              <PaginationEllipsis v-else class="hidden sm:flex" :index="indice" />
            </template>
            <PaginationNext>Siguiente</PaginationNext>
          </PaginationContent>
        </Pagination>
      </div>
    </template>
  </div>
</template>
