<script setup lang="ts">
/**
 * Planes y precios: qué se vende y a cuánto.
 *
 * Solo para quien tiene el acceso "Planes y precios". Un precio nunca se
 * edita: se carga otro encima, y el historial queda a la vista en cada plan.
 */
import { Plus } from '@lucide/vue';
import { refDebounced } from '@vueuse/core';
import { computed, ref } from 'vue';
import type { EstadoDePrecio } from '@/modules/planes';
import ConfirmarDialog from '@/web/shared/components/ConfirmarDialog.vue';
import ErrorDeCarga from '@/web/shared/components/ErrorDeCarga.vue';
import { ErrorDeApi } from '@/web/shared/lib/api';
import { avisos } from '@/web/shared/lib/avisos';
import { formatearBs, formatearFecha, plural } from '@/web/shared/lib/formato';
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
import {
  type PlanAdministrable,
  useGestionDePlanes,
  usePlanesAdministrables,
} from '../api/planes.api';
import PlanDialog from '../components/PlanDialog.vue';
import PrecioDialog from '../components/PrecioDialog.vue';

const { data, error, isPending, isFetching, refetch } = usePlanesAdministrables();
const { cambiarEstado, quitarPrecio } = useGestionDePlanes();

const tardando = refDebounced(isPending, 150);
const mostrarEsqueleto = computed(() => isPending.value && tardando.value);

type Precio = PlanAdministrable['precios'][number];

/** Qué diálogo está abierto. Uno a la vez. */
type Abierto =
  | { tipo: 'crear' }
  | { tipo: 'renombrar'; plan: PlanAdministrable }
  | { tipo: 'precio'; plan: PlanAdministrable; esPromocion: boolean }
  | { tipo: 'baja'; plan: PlanAdministrable }
  | { tipo: 'quitar'; plan: PlanAdministrable; precio: Precio };

const abierto = ref<Abierto | null>(null);
const aviso = ref('');

const ESTADO: Record<EstadoDePrecio, string> = {
  vigente: 'Rige hoy',
  futuro: 'Todavía no empezó',
  terminado: 'Terminado',
};

function abrir(nuevo: Abierto) {
  aviso.value = '';
  abierto.value = nuevo;
}

async function hacer(accion: () => Promise<unknown>, hecho: string) {
  aviso.value = '';
  try {
    await accion();
    abierto.value = null;
    avisos.exito(hecho);
  } catch (fallo) {
    aviso.value =
      fallo instanceof ErrorDeApi
        ? fallo.message
        : 'No se pudo guardar. Revisá que el sistema esté encendido.';
  }
}

function confirmarBaja() {
  const actual = abierto.value;
  if (actual?.tipo !== 'baja') return;
  void hacer(
    () => cambiarEstado.mutateAsync({ id: actual.plan.id, activo: false }),
    'Plan dado de baja. Ya no se ofrece.',
  );
}

function confirmarQuitar() {
  const actual = abierto.value;
  if (actual?.tipo !== 'quitar') return;
  void hacer(() => quitarPrecio.mutateAsync(actual.precio.id), 'Precio quitado.');
}
</script>

<template>
  <div class="max-w-4xl space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="space-y-1">
        <h1 tabindex="-1" class="titulo-pantalla">Planes y precios</h1>
        <p class="text-muted-foreground max-w-prose text-sm">
          Lo que se vende y a cuánto. Un precio nunca se modifica: se carga uno nuevo, y
          lo que ya se vendió queda como estaba.
        </p>
      </div>
      <Button @click="abrir({ tipo: 'crear' })">
        <Plus aria-hidden="true" />
        Crear plan
      </Button>
    </div>

    <p v-if="aviso && abierto === null" role="alert" class="text-destructive text-sm">
      {{ aviso }}
    </p>

    <ErrorDeCarga
      v-if="error && !data"
      titulo="No se pudieron cargar los planes"
      :mensaje="error.message"
      :reintentando="isFetching"
      @reintentar="refetch()"
    />

    <template v-else-if="data">
      <p v-if="data.planes.length === 0" class="text-muted-foreground text-sm">
        Todavía no hay planes. Creá el primero para poder vender.
      </p>

      <section
        v-for="plan in data.planes"
        :key="plan.id"
        :aria-labelledby="`plan-titulo-${plan.id}`"
        class="space-y-4 rounded-lg border p-5"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="space-y-1.5">
            <h2
              :id="`plan-titulo-${plan.id}`"
              class="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight"
            >
              {{ plan.nombre }}
              <Badge v-if="plan.esPaseDiario" variant="outline">Pase por sesión</Badge>
              <Badge v-if="!plan.activo" variant="outline">Dado de baja</Badge>
            </h2>
            <p class="text-muted-foreground text-sm">
              {{
                plan.esPaseDiario
                  ? 'Vale el día que se paga'
                  : `Dura ${plural(plan.diasDuracion, 'día', 'días')}`
              }}
            </p>
          </div>

          <div class="text-right">
            <p class="text-muted-foreground text-sm">Se cobra hoy</p>
            <p class="text-2xl font-semibold tracking-tight tabular-nums">
              {{
                plan.precioHoy ? formatearBs(plan.precioHoy.precioCentavos) : 'Sin precio'
              }}
            </p>
            <p v-if="plan.precioHoy?.esPromocion" class="text-muted-foreground text-xs">
              {{ plan.precioHoy.etiqueta ?? 'Promoción' }}
            </p>
            <p v-if="!plan.precioHoy" class="text-destructive text-xs">
              Sin precio no se puede vender
            </p>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            @click="abrir({ tipo: 'precio', plan, esPromocion: false })"
          >
            Cambiar precio
          </Button>
          <Button
            size="sm"
            variant="outline"
            @click="abrir({ tipo: 'precio', plan, esPromocion: true })"
          >
            Cargar promoción
          </Button>
          <Button size="sm" variant="ghost" @click="abrir({ tipo: 'renombrar', plan })">
            Cambiar nombre
          </Button>
          <Button
            v-if="plan.activo"
            size="sm"
            variant="ghost"
            @click="abrir({ tipo: 'baja', plan })"
          >
            Dar de baja plan
          </Button>
          <Button
            v-else
            size="sm"
            variant="ghost"
            :disabled="cambiarEstado.isPending.value"
            @click="
              hacer(
                () => cambiarEstado.mutateAsync({ id: plan.id, activo: true }),
                'El plan se vuelve a ofrecer.',
              )
            "
          >
            Volver a ofrecer plan
          </Button>
        </div>

        <div v-if="plan.precios.length > 0" class="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-32 text-right">Precio</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead class="w-28">Desde</TableHead>
                <TableHead class="w-28">Hasta</TableHead>
                <TableHead class="w-56">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="precio in plan.precios" :key="precio.id" class="h-11">
                <TableCell class="text-right tabular-nums">
                  {{ formatearBs(precio.precioCentavos, { conCentavos: true }) }}
                </TableCell>
                <TableCell>
                  {{
                    precio.esPromocion
                      ? (precio.etiqueta ?? 'Promoción')
                      : 'Precio habitual'
                  }}
                </TableCell>
                <TableCell class="tabular-nums">
                  {{ formatearFecha(precio.vigenteDesde) }}
                </TableCell>
                <TableCell class="tabular-nums">
                  {{ formatearFecha(precio.vigenteHasta) }}
                </TableCell>
                <TableCell>
                  <span class="flex flex-wrap items-center gap-2">
                    <Badge
                      :variant="precio.estado === 'vigente' ? 'secondary' : 'outline'"
                    >
                      {{ ESTADO[precio.estado] }}
                    </Badge>
                    <Button
                      v-if="precio.sePuedeQuitar"
                      size="xs"
                      variant="ghost"
                      @click="abrir({ tipo: 'quitar', plan, precio })"
                    >
                      Quitar
                    </Button>
                  </span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>
    </template>

    <div v-else-if="mostrarEsqueleto" class="space-y-4" aria-hidden="true">
      <Skeleton class="h-48 w-full" />
      <Skeleton class="h-48 w-full" />
    </div>

    <PlanDialog v-if="abierto?.tipo === 'crear'" @cerrar="abierto = null" />
    <PlanDialog
      v-if="abierto?.tipo === 'renombrar'"
      :key="`renombrar-${abierto.plan.id}`"
      :plan="abierto.plan"
      @cerrar="abierto = null"
    />
    <PrecioDialog
      v-if="abierto?.tipo === 'precio' && data"
      :key="`precio-${abierto.plan.id}-${abierto.esPromocion}`"
      :plan="abierto.plan"
      :es-promocion="abierto.esPromocion"
      :hoy="data.hoy"
      @cerrar="abierto = null"
    />

    <ConfirmarDialog
      v-if="abierto?.tipo === 'baja'"
      :titulo="`¿Dar de baja el plan ${abierto.plan.nombre}?`"
      confirmar="Dar de baja plan"
      cancelar="No dar de baja"
      destructivo
      :pendiente="cambiarEstado.isPending.value"
      :error="aviso"
      @confirmar="confirmarBaja"
      @cerrar="abierto = null"
    >
      <p>
        Deja de aparecer al vender. No se borra: quienes ya lo compraron lo conservan.
      </p>
      <p>Lo podés volver a ofrecer cuando quieras.</p>
    </ConfirmarDialog>

    <ConfirmarDialog
      v-if="abierto?.tipo === 'quitar'"
      :titulo="`¿Quitar este precio de ${abierto.plan.nombre}?`"
      confirmar="Quitar precio"
      cancelar="No quitar"
      destructivo
      :pendiente="quitarPrecio.isPending.value"
      :error="aviso"
      @confirmar="confirmarQuitar"
      @cerrar="abierto = null"
    >
      <p>
        {{ formatearBs(abierto.precio.precioCentavos) }}, desde el
        {{ formatearFecha(abierto.precio.vigenteDesde) }}. Todavía no empezó a regir y
        nadie compró con él, así que se puede quitar sin afectar nada.
      </p>
    </ConfirmarDialog>
  </div>
</template>
