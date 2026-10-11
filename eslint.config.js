import js from '@eslint/js';
import ts from 'typescript-eslint';
import vue from 'eslint-plugin-vue';

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    ignores: ['dist/**', 'drizzle/**', 'node_modules/**', 'datos/**', 'respaldos/**'],
  },
  {
    rules: {
      // Las reglas del CLAUDE.md, pero verificables por una máquina.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },

  /**
   * LÍMITES ENTRE MÓDULOS.
   *
   * Es la regla que hace que la arquitectura sobreviva al mes tres. Un módulo
   * solo puede entrar a otro por su index.ts. Sin esto, en algún momento
   * alguien (o el agente, a las 2am) importa un repositorio desde otro módulo
   * y las capas dejan de significar nada.
   */
  {
    files: ['src/modules/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/modules/*/domain/*', '@/modules/*/application/*', '@/modules/*/infrastructure/*', '@/modules/*/http/*'],
              message:
                'Importá el módulo por su index.ts (@/modules/clientes), nunca sus internals.',
            },
          ],
        },
      ],
    },
  },

  /**
   * EL DOMINIO ES PURO.
   *
   * Si una regla de negocio importa drizzle o hono, dejó de ser testeable sin
   * levantar medio sistema. Esta regla lo impide de entrada.
   */
  {
    files: ['src/modules/*/domain/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['hono', 'hono/*', 'drizzle-orm', 'drizzle-orm/*', '@/lib/db', '@/lib/db/*'],
              message:
                'La capa domain es pura: sin base de datos ni HTTP. Eso va en infrastructure o http.',
            },
          ],
        },
      ],
    },
  },
);
