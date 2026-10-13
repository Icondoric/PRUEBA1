<script setup lang="ts">
/**
 * Muestra del sistema visual. Solo existe con `pnpm dev` (ver el router).
 *
 * Sirve para revisar los tokens y los componentes base EN LOS DOS MODOS antes
 * de dar algo por terminado: la paleta, los estados del check-in, un
 * formulario y una tabla. Los datos son de ejemplo y nada se guarda.
 */
import {
  Ban,
  Banknote,
  CircleCheck,
  CircleX,
  LogIn,
  TriangleAlert,
  Users,
} from '@lucide/vue';
import { ref } from 'vue';
import CampoFormulario from '@/web/shared/components/CampoFormulario.vue';
import ControlSegmentado from '@/web/shared/components/ControlSegmentado.vue';
import InterruptorDeTema from '@/web/shared/components/InterruptorDeTema.vue';
import { avisos } from '@/web/shared/lib/avisos';
import { formatearBs, formatearFecha } from '@/web/shared/lib/formato';
import { Badge } from '@/web/shared/ui/badge';
import { Button } from '@/web/shared/ui/button';
import { Checkbox } from '@/web/shared/ui/checkbox';
import { Input } from '@/web/shared/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/web/shared/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/web/shared/ui/table';

const ESCALA = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

const SUPERFICIES = [
  { nombre: 'background', clase: 'bg-background text-foreground' },
  { nombre: 'card', clase: 'bg-card text-card-foreground' },
  { nombre: 'muted', clase: 'bg-muted text-muted-foreground' },
  { nombre: 'secondary', clase: 'bg-secondary text-secondary-foreground' },
  { nombre: 'accent', clase: 'bg-accent text-accent-foreground' },
  { nombre: 'primary', clase: 'bg-primary text-primary-foreground' },
  { nombre: 'destructive', clase: 'bg-destructive text-destructive-foreground' },
];

const ESTADOS = [
  {
    clave: 'permitido',
    clase: 'bg-estado-permitido text-estado-permitido-foreground',
    icono: CircleCheck,
    titulo: 'Adelante',
    nombre: 'María Fernanda Quispe',
    iniciales: 'MF',
    mensaje: 'Te quedan 18 días',
  },
  {
    clave: 'pase por sesión',
    clase: 'bg-estado-permitido text-estado-permitido-foreground',
    icono: CircleCheck,
    titulo: 'Adelante',
    nombre: 'Diego Flores',
    iniciales: 'DF',
    mensaje: 'Pase por sesión válido hoy',
  },
  {
    clave: 'por vencer',
    clase: 'bg-estado-por-vencer text-estado-por-vencer-foreground',
    icono: TriangleAlert,
    titulo: 'Adelante',
    nombre: 'Luis Alberto Mamani',
    iniciales: 'LA',
    mensaje: 'Tu membresía vence en 2 días',
  },
  {
    clave: 'rechazado',
    clase: 'bg-estado-rechazado text-estado-rechazado-foreground',
    icono: CircleX,
    titulo: 'No podés ingresar',
    nombre: 'Carla Rojas Vargas',
    iniciales: 'CR',
    mensaje: 'Tu membresía venció hace 5 días',
  },
];

const CLIENTES = [
  {
    nro: 47,
    nombre: 'Luis Alberto Mamani',
    tipo: 'Socio',
    plan: 'Trimestral',
    vence: '2026-10-13',
    centavos: 54000,
  },
  {
    nro: 89,
    nombre: 'Diego Flores',
    tipo: 'Eventual',
    plan: 'Pase por sesión',
    vence: '2026-10-11',
    centavos: 2000,
  },
  {
    nro: 112,
    nombre: 'María Fernanda Quispe',
    tipo: 'Socio',
    plan: 'Mensual',
    vence: '2026-10-29',
    centavos: 20000,
  },
  {
    nro: 131,
    nombre: 'Carla Rojas Vargas',
    tipo: 'Socio',
    plan: 'Mensual',
    vence: '2026-10-06',
    centavos: 20000,
  },
];

const nombre = ref('Luis Alberto');
const ci = ref('12');
const plan = ref('mensual');
const metodo = ref('efectivo');
const otraFecha = ref(false);

const METODOS = [
  { valor: 'efectivo', etiqueta: 'Efectivo' },
  { valor: 'qr', etiqueta: 'QR' },
  { valor: 'transferencia', etiqueta: 'Transferencia' },
  { valor: 'tarjeta', etiqueta: 'Tarjeta' },
];

const HOY = [
  {
    nombre: 'Socios activos',
    valor: '148',
    pie: 'Sin contar pases por sesión',
    icono: Users,
  },
  { nombre: 'Cobrado', valor: formatearBs(125000), pie: null, icono: Banknote },
  { nombre: 'Entraron', valor: '63', pie: null, icono: LogIn },
  { nombre: 'Rebotaron', valor: '4', pie: 'Vencidos o sin membresía', icono: Ban },
];
</script>

<template>
  <main class="mx-auto max-w-5xl space-y-12 px-4 py-8 md:px-8">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div class="space-y-1">
        <h1 tabindex="-1" class="titulo-pantalla">Muestra visual</h1>
        <p class="text-muted-foreground text-sm">
          Datos de ejemplo. Revisá cada bloque en modo claro y en modo oscuro.
        </p>
      </div>
      <InterruptorDeTema />
    </header>

    <section aria-labelledby="m-jerarquia" class="space-y-4">
      <h2 id="m-jerarquia" class="titulo-seccion">Jerarquía y cajas</h2>
      <p class="text-muted-foreground max-w-prose text-sm">
        Título de pantalla, título de sección y la cifra que importa de cada caja. Las
        cajas se separan del fondo por su tono; en oscuro no dependen del borde.
      </p>

      <dl class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div
          v-for="caja in HOY"
          :key="caja.nombre"
          class="bg-card text-card-foreground space-y-3 rounded-xl border p-4"
        >
          <div class="flex items-center justify-between gap-2">
            <dt class="text-muted-foreground text-sm font-medium">{{ caja.nombre }}</dt>
            <span
              class="bg-accent text-accent-foreground flex size-8 shrink-0 items-center justify-center rounded-md"
              aria-hidden="true"
            >
              <component :is="caja.icono" class="size-4" />
            </span>
          </div>
          <dd class="cifra">{{ caja.valor }}</dd>
          <dd v-if="caja.pie" class="text-muted-foreground text-xs">{{ caja.pie }}</dd>
        </div>
      </dl>
    </section>

    <section aria-labelledby="m-paleta" class="space-y-4">
      <h2 id="m-paleta" class="titulo-seccion">Paleta</h2>

      <ul class="grid grid-cols-5 gap-2 md:grid-cols-10">
        <li v-for="paso in ESCALA" :key="paso" class="space-y-1">
          <div
            class="h-12 rounded-md border"
            :style="{ background: `var(--marca-${paso})` }"
          ></div>
          <p class="text-muted-foreground text-xs tabular-nums">{{ paso }}</p>
        </li>
      </ul>

      <ul class="grid grid-cols-2 gap-2 md:grid-cols-4">
        <li
          v-for="superficie in SUPERFICIES"
          :key="superficie.nombre"
          class="rounded-md border px-3 py-4 text-sm font-medium"
          :class="superficie.clase"
        >
          {{ superficie.nombre }}
        </li>
        <li class="bg-card rounded-md border px-3 py-4 text-sm font-medium">
          <span class="text-primary-text">primary-text</span>
        </li>
      </ul>
    </section>

    <section aria-labelledby="m-checkin" class="space-y-4">
      <div class="space-y-1">
        <h2 id="m-checkin" class="titulo-seccion">Estados del check-in</h2>
        <p class="text-muted-foreground text-sm">
          Cada resultado lleva color, ícono y texto. En esa pantalla el ámbar significa
          solo "por vencer".
        </p>
      </div>

      <ul class="sin-marca grid gap-3 md:grid-cols-2">
        <li
          v-for="estado in ESTADOS"
          :key="estado.clave"
          class="flex flex-col items-center gap-4 rounded-xl px-6 py-8 text-center"
          :class="estado.clase"
        >
          <div class="flex items-center gap-3">
            <component :is="estado.icono" class="size-10 shrink-0" aria-hidden="true" />
            <p class="text-3xl font-semibold tracking-tight">{{ estado.titulo }}</p>
          </div>
          <div
            class="flex size-20 items-center justify-center rounded-full border-4 border-current text-3xl font-semibold"
            aria-hidden="true"
          >
            {{ estado.iniciales }}
          </div>
          <p class="text-3xl leading-tight font-semibold tracking-tight text-balance">
            {{ estado.nombre }}
          </p>
          <p class="text-xl font-medium text-balance">{{ estado.mensaje }}</p>
          <p class="text-base font-medium">Estado: {{ estado.clave }}</p>
        </li>
      </ul>
    </section>

    <section aria-labelledby="m-formulario" class="space-y-4">
      <h2 id="m-formulario" class="titulo-seccion">Formulario</h2>

      <form
        class="bg-card text-card-foreground max-w-xl space-y-4 rounded-xl border p-6"
        novalidate
        @submit.prevent
      >
        <CampoFormulario id="m-nombre" v-slot="{ control }" etiqueta="Nombre">
          <Input v-bind="control" v-model="nombre" autocomplete="off" />
        </CampoFormulario>

        <CampoFormulario
          id="m-ci"
          v-slot="{ control }"
          etiqueta="CI"
          opcional
          error="El CI debe tener entre 4 y 12 dígitos."
        >
          <Input v-bind="control" v-model="ci" inputmode="numeric" autocomplete="off" />
        </CampoFormulario>

        <CampoFormulario
          id="m-plan"
          v-slot="{ control }"
          etiqueta="Plan"
          ayuda="El precio es el vigente hoy."
        >
          <Select v-model="plan">
            <SelectTrigger v-bind="control" class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mensual">Mensual</SelectItem>
              <SelectItem value="trimestral">Trimestral</SelectItem>
              <SelectItem value="pase">Pase por sesión</SelectItem>
            </SelectContent>
          </Select>
        </CampoFormulario>

        <div class="space-y-2">
          <p id="m-metodo" class="text-sm font-medium">Cómo pagó</p>
          <ControlSegmentado
            v-model="metodo"
            :opciones="METODOS"
            etiquetado-por="m-metodo"
          />
        </div>

        <label for="m-otra-fecha" class="flex cursor-pointer items-center gap-3 text-sm">
          <Checkbox id="m-otra-fecha" v-model="otraFecha" />
          Elegir otra fecha de inicio
        </label>

        <div class="flex flex-wrap gap-2 pt-2">
          <Button type="submit">Registrar pago</Button>
          <Button type="button" variant="outline">Cancelar</Button>
          <Button type="button" variant="secondary">Guardar borrador</Button>
          <Button type="button" variant="ghost">Limpiar</Button>
          <Button type="button" variant="destructive">Anular pago</Button>
          <Button type="button" variant="link">Ver historial</Button>
        </div>
      </form>

      <div class="sin-marca bg-card max-w-xl space-y-3 rounded-xl border p-6">
        <p class="text-muted-foreground text-sm">
          Los mismos botones dentro del check-in: sin color de marca.
        </p>
        <div class="flex flex-wrap gap-2">
          <Button type="button">Cobrar y dejar pasar</Button>
          <Button type="button" variant="outline">Cancelar</Button>
          <Button type="button" variant="ghost">Limpiar</Button>
        </div>
      </div>
    </section>

    <section aria-labelledby="m-avisos" class="space-y-4">
      <h2 id="m-avisos" class="titulo-seccion">Avisos</h2>
      <p class="text-muted-foreground max-w-prose text-sm">
        Confirman que algo se hizo y se van solos. Mientras el mouse o el foco están
        encima, se quedan.
      </p>
      <div class="flex flex-wrap gap-2">
        <Button
          id="m-aviso-exito"
          type="button"
          variant="outline"
          @click="avisos.exito('Pago anulado.')"
        >
          Mostrar confirmación
        </Button>
        <Button
          id="m-aviso-error"
          type="button"
          variant="outline"
          @click="
            avisos.error('No se pudo guardar. Revisá que el sistema esté encendido.')
          "
        >
          Mostrar error
        </Button>
      </div>
    </section>

    <section aria-labelledby="m-tabla" class="space-y-4">
      <h2 id="m-tabla" class="titulo-seccion">Tabla</h2>

      <div class="bg-card text-card-foreground rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="text-right">Nº</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Vence</TableHead>
              <TableHead class="text-right">Cobrado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="cliente in CLIENTES" :key="cliente.nro">
              <TableCell class="text-right tabular-nums">{{ cliente.nro }}</TableCell>
              <TableCell class="font-medium">{{ cliente.nombre }}</TableCell>
              <TableCell>
                <Badge :variant="cliente.tipo === 'Socio' ? 'default' : 'secondary'">
                  {{ cliente.tipo }}
                </Badge>
              </TableCell>
              <TableCell>{{ cliente.plan }}</TableCell>
              <TableCell class="tabular-nums">{{
                formatearFecha(cliente.vence)
              }}</TableCell>
              <TableCell class="text-right tabular-nums">
                {{ formatearBs(cliente.centavos) }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </section>
  </main>
</template>
