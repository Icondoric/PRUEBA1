/**
 * Cómo se le dice en pantalla a cada método de pago. Solo presentación: la
 * lista de métodos válidos la define el módulo de pagos.
 */

import type { Metodo } from '@/modules/pagos';

export const NOMBRE_METODO: Record<Metodo, string> = {
  efectivo: 'Efectivo',
  qr: 'QR',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
};
