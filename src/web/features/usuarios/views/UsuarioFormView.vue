<script setup lang="ts">
/**
 * Crear un usuario, o cambiarle el nombre, los accesos, la contraseña y el
 * estado a uno que ya existe. Solo la ve el dueño.
 *
 * Con `:id` en la ruta edita; sin él, crea. Cada cosa se guarda con su propio
 * botón, para que cambiar una contraseña no toque los accesos por accidente.
 */
import { ArrowLeft } from '@lucide/vue';
import { computed, nextTick, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useForm } from 'vee-validate';
import { passwordInputSchema, usuarioNuevoSchema } from '@/modules/usuarios/contrato';
import { useAccesos } from '@/web/features/sesion/api/sesion.api';
import CampoFormulario from '@/web/shared/components/CampoFormulario.vue';
import ErrorDeCarga from '@/web/shared/components/ErrorDeCarga.vue';
import { ErrorDeApi } from '@/web/shared/lib/api';
import { esquemaDeFormulario, useErroresDelServidor } from '@/web/shared/lib/validacion';
import { Badge } from '@/web/shared/ui/badge';
import { Button } from '@/web/shared/ui/button';
import { Input } from '@/web/shared/ui/input';
import {
  useActualizarUsuario,
  useCambiarPassword,
  useCrearUsuario,
  useUsuarios,
} from '../api/usuarios.api';
import AccesosPorModulo from '../components/AccesosPorModulo.vue';

const route = useRoute();
const router = useRouter();
const { usuario: yo } = useAccesos();

const id = computed(() =>
  route.name === 'usuario-editar' ? Number(route.params.id) : 0,
);
const creando = computed(() => id.value === 0);

const { data, error: errorDeCarga, isFetching, refetch } = useUsuarios();
const existente = computed(
  () => data.value?.usuarios.find((u) => u.id === id.value) ?? null,
);
const esElDueno = computed(() => existente.value?.rol === 'admin');
const noExiste = computed(() => !creando.value && !!data.value && !existente.value);

const crear = useCrearUsuario();
const actualizar = useActualizarUsuario();
const cambiarPassword = useCambiarPassword();

const mensajeDe = (error: unknown) =>
  error instanceof ErrorDeApi
    ? error.message
    : 'No se pudo guardar. Revisá que el sistema esté encendido.';

async function enfocar(idDelCampo: string) {
  await nextTick();
  document.getElementById(idDelCampo)?.focus();
}

// ── accesos (los comparten crear y editar) ──
const accesos = ref<string[]>([]);
watch(
  [existente, () => data.value?.basicos],
  ([usuario, basicos]) => {
    if (usuario) accesos.value = [...usuario.permisos];
    else if (creando.value && basicos) accesos.value = [...basicos];
  },
  { immediate: true },
);

// ── crear ──
const CAMPOS = ['nombre', 'usuario', 'password'] as const;
type Campo = (typeof CAMPOS)[number];
const esCampo = (valor: unknown): valor is Campo => CAMPOS.some((c) => c === valor);

const { handleSubmit, defineField, errors, values } = useForm({
  validationSchema: esquemaDeFormulario(usuarioNuevoSchema),
  initialValues: { usuario: '', nombre: '', password: '' },
});
// Los errores que devuelve el servidor van aparte: ver useErroresDelServidor.
const { delServidor, ponerError } = useErroresDelServidor(values);
const alSalir = (estado: { errors: string[] }) => ({
  validateOnBlur: true,
  validateOnModelUpdate: estado.errors.length > 0,
});
const [nombreNuevo, nombreNuevoAttrs] = defineField('nombre', alSalir);
const [usuarioNuevo, usuarioNuevoAttrs] = defineField('usuario', alSalir);
const [passwordNueva, passwordNuevaAttrs] = defineField('password', alSalir);

const avisoCrear = ref('');

const crearUsuario = handleSubmit(
  async (valores) => {
    avisoCrear.value = '';
    try {
      const creado = await crear.mutateAsync({ ...valores, permisos: accesos.value });
      await router.replace({
        name: 'usuarios',
        state: { aviso: `Usuario creado: ${creado.nombre} (${creado.usuario}).` },
      });
    } catch (error) {
      const campo = error instanceof ErrorDeApi ? error.detalles.campo : null;
      if (error instanceof ErrorDeApi && esCampo(campo)) {
        ponerError(campo, error.message);
        void enfocar(`usuario-${campo}`);
      } else {
        avisoCrear.value = mensajeDe(error);
      }
    }
  },
  ({ errors: invalidos }) => {
    const primero = CAMPOS.find((c) => invalidos[c]);
    if (primero) void enfocar(`usuario-${primero}`);
  },
);

// ── editar: nombre y accesos ──
const nombre = ref('');
watch(existente, (usuario) => {
  if (usuario) nombre.value = usuario.nombre;
}, { immediate: true }); // prettier-ignore

const avisoDatos = ref('');
const okDatos = ref('');

async function guardarDatos() {
  avisoDatos.value = '';
  okDatos.value = '';
  try {
    await actualizar.mutateAsync({
      id: id.value,
      cambios: esElDueno.value
        ? { nombre: nombre.value }
        : { nombre: nombre.value, permisos: accesos.value },
    });
    okDatos.value = 'Cambios guardados. Ya están aplicados.';
  } catch (error) {
    avisoDatos.value = mensajeDe(error);
  }
}

// ── editar: contraseña ──
const formPassword = useForm({
  validationSchema: esquemaDeFormulario(passwordInputSchema),
  initialValues: { password: '' },
});
const [otraPassword, otraPasswordAttrs] = formPassword.defineField('password', alSalir);
const okPassword = ref('');

const guardarPassword = formPassword.handleSubmit(
  async (valores) => {
    okPassword.value = '';
    try {
      await cambiarPassword.mutateAsync({ id: id.value, password: valores.password });
    } catch (error) {
      formPassword.setFieldError('password', mensajeDe(error));
      void enfocar('usuario-otra-password');
      return;
    }
    formPassword.resetForm();
    // Cambiar la propia cierra también esta sesión: hay que volver a entrar.
    if (existente.value?.id === yo.value?.id) {
      await router.replace({ name: 'ingresar' });
      return;
    }
    okPassword.value =
      'Contraseña cambiada. Se cerraron las sesiones abiertas de esa cuenta.';
  },
  () => void enfocar('usuario-otra-password'),
);

// ── editar: activar / desactivar ──
const avisoEstado = ref('');

async function cambiarEstado(activo: boolean) {
  avisoEstado.value = '';
  try {
    await actualizar.mutateAsync({ id: id.value, cambios: { activo } });
  } catch (error) {
    avisoEstado.value = mensajeDe(error);
  }
}
</script>

<template>
  <div class="max-w-3xl space-y-8">
    <RouterLink
      :to="{ name: 'usuarios' }"
      class="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex items-center gap-1.5 rounded-sm text-sm outline-none focus-visible:ring-3"
    >
      <ArrowLeft class="size-4" aria-hidden="true" />
      Usuarios
    </RouterLink>

    <ErrorDeCarga
      v-if="errorDeCarga && !data"
      titulo="No se pudieron cargar los datos"
      :mensaje="errorDeCarga.message"
      :reintentando="isFetching"
      @reintentar="refetch()"
    />

    <template v-else-if="noExiste">
      <h1 tabindex="-1" class="text-2xl font-semibold tracking-tight">
        No se encontró ese usuario
      </h1>
      <p class="text-muted-foreground text-sm">Volvé a la lista y elegilo desde ahí.</p>
    </template>

    <!-- ══ Crear ══ -->
    <form v-else-if="creando && data" class="space-y-8" novalidate @submit="crearUsuario">
      <h1 tabindex="-1" class="text-2xl font-semibold tracking-tight">Crear usuario</h1>

      <div class="grid max-w-xl gap-4 sm:grid-cols-2">
        <CampoFormulario
          id="usuario-nombre"
          v-slot="{ control }"
          etiqueta="Nombre y apellido"
          :error="errors.nombre ?? delServidor.nombre"
          class="sm:col-span-2"
        >
          <Input
            v-bind="{ ...control, ...nombreNuevoAttrs }"
            v-model="nombreNuevo"
            autocomplete="off"
          />
        </CampoFormulario>

        <CampoFormulario
          id="usuario-usuario"
          v-slot="{ control }"
          etiqueta="Usuario"
          ayuda="Con lo que va a entrar. Sin espacios; por ejemplo: ana.quispe"
          :error="errors.usuario ?? delServidor.usuario"
        >
          <Input
            v-bind="{ ...control, ...usuarioNuevoAttrs }"
            v-model="usuarioNuevo"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
          />
        </CampoFormulario>

        <CampoFormulario
          id="usuario-password"
          v-slot="{ control }"
          etiqueta="Contraseña"
          ayuda="8 caracteres o más. Después puede pedirte que se la cambies."
          :error="errors.password ?? delServidor.password"
        >
          <Input
            v-bind="{ ...control, ...passwordNuevaAttrs }"
            v-model="passwordNueva"
            type="password"
            autocomplete="new-password"
          />
        </CampoFormulario>
      </div>

      <section aria-labelledby="titulo-accesos" class="space-y-3">
        <h2 id="titulo-accesos" class="text-lg font-semibold tracking-tight">Accesos</h2>
        <p class="text-muted-foreground max-w-prose text-sm">
          Viene marcado lo que necesita recepción. Agregá o quitá lo que quieras; lo podés
          cambiar cuando quieras.
        </p>
        <AccesosPorModulo
          v-model="accesos"
          :catalogo="data.catalogo"
          :basicos="data.basicos"
        />
      </section>

      <p v-if="avisoCrear" role="alert" class="text-destructive text-sm">
        {{ avisoCrear }}
      </p>

      <div class="flex gap-2">
        <Button type="submit" :disabled="crear.isPending.value">
          {{ crear.isPending.value ? 'Creando…' : 'Crear usuario' }}
        </Button>
        <Button as-child variant="outline">
          <RouterLink :to="{ name: 'usuarios' }">Cancelar</RouterLink>
        </Button>
      </div>
    </form>

    <!-- ══ Editar ══ -->
    <template v-else-if="existente && data">
      <div class="space-y-2">
        <h1 tabindex="-1" class="text-2xl font-semibold tracking-tight">
          {{ existente.nombre }}
        </h1>
        <p class="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
          Usuario: {{ existente.usuario }}
          <Badge :variant="existente.activo ? 'secondary' : 'outline'">
            {{ existente.activo ? 'Activo' : 'Desactivado' }}
          </Badge>
          <Badge v-if="esElDueno" variant="outline">Dueño</Badge>
        </p>
      </div>

      <form class="space-y-6" novalidate @submit.prevent="guardarDatos">
        <CampoFormulario
          id="usuario-nombre-editar"
          v-slot="{ control }"
          etiqueta="Nombre y apellido"
          class="max-w-sm"
        >
          <Input v-bind="control" v-model="nombre" autocomplete="off" />
        </CampoFormulario>

        <section aria-labelledby="titulo-accesos" class="space-y-3">
          <h2 id="titulo-accesos" class="text-lg font-semibold tracking-tight">
            Accesos
          </h2>
          <p v-if="esElDueno" class="text-muted-foreground max-w-prose text-sm">
            El dueño tiene todos los accesos, siempre. No se le pueden quitar.
          </p>
          <AccesosPorModulo
            v-model="accesos"
            :catalogo="data.catalogo"
            :basicos="data.basicos"
            :bloqueado="esElDueno"
          />
        </section>

        <p v-if="avisoDatos" role="alert" class="text-destructive text-sm">
          {{ avisoDatos }}
        </p>

        <div class="flex flex-wrap items-center gap-3">
          <Button type="submit" :disabled="actualizar.isPending.value">
            {{ actualizar.isPending.value ? 'Guardando…' : 'Guardar cambios' }}
          </Button>
          <p v-if="okDatos" role="status" class="text-sm">{{ okDatos }}</p>
        </div>
      </form>

      <section aria-labelledby="titulo-password" class="space-y-3 border-t pt-6">
        <h2 id="titulo-password" class="text-lg font-semibold tracking-tight">
          Cambiar contraseña
        </h2>
        <p class="text-muted-foreground max-w-prose text-sm">
          Al cambiarla se cierran las sesiones abiertas de esta cuenta: tiene que volver a
          entrar con la nueva.
        </p>
        <form class="flex flex-wrap items-end gap-3" novalidate @submit="guardarPassword">
          <CampoFormulario
            id="usuario-otra-password"
            v-slot="{ control }"
            etiqueta="Contraseña nueva"
            :error="formPassword.errors.value.password"
            class="w-full max-w-xs"
          >
            <Input
              v-bind="{ ...control, ...otraPasswordAttrs }"
              v-model="otraPassword"
              type="password"
              autocomplete="new-password"
            />
          </CampoFormulario>
          <Button
            type="submit"
            variant="outline"
            :disabled="cambiarPassword.isPending.value"
          >
            {{ cambiarPassword.isPending.value ? 'Cambiando…' : 'Cambiar contraseña' }}
          </Button>
        </form>
        <p v-if="okPassword" role="status" class="text-sm">{{ okPassword }}</p>
      </section>

      <section
        v-if="!esElDueno"
        aria-labelledby="titulo-estado"
        class="space-y-3 border-t pt-6"
      >
        <h2 id="titulo-estado" class="text-lg font-semibold tracking-tight">
          {{ existente.activo ? 'Desactivar usuario' : 'Reactivar usuario' }}
        </h2>
        <p class="text-muted-foreground max-w-prose text-sm">
          <template v-if="existente.activo">
            Deja de poder entrar en el acto. No se borra: lo que registró sigue a su
            nombre, y se puede reactivar cuando quieras.
          </template>
          <template v-else>Vuelve a poder entrar, con los accesos que tenía.</template>
        </p>
        <p v-if="avisoEstado" role="alert" class="text-destructive text-sm">
          {{ avisoEstado }}
        </p>
        <Button
          type="button"
          :variant="existente.activo ? 'destructive' : 'outline'"
          :disabled="actualizar.isPending.value"
          @click="cambiarEstado(!existente.activo)"
        >
          {{ existente.activo ? 'Desactivar usuario' : 'Reactivar usuario' }}
        </Button>
      </section>
    </template>
  </div>
</template>
