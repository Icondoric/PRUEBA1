/**
 * API PÚBLICA del módulo membresias.
 *
 * Por ahora solo expone las reglas puras del dominio. Cuando se construyan las
 * otras tres capas, acá se agrega `moduloMembresias(db)` igual que en clientes.
 */

export type { EntradaRenovacion, PeriodoMembresia } from './domain/renovacion';
export { calcularPeriodo } from './domain/renovacion';
export type { PrecioResuelto, PrecioVigencia } from './domain/precios';
export { SinPrecioVigenteError, precioBase, resolverPrecio } from './domain/precios';
