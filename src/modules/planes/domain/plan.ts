/**
 * CAPA DOMAIN — reglas para administrar planes, precios y promociones.
 *
 * Qué precio se cobra un día dado NO se decide acá: eso es `resolverPrecio`
 * (módulo membresias). Acá se decide qué se puede CARGAR.
 *
 * Las dos reglas que sostienen el historial:
 *   - Un precio nunca se edita. Para cambiarlo se agrega otro, con la fecha
 *     desde la que rige. El anterior queda, y los reportes viejos siguen bien.
 *   - Un precio solo se puede quitar si todavía no empezó a regir y nadie
 *     compró con él. Es para deshacer un error de carga, no para reescribir
 *     lo que ya pasó.
 */

import { ReglaDeNegocioError } from '@/lib/errors';
import { type FechaISO, esAnterior, esFechaISO } from '@/lib/fechas';

const DIAS_MAXIMOS = 3650; // diez años: más que eso es un error de tipeo

export interface DatosPlan {
  nombre: string;
  diasDuracion: number;
  esPaseDiario: boolean;
}

export function validarNombreDePlan(entrada: string): string {
  const nombre = entrada.trim();
  if (nombre.length < 2) {
    throw new ReglaDeNegocioError('El nombre del plan es obligatorio', {
      campo: 'nombre',
    });
  }
  return nombre;
}

export function prepararPlan(datos: DatosPlan): DatosPlan {
  const nombre = validarNombreDePlan(datos.nombre);

  if (
    !Number.isInteger(datos.diasDuracion) ||
    datos.diasDuracion < 1 ||
    datos.diasDuracion > DIAS_MAXIMOS
  ) {
    throw new ReglaDeNegocioError(
      `La duración tiene que ser un número de días entre 1 y ${DIAS_MAXIMOS}`,
      { campo: 'diasDuracion' },
    );
  }

  // Un pase por sesión vale el día que se paga. Uno de varios días sería una
  // membresía corta, y esa sí encadena y sí cuenta como socio.
  if (datos.esPaseDiario && datos.diasDuracion !== 1) {
    throw new ReglaDeNegocioError('Un pase por sesión dura 1 día', {
      campo: 'diasDuracion',
    });
  }

  return { nombre, diasDuracion: datos.diasDuracion, esPaseDiario: datos.esPaseDiario };
}

export interface DatosPrecio {
  precioCentavos: number;
  vigenteDesde: string;
  /** Solo las promociones tienen fecha de fin. */
  vigenteHasta?: string | null;
  esPromocion: boolean;
  etiqueta?: string | null;
}

export interface PrecioNormalizado {
  precioCentavos: number;
  vigenteDesde: FechaISO;
  vigenteHasta: FechaISO | null;
  esPromocion: boolean;
  etiqueta: string | null;
}

export function prepararPrecio(datos: DatosPrecio, hoy: FechaISO): PrecioNormalizado {
  if (!Number.isInteger(datos.precioCentavos) || datos.precioCentavos <= 0) {
    throw new ReglaDeNegocioError('El precio tiene que ser mayor que cero', {
      campo: 'precioCentavos',
    });
  }

  const desde = datos.vigenteDesde?.trim() ?? '';
  if (!esFechaISO(desde)) {
    throw new ReglaDeNegocioError('Indicá desde qué fecha rige', {
      campo: 'vigenteDesde',
    });
  }
  // Un precio con fecha pasada reescribiría "cuánto costaba" en días que ya
  // se cobraron con otro precio.
  if (esAnterior(desde, hoy)) {
    throw new ReglaDeNegocioError(
      'La fecha desde la que rige no puede ser anterior a hoy',
      {
        campo: 'vigenteDesde',
      },
    );
  }

  if (!datos.esPromocion) {
    return {
      precioCentavos: datos.precioCentavos,
      vigenteDesde: desde,
      vigenteHasta: null,
      esPromocion: false,
      etiqueta: null,
    };
  }

  const hasta = datos.vigenteHasta?.trim() ?? '';
  if (!esFechaISO(hasta)) {
    throw new ReglaDeNegocioError('Una promoción necesita fecha de fin', {
      campo: 'vigenteHasta',
    });
  }
  if (esAnterior(hasta, desde)) {
    throw new ReglaDeNegocioError('La promoción no puede terminar antes de empezar', {
      campo: 'vigenteHasta',
    });
  }

  const etiqueta = datos.etiqueta?.trim() ?? '';
  if (etiqueta.length < 2) {
    throw new ReglaDeNegocioError(
      'Ponele un nombre a la promoción: es lo que se ve al cobrar',
      { campo: 'etiqueta' },
    );
  }

  return {
    precioCentavos: datos.precioCentavos,
    vigenteDesde: desde,
    vigenteHasta: hasta,
    esPromocion: true,
    etiqueta,
  };
}

export type EstadoDePrecio = 'vigente' | 'futuro' | 'terminado';

/** En qué momento está un precio: ya pasó, rige hoy, o todavía no empezó. */
export function estadoDePrecio(
  precio: { vigenteDesde: FechaISO; vigenteHasta: FechaISO | null },
  hoy: FechaISO,
): EstadoDePrecio {
  if (esAnterior(hoy, precio.vigenteDesde)) return 'futuro';
  if (precio.vigenteHasta !== null && esAnterior(precio.vigenteHasta, hoy))
    return 'terminado';
  return 'vigente';
}

/** Solo se quita lo que todavía no empezó a regir y nadie usó. */
export function sePuedeQuitar(
  precio: { vigenteDesde: FechaISO; vigenteHasta: FechaISO | null },
  hoy: FechaISO,
  usadoEnVentas: boolean,
): boolean {
  return !usadoEnVentas && estadoDePrecio(precio, hoy) === 'futuro';
}
