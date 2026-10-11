/**
 * API PÚBLICA del módulo checkin.
 *
 * Por ahora solo expone la regla pura de acceso. Cuando se construyan las
 * otras tres capas, acá se agrega `moduloCheckin(db)` igual que en clientes.
 */

export type { ResultadoAcceso, SocioParaAcceso, Veredicto } from './domain/acceso';
export { DIAS_AVISO_VENCIMIENTO, evaluarAcceso } from './domain/acceso';
