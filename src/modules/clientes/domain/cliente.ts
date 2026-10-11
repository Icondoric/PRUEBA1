/**
 * CAPA DOMAIN — reglas puras de clientes.
 *
 * Sin base de datos, sin Hono, sin Zod, sin reloj. Todo entra por parámetro.
 * Si acá aparece un `import` de drizzle o de hono, la capa está mal.
 */

import { ReglaDeNegocioError } from '@/lib/errors';

export type TipoCliente = 'socio' | 'eventual';

/**
 * Normaliza lo que teclea recepción: CI, nro de socio, o un CI con puntos.
 * El check-in y la búsqueda DEBEN usar esto, o "1.234.567" y "1234567" van a
 * ser dos personas distintas.
 */
export function normalizarIdentificador(entrada: string): string {
  return entrada.trim().replace(/[.\s-]/g, '').toUpperCase();
}

/** Nombre visible. El apellido es opcional (pases por sesión). */
export function nombreCompleto(c: { nombre: string; apellido?: string | null }): string {
  return c.apellido ? `${c.nombre} ${c.apellido}` : c.nombre;
}

/**
 * Socio vs eventual se DERIVA del historial, no se guarda.
 * Igual que "vencido": un campo guardado se desactualiza y miente.
 */
export function tipoCliente(
  membresias: ReadonlyArray<{ esPaseDiario: boolean }>,
): TipoCliente {
  return membresias.some((m) => !m.esPaseDiario) ? 'socio' : 'eventual';
}

export interface DatosNuevoCliente {
  nombre: string;
  apellido?: string | null;
  ci?: string | null;
  ciExtension?: string | null;
  telefono?: string | null;
}

export interface ClienteNormalizado {
  nombre: string;
  apellido: string | null;
  ci: string | null;
  ciExtension: string | null;
  telefono: string | null;
}

const EXTENSIONES = ['LP', 'CB', 'SC', 'OR', 'PT', 'TJ', 'CH', 'BE', 'PD'];

/**
 * Valida y normaliza los datos de alta.
 *
 * Solo el nombre es obligatorio: un pase por sesión se vende con el nombre y
 * nada más. Si le exigimos CI y teléfono a alguien que paga Bs 20 por entrenar
 * una vez, recepción va a cargar "Juan 00000000" y el dato pierde todo valor.
 */
export function prepararAlta(datos: DatosNuevoCliente): ClienteNormalizado {
  const nombre = datos.nombre?.trim() ?? '';
  if (nombre.length < 2) {
    throw new ReglaDeNegocioError('El nombre es obligatorio', { campo: 'nombre' });
  }

  const ci = datos.ci?.trim() ? normalizarIdentificador(datos.ci) : null;

  if (ci !== null && !/^\d{4,12}$/.test(ci)) {
    throw new ReglaDeNegocioError('El CI debe tener entre 4 y 12 dígitos', {
      campo: 'ci',
    });
  }

  // La extensión solo tiene sentido si hay CI.
  let ciExtension: string | null = null;
  if (ci !== null) {
    ciExtension = (datos.ciExtension ?? 'LP').trim().toUpperCase();
    if (!EXTENSIONES.includes(ciExtension)) {
      throw new ReglaDeNegocioError(`Extensión de CI desconocida: ${ciExtension}`, {
        campo: 'ciExtension',
        validas: EXTENSIONES,
      });
    }
  }

  return {
    nombre,
    apellido: datos.apellido?.trim() || null,
    ci,
    ciExtension,
    telefono: datos.telefono?.trim() || null,
  };
}

/** El siguiente número de carnet. Correlativo y sin huecos reutilizados. */
export function siguienteNroSocio(maximoActual: number | null): number {
  return (maximoActual ?? 0) + 1;
}
