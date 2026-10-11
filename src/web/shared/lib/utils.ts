import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Une clases de Tailwind resolviendo conflictos. Lo usan los componentes de shadcn-vue. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
