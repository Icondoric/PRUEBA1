<script setup lang="ts">
/**
 * Pantalla de ingreso. Lo único que se ve sin haber iniciado sesión.
 */
import { computed, nextTick, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useForm } from 'vee-validate';
import { loginInputSchema } from '@/modules/usuarios/contrato';
import CampoFormulario from '@/web/shared/components/CampoFormulario.vue';
import InterruptorDeTema from '@/web/shared/components/InterruptorDeTema.vue';
import { ErrorDeApi } from '@/web/shared/lib/api';
import { esquemaDeFormulario } from '@/web/shared/lib/validacion';
import { Button } from '@/web/shared/ui/button';
import { Input } from '@/web/shared/ui/input';
import { useIniciarSesion } from '../api/sesion.api';

const route = useRoute();
const router = useRouter();
const iniciar = useIniciarSesion();

const { handleSubmit, defineField, errors } = useForm({
  validationSchema: esquemaDeFormulario(loginInputSchema),
  initialValues: { usuario: '', password: '' },
});

// Acá no se valida al salir del campo: con dos campos, alcanza al enviar.
const alEnviar = (estado: { errors: string[] }) => ({
  validateOnBlur: false,
  validateOnModelUpdate: estado.errors.length > 0,
});
const [usuario, usuarioAttrs] = defineField('usuario', alEnviar);
const [password, passwordAttrs] = defineField('password', alEnviar);

const aviso = ref('');

const seCerroSola = computed(() => route.query.motivo === 'vencida');

async function enfocar(campo: 'usuario' | 'password') {
  await nextTick();
  document.getElementById(`ingreso-${campo}`)?.focus();
}

const entrar = handleSubmit(
  async (valores) => {
    aviso.value = '';
    try {
      await iniciar.mutateAsync(valores);
    } catch (error) {
      aviso.value =
        error instanceof ErrorDeApi
          ? error.message
          : 'No se pudo entrar. Revisá que el sistema esté encendido.';
      // La contraseña se vuelve a escribir; el usuario queda.
      password.value = '';
      void enfocar('password');
      return;
    }

    // Vuelve a donde estaba, si venía de una pantalla del sistema.
    const volver = typeof route.query.volver === 'string' ? route.query.volver : '';
    await router.replace(
      volver.startsWith('/') && !volver.startsWith('//') ? volver : '/',
    );
  },
  ({ errors: invalidos }) => {
    void enfocar(invalidos.usuario ? 'usuario' : 'password');
  },
);
</script>

<template>
  <main
    class="relative flex min-h-dvh items-center justify-center bg-[radial-gradient(60rem_32rem_at_50%_-10%,color-mix(in_oklab,var(--primary)_16%,transparent),transparent_70%)] px-4 py-10"
  >
    <div
      class="bg-card text-card-foreground w-full max-w-sm space-y-6 rounded-xl border p-8"
    >
      <!-- Lugar del logo: cuando exista, reemplaza a la inicial. -->
      <div
        class="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-lg text-xl font-bold"
        aria-hidden="true"
      >
        G
      </div>

      <div class="space-y-1">
        <h1 tabindex="-1" class="titulo-pantalla">Gimnasio</h1>
        <p class="text-muted-foreground text-sm">Ingresá con tu usuario y contraseña.</p>
      </div>

      <p
        v-if="seCerroSola && !aviso"
        role="status"
        class="rounded-md border px-3 py-2 text-sm"
      >
        Tu sesión se cerró por inactividad. Volvé a ingresar.
      </p>

      <form class="space-y-4" novalidate @submit="entrar">
        <CampoFormulario
          id="ingreso-usuario"
          v-slot="{ control }"
          etiqueta="Usuario"
          :error="errors.usuario"
        >
          <Input
            v-bind="{ ...control, ...usuarioAttrs }"
            v-model="usuario"
            autocomplete="username"
            autocapitalize="off"
            spellcheck="false"
            autofocus
          />
        </CampoFormulario>

        <CampoFormulario
          id="ingreso-password"
          v-slot="{ control }"
          etiqueta="Contraseña"
          :error="errors.password"
        >
          <Input
            v-bind="{ ...control, ...passwordAttrs }"
            v-model="password"
            type="password"
            autocomplete="current-password"
          />
        </CampoFormulario>

        <p v-if="aviso" role="alert" class="text-destructive text-sm">{{ aviso }}</p>

        <Button type="submit" class="w-full" :disabled="iniciar.isPending.value">
          {{ iniciar.isPending.value ? 'Ingresando…' : 'Ingresar' }}
        </Button>
      </form>

      <p class="text-muted-foreground text-xs">
        ¿Olvidaste tu contraseña? Pedile al dueño que te ponga una nueva.
      </p>
    </div>

    <!-- Después del formulario en el orden de tabulación: primero se ingresa. -->
    <InterruptorDeTema class="absolute top-4 right-4" />
  </main>
</template>
