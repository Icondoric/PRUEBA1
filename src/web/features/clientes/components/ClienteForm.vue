<script setup lang="ts">
/**
 * Formulario de alta y edición de un cliente.
 *
 * Valida la FORMA con `clienteInputSchema`, el mismo esquema de la ruta. Las
 * reglas (el CI tiene 4 a 12 dígitos, ese CI ya es de otro) las decide el
 * servidor: su respuesta se muestra en el campo que corresponde.
 *
 * Cuándo se valida: al salir del campo, no mientras se escribe. Una vez que un
 * campo tiene error, se revalida en cada tecla para que el error desaparezca
 * apenas se corrige.
 */
import { nextTick, ref, watch } from 'vue';
import { useForm } from 'vee-validate';
import { EXTENSIONES, clienteInputSchema } from '@/modules/clientes';
import CampoFormulario from '@/web/shared/components/CampoFormulario.vue';
import type { ErrorDeApi } from '@/web/shared/lib/api';
import { plural } from '@/web/shared/lib/formato';
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
import type { DatosCliente } from '../api/clientes.api';

const props = defineProps<{
  inicial?: Partial<DatosCliente>;
  textoGuardar: string;
  guardando: boolean;
  /** El error que devolvió el servidor al guardar, si hubo. */
  error: ErrorDeApi | null;
}>();

const emit = defineEmits<{ guardar: [datos: DatosCliente]; cancelar: [] }>();

// Las extensiones válidas vienen del dominio (`EXTENSIONES`). Esto es solo el
// nombre que se muestra al lado; si falta uno, se ve el código pelado.
const DEPARTAMENTOS: Record<string, string> = {
  LP: 'La Paz',
  CB: 'Cochabamba',
  SC: 'Santa Cruz',
  OR: 'Oruro',
  PT: 'Potosí',
  TJ: 'Tarija',
  CH: 'Chuquisaca',
  BE: 'Beni',
  PD: 'Pando',
};

// En el orden en que aparecen: así se elige el primer campo con error.
const CAMPOS = ['nombre', 'apellido', 'ci', 'ciExtension', 'telefono'] as const;
type Campo = (typeof CAMPOS)[number];
const esCampo = (valor: unknown): valor is Campo => CAMPOS.some((c) => c === valor);

const { handleSubmit, defineField, errors, values } = useForm({
  validationSchema: esquemaDeFormulario(clienteInputSchema),
  initialValues: {
    nombre: props.inicial?.nombre ?? '',
    apellido: props.inicial?.apellido ?? '',
    ci: props.inicial?.ci ?? '',
    ciExtension: props.inicial?.ciExtension ?? 'LP',
    telefono: props.inicial?.telefono ?? '',
  },
});
// Los errores que devuelve el servidor van aparte: ver useErroresDelServidor.
const { delServidor, ponerError } = useErroresDelServidor(values);

const alSalir = (estado: { errors: string[] }) => ({
  validateOnBlur: true,
  validateOnModelUpdate: estado.errors.length > 0,
});

const [nombre, nombreAttrs] = defineField('nombre', alSalir);
const [apellido, apellidoAttrs] = defineField('apellido', alSalir);
const [ci, ciAttrs] = defineField('ci', alSalir);
const [ciExtension] = defineField('ciExtension', alSalir);
const [telefono, telefonoAttrs] = defineField('telefono', alSalir);

/** Se anuncia a lectores de pantalla y se muestra sobre los botones. */
const aviso = ref('');

async function enfocar(campo: Campo) {
  await nextTick();
  document.getElementById(`cliente-${campo}`)?.focus();
}

const enviar = handleSubmit(
  (valores) => {
    aviso.value = '';
    emit('guardar', valores);
  },
  ({ errors: invalidos }) => {
    const conError = CAMPOS.filter((c) => invalidos[c]);
    aviso.value = `Hay ${plural(conError.length, 'campo', 'campos')} para revisar.`;
    if (conError[0]) void enfocar(conError[0]);
  },
);

watch(
  () => props.error,
  (error) => {
    if (!error) return;

    // El dominio dice qué campo falló; un CI repetido siempre es el campo CI.
    const campo = error.codigo === 'CONFLICTO' ? 'ci' : error.detalles.campo;
    if (esCampo(campo)) {
      ponerError(campo, error.message);
      aviso.value = '';
      void enfocar(campo);
    } else {
      aviso.value = error.message;
    }
  },
);
</script>

<template>
  <form class="max-w-xl space-y-6" novalidate @submit="enviar">
    <div class="grid gap-4 sm:grid-cols-2">
      <CampoFormulario
        id="cliente-nombre"
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
        id="cliente-apellido"
        v-slot="{ control }"
        etiqueta="Apellido"
        opcional
        :error="errors.apellido ?? delServidor.apellido"
      >
        <Input
          v-bind="{ ...control, ...apellidoAttrs }"
          :model-value="apellido ?? ''"
          autocomplete="off"
          @update:model-value="apellido = String($event)"
        />
      </CampoFormulario>

      <CampoFormulario
        id="cliente-ci"
        v-slot="{ control }"
        etiqueta="CI"
        opcional
        ayuda="Solo números, entre 4 y 12 dígitos. Dejalo vacío si es menor de edad."
        :error="errors.ci ?? delServidor.ci"
      >
        <Input
          v-bind="{ ...control, ...ciAttrs }"
          :model-value="ci ?? ''"
          inputmode="numeric"
          autocomplete="off"
          @update:model-value="ci = String($event)"
        />
      </CampoFormulario>

      <CampoFormulario
        id="cliente-ciExtension"
        v-slot="{ control }"
        etiqueta="Extensión del CI"
        :error="errors.ciExtension ?? delServidor.ciExtension"
      >
        <Select
          :model-value="ciExtension ?? 'LP'"
          @update:model-value="ciExtension = String($event)"
        >
          <SelectTrigger v-bind="control" class="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="codigo in EXTENSIONES" :key="codigo" :value="codigo">
              {{
                DEPARTAMENTOS[codigo] ? `${codigo} — ${DEPARTAMENTOS[codigo]}` : codigo
              }}
            </SelectItem>
          </SelectContent>
        </Select>
      </CampoFormulario>

      <CampoFormulario
        id="cliente-telefono"
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
    </div>

    <p v-if="aviso" role="alert" class="text-destructive text-sm">{{ aviso }}</p>

    <div class="flex gap-2">
      <Button type="submit" :disabled="guardando">
        {{ guardando ? 'Guardando…' : textoGuardar }}
      </Button>
      <Button type="button" variant="outline" @click="emit('cancelar')">Cancelar</Button>
    </div>
  </form>
</template>
