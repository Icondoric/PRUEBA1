<script setup lang="ts">
/**
 * Mi cuenta: quién soy y cambiar mi contraseña. De cualquiera que haya
 * entrado; no pide ningún acceso.
 */
import { nextTick, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useForm } from 'vee-validate';
import { miPasswordSchema } from '@/modules/usuarios/contrato';
import CampoFormulario from '@/web/shared/components/CampoFormulario.vue';
import { ErrorDeApi } from '@/web/shared/lib/api';
import { esquemaDeFormulario, useErroresDelServidor } from '@/web/shared/lib/validacion';
import { Button } from '@/web/shared/ui/button';
import { Input } from '@/web/shared/ui/input';
import { useAccesos, useCambiarMiPassword } from '../api/sesion.api';

const router = useRouter();
const { usuario, esDueno } = useAccesos();
const cambiar = useCambiarMiPassword();

const { handleSubmit, defineField, errors, values } = useForm({
  validationSchema: esquemaDeFormulario(miPasswordSchema),
  initialValues: { actual: '', nueva: '' },
});
// Los errores que devuelve el servidor van aparte: ver useErroresDelServidor.
const { delServidor, ponerError } = useErroresDelServidor(values);
const alSalir = (estado: { errors: string[] }) => ({
  validateOnBlur: true,
  validateOnModelUpdate: estado.errors.length > 0,
});
const [actual, actualAttrs] = defineField('actual', alSalir);
const [nueva, nuevaAttrs] = defineField('nueva', alSalir);

const aviso = ref('');

async function enfocar(campo: 'actual' | 'nueva') {
  await nextTick();
  document.getElementById(`cuenta-${campo}`)?.focus();
}

const guardar = handleSubmit(
  async (valores) => {
    aviso.value = '';
    try {
      await cambiar.mutateAsync(valores);
    } catch (error) {
      const campo = error instanceof ErrorDeApi ? error.detalles.campo : null;
      if (error instanceof ErrorDeApi && (campo === 'actual' || campo === 'password')) {
        // El dominio llama "password" a la nueva.
        const cual = campo === 'actual' ? 'actual' : 'nueva';
        ponerError(cual, error.message);
        void enfocar(cual);
      } else {
        aviso.value =
          error instanceof ErrorDeApi
            ? error.message
            : 'No se pudo cambiar. Revisá que el sistema esté encendido.';
      }
      return;
    }
    // Se cerraron todas las sesiones de la cuenta: a entrar con la nueva.
    await router.replace({ name: 'ingresar' });
  },
  ({ errors: invalidos }) => void enfocar(invalidos.actual ? 'actual' : 'nueva'),
);
</script>

<template>
  <div class="max-w-md space-y-8">
    <div class="space-y-1">
      <h1 tabindex="-1" class="titulo-pantalla">Mi cuenta</h1>
      <p v-if="usuario" class="text-muted-foreground text-sm">
        {{ usuario.nombre }} · usuario {{ usuario.usuario }} ·
        {{ esDueno ? 'Dueño' : 'Recepción' }}
      </p>
    </div>

    <section aria-labelledby="titulo-mi-password" class="space-y-4">
      <h2 id="titulo-mi-password" class="titulo-seccion">Cambiar mi contraseña</h2>
      <p class="text-muted-foreground text-sm">
        Al cambiarla se cierra tu sesión en todos lados y volvés a entrar con la nueva.
      </p>

      <form class="space-y-4" novalidate @submit="guardar">
        <CampoFormulario
          id="cuenta-actual"
          v-slot="{ control }"
          etiqueta="Contraseña actual"
          :error="errors.actual ?? delServidor.actual"
        >
          <Input
            v-bind="{ ...control, ...actualAttrs }"
            v-model="actual"
            type="password"
            autocomplete="current-password"
          />
        </CampoFormulario>

        <CampoFormulario
          id="cuenta-nueva"
          v-slot="{ control }"
          etiqueta="Contraseña nueva"
          ayuda="8 caracteres o más."
          :error="errors.nueva ?? delServidor.nueva"
        >
          <Input
            v-bind="{ ...control, ...nuevaAttrs }"
            v-model="nueva"
            type="password"
            autocomplete="new-password"
          />
        </CampoFormulario>

        <p v-if="aviso" role="alert" class="text-destructive text-sm">{{ aviso }}</p>

        <Button type="submit" :disabled="cambiar.isPending.value">
          {{ cambiar.isPending.value ? 'Cambiando…' : 'Cambiar contraseña' }}
        </Button>
      </form>
    </section>
  </div>
</template>
