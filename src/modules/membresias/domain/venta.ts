/**
 * CAPA DOMAIN — cotización de una venta de membresía.
 *
 * Junta las dos reglas que ya existen: `calcularPeriodo` (desde cuándo corre) y
 * `resolverPrecio` (cuánto cuesta hoy). No decide nada nuevo sobre fechas ni
 * montos: solo valida que la venta tenga sentido y arma el resultado.
 *
 * La pantalla muestra esta cotización ANTES de confirmar, y la venta la vuelve
 * a calcular en el servidor con la misma función. El precio nunca viaja desde
 * el navegador.
 */

import { ReglaDeNegocioError } from '@/lib/errors';
import { type FechaISO, diasEntre, esAnterior, esFechaISO } from '@/lib/fechas';
import { type PrecioResuelto, type PrecioVigencia, resolverPrecio } from './precios';
import { type PeriodoMembresia, calcularPeriodo } from './renovacion';

/**
 * Cuánto se puede adelantar el inicio. "Arranca el lunes" es normal; un año
 * entero ya es un error de tipeo, y una fecha lejanísima dejaría al cliente
 * con una membresía que tapa todas las renovaciones que vengan después.
 */
export const DIAS_MAXIMOS_DE_ANTICIPO = 365;

export interface PlanParaVenta {
  id: number;
  nombre: string;
  diasDuracion: number;
  esPaseDiario: boolean;
  activo: boolean;
}

export interface EntradaCotizacion {
  hoy: FechaISO;
  plan: PlanParaVenta;
  /** Todas las filas de precio del plan; la vigente la elige `resolverPrecio`. */
  precios: PrecioVigencia[];
  /** fecha_fin de la última membresía no cancelada del cliente. null si no tiene. */
  fechaFinAnterior: FechaISO | null;
  /** "Arranca el lunes". Solo planes que no son pase, y de hoy en adelante. */
  inicioForzado?: FechaISO | null;
}

export interface Cotizacion {
  periodo: PeriodoMembresia;
  precio: PrecioResuelto;
}

export function cotizarVenta(entrada: EntradaCotizacion): Cotizacion {
  const { hoy, plan, precios, fechaFinAnterior } = entrada;
  const inicioForzado = entrada.inicioForzado?.trim() || null;

  if (!plan.activo) {
    throw new ReglaDeNegocioError(`El plan ${plan.nombre} ya no se vende`, {
      campo: 'planId',
    });
  }

  if (inicioForzado !== null) {
    if (plan.esPaseDiario) {
      throw new ReglaDeNegocioError(
        'Un pase por sesión vale el día que se paga: no se le puede elegir otra fecha',
        { campo: 'inicio' },
      );
    }
    if (!esFechaISO(inicioForzado)) {
      throw new ReglaDeNegocioError('La fecha de inicio no es una fecha válida', {
        campo: 'inicio',
      });
    }
    if (esAnterior(inicioForzado, hoy)) {
      throw new ReglaDeNegocioError('La fecha de inicio no puede ser anterior a hoy', {
        campo: 'inicio',
      });
    }
    if (diasEntre(hoy, inicioForzado) > DIAS_MAXIMOS_DE_ANTICIPO) {
      throw new ReglaDeNegocioError(
        'La fecha de inicio no puede ser más de un año después de hoy',
        { campo: 'inicio' },
      );
    }
  }

  return {
    periodo: calcularPeriodo({
      hoy,
      diasDuracion: plan.diasDuracion,
      fechaFinAnterior,
      inicioForzado,
      // Sin esto, un socio vigente que paga una sesión recibiría un pase para
      // dentro de tres semanas.
      encadenable: !plan.esPaseDiario,
    }),
    // El precio es el del día en que se paga, no el del día en que empieza.
    precio: resolverPrecio(precios, hoy, plan.id),
  };
}
