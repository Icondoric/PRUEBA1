<script setup lang="ts">
/**
 * Visitas: las entradas GRATIS (cortesía, clase de prueba, acompañante).
 *
 * Quien pagó algo no va acá: es un cliente con su membresía. Por eso este
 * formulario no tiene monto.
 */
import { nextTick, ref, watch } from 'vue';
import { useForm } from 'vee-validate';
import { MOTIVOS_VISITA, type MotivoVisita, visitaInputSchema } from '@/modules/visitas';
import CampoFormulario from '@/web/shared/components/CampoFormulario.vue';
import ErrorDeCarga from '@/web/shared/components/ErrorDeCarga.vue';
import { ErrorDeApi } from '@/web/shared/lib/api';
import { formatearFecha, plural } from '@/web/shared/lib/formato';
import { esquemaDeFormulario, useErroresDelServidor } from '@/web/shared/lib/validacion';
import { Button } from '@/web/shared/ui/button';
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
import { useRegistrarVisita, useVisitas } from '../api/visitas.api';

const NOMBRE_MOTIVO: Record<MotivoVisita, string> = {
  cortesia: 'Cortesía',
  prueba: 'Clase de prueba',
  acompanante: 'Acompañante',
  otro: 'Otro',
};

const CAMPOS = ['nombre', 'motivo', 'invitadoPor', 'telefono', 'nota'] as const;
type Campo = (typeof CAMPOS)[number];
const esCampo = (valor: unknown): valor is Campo => CAMPOS.some((c) => c === valor);
const esMotivo = (valor: unknown): valor is MotivoVisita =>
  MOTIVOS_VISITA.some((m) => m === valor);

const { data, error, isFetching, refetch } = useVisitas();
const registrar = useRegistrarVisita();

const { handleSubmit, defineField, errors, values, resetForm } = useForm({
  validationSchema: esquemaDeFormulario(visitaInputSchema),
  initialValues: {
    nombre: '',
    motivo: 'cortesia',
    invitadoPor: '',
    telefono: '',
    nota: '',
  },
});
// Los errores que devuelve el servidor van aparte: ver useErroresDelServidor.
const { delServidor, ponerError } = useErroresDelServidor(values);

const alSalir = (estado: { errors: string[] }) => ({
  validateOnBlur: true,
  validateOnModelUpdate: estado.errors.length > 0,
});

const [nombre, nombreAttrs] = defineField('nombre', alSalir);
const [motivo] = defineField('motivo');
const [invitadoPor, invitadoPorAttrs] = defineField('invitadoPor', alSalir);
const [telefono, telefonoAttrs] = defineField('telefono', alSalir);
const [nota, notaAttrs] = defineField('nota', alSalir);

function elegirMotivo(valor: unknown) {
  if (esMotivo(valor)) motivo.value = valor;
}

const aviso = ref('');
const confirmacion = ref('');

async function enfocar(campo: Campo) {
  await nextTick();
  document.getElementById(`visita-${campo}`)?.focus();
}

// La confirmación de la visita anterior se va en cuanto se empieza la siguiente.
watch(nombre, (valor) => {
  if (valor) confirmacion.value = '';
});

const guardar = handleSubmit(
  async (valores) => {
    aviso.value = '';
    try {
      const visita = await registrar.mutateAsync(valores);
      resetForm();
      confirmacion.value = `Visita registrada: ${visita.nombre}.`;
      void enfocar('nombre');
    } catch (error) {
      const campo = error instanceof ErrorDeApi ? error.detalles.campo : null;
      if (error instanceof ErrorDeApi && esCampo(campo)) {
        ponerError(campo, error.message);
        void enfocar(campo);
      } else {
        aviso.value =
          error instanceof ErrorDeApi
            ? error.message
            : 'No se pudo registrar. Revisá que el sistema esté encendido.';
      }
    }
  },
  ({ errors: invalidos }) => {
    const conError = CAMPOS.filter((c) => invalidos[c]);
    aviso.value = `Hay ${plural(conError.length, 'campo', 'campos')} para revisar.`;
    if (conError[0]) void enfocar(conError[0]);
  },
);
</script>

<template>
  <div class="space-y-8">
    <div class="space-y-1">
      <h1 tabindex="-1" class="titulo-pantalla">Visitas</h1>
      <p class="text-muted-foreground max-w-prose text-sm">
        Entradas gratis: cortesías, clases de prueba y acompañantes. Si la persona pagó,
        no va acá: se le vende un pase por sesión.
      </p>
    </div>

    <section aria-labelledby="titulo-nueva-visita" class="space-y-4">
      <h2 id="titulo-nueva-visita" class="titulo-seccion">Registrar una visita</h2>

      <form class="max-w-2xl space-y-5" novalidate @submit="guardar">
        <div class="grid gap-4 sm:grid-cols-2">
          <CampoFormulario
            id="visita-nombre"
            v-slot="{ control }"
            etiqueta="Nombre"
            :error="errors.nombre ?? delServidor.nombre"
          >
            <Input
              v-bind="{ ...control, ...nombreAttrs }"
              v-model="nombre"
              autocomplete="off"
              required
            />
          </CampoFormulario>

          <CampoFormulario
            id="visita-motivo"
            v-slot="{ control }"
            etiqueta="Motivo"
            :error="errors.motivo ?? delServidor.motivo"
          >
            <Select :model-value="motivo" @update:model-value="elegirMotivo">
              <SelectTrigger v-bind="control" class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opcion in MOTIVOS_VISITA"
                  :key="opcion"
                  :value="opcion"
                >
                  {{ NOMBRE_MOTIVO[opcion] }}
                </SelectItem>
              </SelectContent>
            </Select>
          </CampoFormulario>

          <CampoFormulario
            id="visita-invitadoPor"
            v-slot="{ control }"
            etiqueta="Invitado por"
            :opcional="motivo !== 'acompanante'"
            ayuda="Número de socio o CI de quien lo trae."
            :error="errors.invitadoPor ?? delServidor.invitadoPor"
          >
            <Input
              v-bind="{ ...control, ...invitadoPorAttrs }"
              :model-value="invitadoPor ?? ''"
              inputmode="numeric"
              autocomplete="off"
              @update:model-value="invitadoPor = String($event)"
            />
          </CampoFormulario>

          <CampoFormulario
            id="visita-telefono"
            v-slot="{ control }"
            etiqueta="Teléfono"
            opcional
            :error="errors.telefono ?? delServidor.telefono"
          >
            <Input
              v-bind="{ ...control, ...telefonoAttrs }"
              :model-value="telefono ?? ''"
              type="tel"
              inputmode="tel"
              autocomplete="off"
              @update:model-value="telefono = String($event)"
            />
          </CampoFormulario>

          <CampoFormulario
            id="visita-nota"
            v-slot="{ control }"
            etiqueta="Nota"
            opcional
            :error="errors.nota ?? delServidor.nota"
            class="sm:col-span-2"
          >
            <Input
              v-bind="{ ...control, ...notaAttrs }"
              :model-value="nota ?? ''"
              autocomplete="off"
              @update:model-value="nota = String($event)"
            />
          </CampoFormulario>
        </div>

        <p v-if="aviso" role="alert" class="text-destructive text-sm">{{ aviso }}</p>

        <div class="flex flex-wrap items-center gap-3">
          <Button type="submit" :disabled="registrar.isPending.value">
            {{ registrar.isPending.value ? 'Registrando…' : 'Registrar visita' }}
          </Button>
          <p v-if="confirmacion" role="status" class="text-sm">{{ confirmacion }}</p>
        </div>
      </form>
    </section>

    <section aria-labelledby="titulo-visitas" class="space-y-4">
      <h2 id="titulo-visitas" class="titulo-seccion">Últimos 30 días</h2>

      <ErrorDeCarga
        v-if="error && !data"
        titulo="No se pudieron cargar las visitas"
        :mensaje="error.message"
        :reintentando="isFetching"
        @reintentar="refetch()"
      />

      <template v-else-if="data">
        <div v-if="data.visitas.length > 0" class="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-28">Fecha</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead class="w-40">Motivo</TableHead>
                <TableHead>Invitado por</TableHead>
                <TableHead>Nota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="visita in data.visitas" :key="visita.id" class="h-11">
                <TableCell class="tabular-nums">{{
                  formatearFecha(visita.fecha)
                }}</TableCell>
                <TableCell class="font-medium">
                  {{ visita.nombre }}
                  <span
                    v-if="visita.telefono"
                    class="text-muted-foreground font-normal tabular-nums"
                  >
                    · {{ visita.telefono }}
                  </span>
                </TableCell>
                <TableCell>{{ NOMBRE_MOTIVO[visita.motivo] }}</TableCell>
                <TableCell>
                  <template v-if="visita.anfitrion">
                    {{ visita.anfitrion.nombreCompleto }}
                    <span class="text-muted-foreground tabular-nums">
                      · nº {{ visita.anfitrion.nroSocio }}
                    </span>
                  </template>
                  <template v-else>—</template>
                </TableCell>
                <TableCell class="whitespace-normal">{{ visita.nota ?? '—' }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <p v-else class="text-muted-foreground text-sm">
          No hubo visitas en los últimos 30 días.
        </p>
      </template>
    </section>
  </div>
</template>
