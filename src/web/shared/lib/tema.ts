/**
 * Modo claro u oscuro.
 *
 * El de fábrica es el oscuro: el logo es oscuro, el gimnasio tiene poca luz y
 * el check-in está encendido todo el día. La elección se guarda en este
 * navegador; si no hay nada guardado, oscuro.
 *
 * La clase `.dark` de <html> la pone primero `index.html`, antes de pintar,
 * para que no parpadee en blanco. La clave de abajo tiene que ser la misma.
 */
import { readonly, ref } from 'vue';

export type Tema = 'oscuro' | 'claro';

const CLAVE = 'gym-tema';

function leer(): Tema {
  try {
    return localStorage.getItem(CLAVE) === 'claro' ? 'claro' : 'oscuro';
  } catch {
    // Sin almacenamiento (modo privado estricto): vale el de fábrica.
    return 'oscuro';
  }
}

const tema = ref<Tema>(leer());

function aplicar(nuevo: Tema) {
  document.documentElement.classList.toggle('dark', nuevo === 'oscuro');
}

aplicar(tema.value);

function alternar() {
  tema.value = tema.value === 'oscuro' ? 'claro' : 'oscuro';
  aplicar(tema.value);
  try {
    localStorage.setItem(CLAVE, tema.value);
  } catch {
    // No se pudo guardar: el cambio vale hasta cerrar la pestaña.
  }
}

export function useTema() {
  return { tema: readonly(tema), alternar };
}
