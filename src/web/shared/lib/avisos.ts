/**
 * Avisos: la confirmación breve de que algo se hizo ("Pago anulado.").
 *
 * Para qué sí: confirmar una acción que ya terminó bien y cuyo resultado no
 * queda a la vista donde se hizo (se cerró un diálogo, se cambió de pantalla).
 * Para qué no: errores de un formulario (van al lado del campo) ni nada que la
 * persona tenga que leer sí o sí: un aviso se va solo.
 *
 * No es estado del servidor: es de la interfaz y vive solo en esta pestaña.
 */
import { readonly, ref } from 'vue';

export type TipoDeAviso = 'exito' | 'error';

export interface Aviso {
  id: number;
  tipo: TipoDeAviso;
  texto: string;
}

/** Cuánto queda a la vista. El de error dura más: hay que alcanzar a leerlo. */
const SEGUNDOS: Record<TipoDeAviso, number> = { exito: 5, error: 9 };
const MAXIMO_A_LA_VEZ = 3;

const lista = ref<Aviso[]>([]);
const relojes = new Map<number, ReturnType<typeof setTimeout>>();
let siguiente = 1;

function quitar(id: number) {
  clearTimeout(relojes.get(id));
  relojes.delete(id);
  lista.value = lista.value.filter((aviso) => aviso.id !== id);
}

function programar(aviso: Aviso) {
  clearTimeout(relojes.get(aviso.id));
  relojes.set(
    aviso.id,
    setTimeout(() => quitar(aviso.id), SEGUNDOS[aviso.tipo] * 1000),
  );
}

function mostrar(tipo: TipoDeAviso, texto: string) {
  const aviso: Aviso = { id: siguiente++, tipo, texto };
  lista.value = [...lista.value, aviso];
  programar(aviso);

  // Si se acumulan, se va el más viejo: tres a la vez ya es mucho para leer.
  const sobrante = lista.value.length - MAXIMO_A_LA_VEZ;
  const masViejo = lista.value[0];
  if (sobrante > 0 && masViejo) quitar(masViejo.id);
}

/** Mientras el mouse o el foco están encima, el aviso no se va. */
function pausar(id: number) {
  clearTimeout(relojes.get(id));
}

function reanudar(id: number) {
  const aviso = lista.value.find((uno) => uno.id === id);
  if (aviso) programar(aviso);
}

export const avisos = {
  exito: (texto: string) => mostrar('exito', texto),
  error: (texto: string) => mostrar('error', texto),
};

/**
 * Un formulario que al guardar vuelve a otra pantalla deja su mensaje en el
 * estado de la navegación (`router.replace({ state: { aviso } })`). Acá se
 * muestra y se borra de ahí, para que no reaparezca al recargar o al volver.
 */
export function avisarLoQueDejoLaNavegacion() {
  const estado: unknown = history.state;
  if (typeof estado !== 'object' || estado === null || !('aviso' in estado)) return;

  const { aviso, ...resto } = estado;
  if (typeof aviso === 'string' && aviso) avisos.exito(aviso);
  history.replaceState(resto, '');
}

export function useAvisos() {
  return { lista: readonly(lista), quitar, pausar, reanudar };
}
