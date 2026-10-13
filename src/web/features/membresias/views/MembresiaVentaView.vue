<script setup lang="ts">
/**
 * Venta y renovación de una membresía.
 *
 * La pantalla muestra el período y el precio que resultan ANTES de confirmar.
 * Esos datos los calcula el servidor (cotización); al confirmar, el servidor
 * los vuelve a calcular. Acá no hay ni una regla de fechas ni de precios.
 */
import { ArrowLeft } from '@lucide/vue';
import { computed, nextTick, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useForm } from 'vee-validate';
import { METODOS_PAGO, ventaInputSchema } from '@/modules/membresias';
import { useCliente } from '@/web/features/clientes/api/clientes.api';
import CampoFormulario from '@/web/shared/components/CampoFormulario.vue';
import ControlSegmentado from '@/web/shared/components/ControlSegmentado.vue';
import ErrorDeCarga from '@/web/shared/components/ErrorDeCarga.vue';
import { ErrorDeApi } from '@/web/shared/lib/api';
import { formatearBs, formatearFecha, plural } from '@/web/shared/lib/formato';
import { esquemaDeFormulario } from '@/web/shared/lib/validacion';
import { Badge } from '@/web/shared/ui/badge';
import { Button } from '@/web/shared/ui/button';
import { Checkbox } from '@/web/shared/ui/checkbox';
import { Input } from '@/web/shared/ui/input';
import { RadioGroup, RadioGroupItem } from '@/web/shared/ui/radio-group';
import {
  useCotizacion,
  useHistorialMembresias,
  usePlanes,
  useVenderMembresia,
} from '../api/membresias.api';

const route = useRoute();
const router = useRouter();

const clienteId = computed(() => Number(route.params.id));
const ficha = computed(() => ({
  name: 'cliente-ficha',
  params: { id: clienteId.value },
}));

const { data: cliente } = useCliente(clienteId);
const { data: catalogo, error: errorPlanes, isFetching, refetch } = usePlanes();
const { data: historial } = useHistorialMembresias(clienteId);
const vender = useVenderMembresia();

// Los planes primero y el pase por sesión al final: a quien ya está en su
// ficha lo normal es venderle un plan.
const planes = computed(() =>
  [...(catalogo.value?.planes ?? [])].sort(
    (a, b) => Number(a.esPaseDiario) - Number(b.esPaseDiario),
  ),
);

const NOMBRE_METODO: Record<Metodo, string> = {
  efectivo: 'Efectivo',
  qr: 'QR',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
};

type Metodo = (typeof METODOS_PAGO)[number];
const esMetodo = (valor: unknown): valor is Metodo =>
  METODOS_PAGO.some((m) => m === valor);

const { handleSubmit, defineField, errors, setFieldError } = useForm({
  validationSchema: esquemaDeFormulario(ventaInputSchema),
  initialValues: {
    clienteId: clienteId.value,
    planId: '',
    metodo: 'efectivo',
    inicio: '',
    nota: '',
  },
});

const [planId] = defineField('planId');
const [metodo] = defineField('metodo');
const [inicio] = defineField('inicio');

function elegirMetodo(valor: unknown) {
  if (esMetodo(valor)) metodo.value = valor;
}
const [nota, notaAttrs] = defineField('nota', (estado) => ({
  validateOnBlur: true,
  validateOnModelUpdate: estado.errors.length > 0,
}));

// Al renovar, lo más probable es que quiera el mismo plan: viene elegido. Es
// solo una sugerencia, se cambia con un clic, y se hace una única vez.
const planSugerido = ref<number | null>(null);
const yaSeSugirio = ref(false);
watch(
  [catalogo, historial],
  () => {
    if (yaSeSugirio.value || !catalogo.value || !historial.value) return;
    yaSeSugirio.value = true;
    if (planId.value) return;

    const anterior = historial.value.membresias.find(
      (m) => !m.esPaseDiario && m.estado !== 'cancelada',
    );
    const plan = catalogo.value.planes.find(
      (p) => p.id === anterior?.planId && p.precio !== null,
    );
    if (plan) {
      planId.value = String(plan.id);
      planSugerido.value = plan.id;
    }
  },
  { immediate: true },
);

const METODOS = METODOS_PAGO.map((valor) => ({ valor, etiqueta: NOMBRE_METODO[valor] }));

const planElegido = computed(() =>
  catalogo.value?.planes.find((p) => String(p.id) === String(planId.value)),
);

// "Arranca el lunes": solo si recepción lo pide, y nunca para un pase.
const eligeFecha = ref(false);
const puedeElegirFecha = computed(
  () => !!planElegido.value && !planElegido.value.esPaseDiario,
);
const inicioElegido = computed(() =>
  eligeFecha.value && puedeElegirFecha.value ? String(inicio.value ?? '') : '',
);

const {
  data: cotizacion,
  error: errorCotizacion,
  isPlaceholderData,
} = useCotizacion(() => ({
  clienteId: clienteId.value,
  planId: planElegido.value?.id ?? 0,
  inicio: inicioElegido.value,
}));

// La cotización es del plan elegido ahora, no un resto del anterior.
const resumen = computed(() =>
  planElegido.value && cotizacion.value && !errorCotizacion.value
    ? cotizacion.value
    : null,
);

const explicacion = computed(() => {
  const c = resumen.value;
  if (!c) return '';
  if (c.plan.esPaseDiario) return 'Vale solo por hoy.';
  if (inicioElegido.value) return 'Empieza en la fecha que elegiste.';
  if (c.encadenada) {
    const loQueQueda =
      c.diasArrastrados === 1
        ? 'el día que le queda'
        : `los ${c.diasArrastrados} días que le quedan`;
    return (
      `Tiene pago hasta el ${formatearFecha(c.fechaFinAnterior)}. La nueva empieza al día ` +
      `siguiente: no pierde ${loQueQueda}.`
    );
  }
  if (c.fechaFinAnterior) {
    return `La anterior venció el ${formatearFecha(c.fechaFinAnterior)}. La nueva empieza hoy.`;
  }
  return 'Es su primera membresía: empieza hoy.';
});

// El error de la fecha lo decide el dominio; se muestra en el campo.
watch(errorCotizacion, (error) => {
  const esDeFecha = error instanceof ErrorDeApi && error.detalles.campo === 'inicio';
  setFieldError('inicio', esDeFecha ? error.message : undefined);
});

const aviso = ref('');
// Un aviso viejo ("Elegí un plan") no puede quedar colgado una vez corregido.
watch([planId, metodo, inicioElegido], () => {
  aviso.value = '';
});

const confirmar = handleSubmit(
  async (valores) => {
    aviso.value = '';

    const venta = await vender
      .mutateAsync({ ...valores, inicio: inicioElegido.value || null })
      .catch((error: unknown) => {
        aviso.value =
          error instanceof ErrorDeApi
            ? error.message
            : 'No se pudo registrar. Revisá que el sistema esté encendido.';
        return null;
      });
    if (!venta) return;

    const { membresia, pago } = venta;
    await router.replace({
      ...ficha.value,
      state: {
        aviso:
          `Membresía registrada: ${membresia.planNombre}, del ${formatearFecha(membresia.fechaInicio)} ` +
          `al ${formatearFecha(membresia.fechaFin)}. Cobrado: ${formatearBs(pago.montoCentavos)}.`,
      },
    });
  },
  async ({ errors: invalidos }) => {
    aviso.value = invalidos.planId ?? 'Revisá los datos antes de cobrar.';
    await nextTick();
    if (invalidos.planId) {
      document.querySelector<HTMLElement>('[data-slot="radio-group-item"]')?.focus();
    }
  },
);
</script>

<template>
  <div class="max-w-6xl space-y-6">
    <RouterLink
      :to="ficha"
      class="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-sm text-sm outline-none focus-visible:ring-3"
    >
      <ArrowLeft class="size-4" aria-hidden="true" />
      Ficha del cliente
    </RouterLink>

    <div class="space-y-1">
      <h1 tabindex="-1" class="titulo-pantalla">Vender membresía</h1>
      <p v-if="cliente" class="text-muted-foreground text-sm">
        Para {{ cliente.nombreCompleto }}, socio nº {{ cliente.nroSocio }}
      </p>
    </div>

    <ErrorDeCarga
      v-if="errorPlanes && !catalogo"
      titulo="No se pudieron cargar los planes"
      :mensaje="errorPlanes.message"
      :reintentando="isFetching"
      @reintentar="refetch()"
    />

    <form
      v-else-if="catalogo"
      class="space-y-7 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8 lg:space-y-0"
      novalidate
      @submit="confirmar"
    >
      <div class="min-w-0 space-y-7">
        <fieldset class="space-y-3">
          <legend id="titulo-plan" class="text-sm font-medium">Plan</legend>

          <p v-if="catalogo.planes.length === 0" class="text-muted-foreground text-sm">
            No hay planes cargados. Hay que crearlos antes de poder vender.
          </p>

          <RadioGroup
            :model-value="String(planId ?? '')"
            aria-labelledby="titulo-plan"
            class="grid gap-3 sm:grid-cols-2"
            @update:model-value="planId = String($event)"
          >
            <label
              v-for="plan in planes"
              :key="plan.id"
              :for="`plan-${plan.id}`"
              class="bg-card has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent flex items-start gap-3 rounded-xl border p-4 transition-colors duration-100"
              :class="plan.precio ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'"
            >
              <RadioGroupItem
                :id="`plan-${plan.id}`"
                :value="String(plan.id)"
                :disabled="!plan.precio"
                class="mt-0.5"
              />
              <span class="min-w-0 flex-1 space-y-1">
                <span class="block text-sm font-medium">{{ plan.nombre }}</span>
                <span class="text-muted-foreground block text-xs">
                  {{
                    plan.esPaseDiario
                      ? 'Vale el día que se paga'
                      : plural(plan.diasDuracion, 'día', 'días')
                  }}
                </span>
                <Badge v-if="plan.precio?.esPromocion">
                  {{ plan.precio.etiqueta ?? 'Promoción' }}
                </Badge>
                <span
                  v-if="plan.id === planSugerido"
                  class="text-muted-foreground block text-xs"
                >
                  Es el plan que ya tenía
                </span>
              </span>
              <span v-if="plan.precio" class="text-right tabular-nums">
                <span class="block text-lg font-semibold tracking-tight">
                  {{ formatearBs(plan.precio.precioCentavos) }}
                </span>
                <s
                  v-if="plan.precio.descuentoCentavos > 0"
                  class="text-muted-foreground block text-xs"
                >
                  <span class="sr-only">Precio habitual: </span>
                  {{
                    formatearBs(
                      plan.precio.precioCentavos + plan.precio.descuentoCentavos,
                    )
                  }}
                </s>
              </span>
              <span v-else class="text-muted-foreground text-xs"
                >Sin precio configurado</span
              >
            </label>
          </RadioGroup>
        </fieldset>

        <div v-if="puedeElegirFecha" class="space-y-3">
          <label
            for="venta-elige-fecha"
            class="flex w-fit cursor-pointer items-center gap-3 text-sm"
          >
            <Checkbox id="venta-elige-fecha" v-model="eligeFecha" />
            Elegir otra fecha de inicio
          </label>

          <CampoFormulario
            v-if="eligeFecha"
            id="venta-inicio"
            v-slot="{ control }"
            etiqueta="Empieza el"
            ayuda="De hoy en adelante. Si la dejás vacía, se calcula sola."
            :error="errors.inicio"
            class="max-w-56"
          >
            <Input
              v-bind="control"
              :model-value="String(inicio ?? '')"
              type="date"
              :min="catalogo.hoy"
              @update:model-value="inicio = String($event)"
            />
          </CampoFormulario>
        </div>

        <div class="space-y-3">
          <p id="titulo-metodo" class="text-sm font-medium">Cómo pagó</p>
          <ControlSegmentado
            :model-value="String(metodo ?? '')"
            :opciones="METODOS"
            etiquetado-por="titulo-metodo"
            @update:model-value="elegirMetodo"
          />
          <p v-if="errors.metodo" class="text-destructive text-sm">{{ errors.metodo }}</p>
        </div>

        <CampoFormulario
          id="venta-nota"
          v-slot="{ control }"
          etiqueta="Nota"
          opcional
          :error="errors.nota"
          class="max-w-xl"
        >
          <Input
            v-bind="{ ...control, ...notaAttrs }"
            :model-value="String(nota ?? '')"
            autocomplete="off"
            @update:model-value="nota = String($event)"
          />
        </CampoFormulario>
      </div>

      <!-- Lo que se va a registrar, antes de confirmar. En pantalla grande queda
           fijo al costado mientras se elige. -->
      <div class="space-y-4 lg:sticky lg:top-8">
        <div
          class="bg-card rounded-xl border p-5 transition-opacity duration-150"
          :class="{ 'opacity-60': isPlaceholderData }"
          aria-live="polite"
        >
          <dl
            v-if="resumen"
            class="grid gap-x-8 gap-y-4 sm:grid-cols-[1fr_auto] lg:grid-cols-1"
          >
            <div class="space-y-1">
              <dt class="text-muted-foreground text-sm">{{ resumen.plan.nombre }}</dt>
              <dd class="text-sm font-medium tabular-nums">
                <template v-if="resumen.plan.esPaseDiario">
                  Hoy, {{ formatearFecha(resumen.fechaInicio) }}
                </template>
                <template v-else>
                  Del {{ formatearFecha(resumen.fechaInicio) }} al
                  {{ formatearFecha(resumen.fechaFin) }}
                </template>
              </dd>
              <dd class="text-muted-foreground max-w-prose text-sm">{{ explicacion }}</dd>
            </div>
            <div class="space-y-1 sm:text-right lg:border-t lg:pt-4 lg:text-left">
              <dt class="text-muted-foreground text-sm">Total a cobrar</dt>
              <dd class="cifra">
                {{ formatearBs(resumen.precioCentavos) }}
              </dd>
              <dd
                v-if="resumen.descuentoCentavos > 0"
                class="text-muted-foreground text-sm"
              >
                {{ resumen.etiqueta ?? 'Promoción' }}: ahorra
                {{ formatearBs(resumen.descuentoCentavos) }}
              </dd>
            </div>
          </dl>

          <p
            v-else-if="planElegido && errorCotizacion && !errors.inicio"
            class="text-destructive text-sm"
          >
            {{ errorCotizacion.message }}
          </p>
          <p
            v-else-if="planElegido && errors.inicio"
            class="text-muted-foreground text-sm"
          >
            Corregí la fecha de inicio para ver el período y el precio.
          </p>
          <p v-else class="text-muted-foreground text-sm">
            Elegí un plan para ver el período y el precio antes de cobrar.
          </p>
        </div>

        <p v-if="aviso" role="alert" class="text-destructive text-sm">{{ aviso }}</p>

        <div class="flex flex-wrap gap-2 lg:[&>*]:flex-1">
          <Button type="submit" size="lg" :disabled="vender.isPending.value">
            <template v-if="vender.isPending.value">Registrando…</template>
            <template v-else-if="resumen">
              Cobrar {{ formatearBs(resumen.precioCentavos) }} y registrar
            </template>
            <template v-else>Registrar membresía</template>
          </Button>
          <Button as-child variant="outline" size="lg">
            <RouterLink :to="ficha">Cancelar</RouterLink>
          </Button>
        </div>
      </div>
    </form>
  </div>
</template>
