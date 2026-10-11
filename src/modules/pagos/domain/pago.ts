/**
 * CAPA DOMAIN — reglas puras de pagos.
 *
 * Un pago mal cargado no se borra ni se corrige: se ANULA, con motivo. El
 * motivo es obligatorio porque es lo único que explica, meses después, por qué
 * la caja de ese día no cierra con lo que se ve en pantalla.
 */

import { ConflictoError, ReglaDeNegocioError } from '@/lib/errors';

export const METODOS = ['efectivo', 'qr', 'transferencia', 'tarjeta'] as const;
export type Metodo = (typeof METODOS)[number];

const LARGO_MINIMO_MOTIVO = 5;

/** Valida una anulación y devuelve el motivo listo para guardar. */
export function prepararAnulacion(pago: { anulado: boolean }, motivo: string): string {
  if (pago.anulado) {
    throw new ConflictoError('Ese pago ya estaba anulado');
  }

  const limpio = motivo.trim();
  if (limpio.length < LARGO_MINIMO_MOTIVO) {
    throw new ReglaDeNegocioError('Escribí por qué se anula el pago', {
      campo: 'motivo',
    });
  }
  return limpio;
}

export interface TotalPorMetodo {
  metodo: Metodo;
  cantidad: number;
  centavos: number;
}

/**
 * Totales de caja: cuánto entró por cada método. Los anulados no suman.
 * Siempre devuelve los cuatro métodos, en el mismo orden, aunque estén en cero.
 */
export function totalesDeCaja(
  pagos: ReadonlyArray<{ metodo: Metodo; montoCentavos: number; anulado: boolean }>,
) {
  const validos = pagos.filter((p) => !p.anulado);

  const porMetodo: TotalPorMetodo[] = METODOS.map((metodo) => {
    const suyos = validos.filter((p) => p.metodo === metodo);
    return {
      metodo,
      cantidad: suyos.length,
      centavos: suyos.reduce((suma, p) => suma + p.montoCentavos, 0),
    };
  });

  return {
    porMetodo,
    totalCentavos: porMetodo.reduce((suma, t) => suma + t.centavos, 0),
    cantidad: validos.length,
    anulados: pagos.length - validos.length,
  };
}
