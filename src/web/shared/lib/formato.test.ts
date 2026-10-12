import { describe, expect, it } from 'vitest';
import { aCentavos, centavosParaCampo, formatearBs } from './formato';

describe('aCentavos', () => {
  it('entiende enteros y decimales con coma o con punto', () => {
    expect(aCentavos('200')).toBe(20_000);
    expect(aCentavos(' 200,5 ')).toBe(20_050);
    expect(aCentavos('200.50')).toBe(20_050);
    expect(aCentavos('0,05')).toBe(5);
    expect(aCentavos('Bs 1900')).toBe(190_000);
  });

  it('no adivina: un separador de miles se rechaza', () => {
    expect(aCentavos('1.900')).toBeNull();
    expect(aCentavos('1,900')).toBeNull();
    expect(aCentavos('1.900,50')).toBeNull();
  });

  it('rechaza lo que no es un precio', () => {
    for (const texto of ['', 'doscientos', '-200', '200,', '20 0', '1e3']) {
      expect(aCentavos(texto)).toBeNull();
    }
  });

  it('no arrastra errores de decimales', () => {
    expect(aCentavos('19,99')).toBe(1_999);
    expect(aCentavos('0,1')).toBe(10);
    expect(aCentavos('1234567,89')).toBe(123_456_789);
  });
});

describe('centavosParaCampo y formatearBs', () => {
  it('ida y vuelta sin perder un centavo', () => {
    for (const centavos of [0, 5, 2_000, 20_050, 190_000]) {
      expect(aCentavos(centavosParaCampo(centavos))).toBe(centavos);
    }
  });

  it('muestra los miles con punto y los centavos solo si hay', () => {
    expect(formatearBs(190_000)).toBe('Bs 1.900');
    expect(formatearBs(20_050)).toBe('Bs 200,50');
    expect(formatearBs(20_000, { conCentavos: true })).toBe('Bs 200,00');
  });
});
