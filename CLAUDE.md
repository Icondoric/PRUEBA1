# Sistema de Gestión de Gimnasio

Gimnasio chico (~150 socios), una sede. Control de membresías, pagos y accesos.
No es un CRM: no hay facturación fiscal, no hay cobros automáticos, no hay
campañas, no hay clases ni reservas.

**Antes de escribir código, leé `docs/ARQUITECTURA.md`.** Dice en qué capa va
cada cosa, con ejemplos. El módulo `src/modules/clientes/` está completo y
testeado: es el molde. Todo módulo nuevo lo copia.

## Arquitectura: local-first

El sistema **corre en la PC de recepción**. Esa PC es el servidor y la dueña de
los datos. Un solo proceso Node sirve el frontend y la API; la base es un
archivo SQLite.

- **El check-in le pega a `localhost`. Nunca depende de internet.** Por eso NO
  hay service worker, ni snapshot en IndexedDB, ni cola de sincronización. Si
  proponés agregar eso, estás resolviendo un problema que esta arquitectura ya
  eliminó.
- **El dueño entra desde el celular por Tailscale**, solo a reportes.
- **Backup automático a la nube** dos veces al día. Única dependencia de
  internet, y es diferible.
- **Debe correr en Windows, macOS y Linux.** Nada de rutas con `\`, ni comandos
  de un SO, ni nada que requiera instalar Postgres o Docker.
- **Migrable a la nube.** El esquema evita features propias de SQLite y todo
  acceso a datos pasa por Drizzle.

## Stack

Backend: TypeScript · Hono · SQLite + Drizzle · Zod
Frontend: Vue 3 (`<script setup>`) · Vite · shadcn-vue + Tailwind ·
vue-router · `@tanstack/vue-query` · vee-validate
Tests: Vitest

Un solo puerto, un solo proceso, un solo archivo de base de datos.

## Comandos

```
pnpm dev · pnpm build · pnpm start
pnpm test · pnpm typecheck · pnpm lint · pnpm format
pnpm db:generate · pnpm db:migrate · pnpm db:seed
pnpm backup
```

## Capas (resumen; el detalle está en docs/ARQUITECTURA.md)

```
http           valida forma con Zod, traduce a HTTP. Rutas finas, SIN try/catch
application    casos de uso. Orquesta dominio + repositorio. Sin SQL, sin HTTP
domain         reglas puras. NO importa drizzle, hono ni @/lib/db. Todo por parámetro
infrastructure todo el SQL. Sin reglas de negocio
```

Un módulo se importa por su `index.ts`, nunca por sus internals. Las dos reglas
las verifica ESLint en el pre-commit.

## Reglas del dominio — NO NEGOCIABLES

- **Dinero**: enteros en centavos. Nunca float, nunca decimales.
- **Fechas de membresía**: texto `'YYYY-MM-DD'`. Nunca timestamp, nunca zona
  horaria. Usá siempre los helpers de `src/lib/fechas.ts`.
- **Solo `hoyEnZona()` lee el reloj.** Todo lo demás recibe `hoy` por parámetro.
- **Renovar crea una membresía NUEVA.** Jamás `UPDATE` de `fecha_fin`. El
  historial es el producto: de ahí sale la antigüedad del socio.
- **"Vencido" se CALCULA** (vigente = `fecha_fin >= hoy`; vencido =
  `fecha_fin < hoy`). Prohibido guardarlo: se
  desactualiza a medianoche y nadie se entera.
- **Renovación encadenada**: anticipada arranca al día siguiente del
  vencimiento anterior; vencida arranca hoy. Vive en
  `modules/membresias/domain/renovacion.ts`.
- **El pase por sesión NO encadena.** Pasar `encadenable: false` cuando
  `plan.esPaseDiario`. Sin eso, un socio con mensualidad vigente que paga una
  sesión recibiría un pase para dentro de tres semanas.
- **Precios con vigencia**: el precio de un plan nunca se edita; se agrega una
  fila con vigencia. La membresía guarda el precio cobrado.
  Ver `modules/membresias/domain/precios.ts`.
- **Pagó algo → `cliente` + membresía + `pago`. Entró gratis → `visita`.**
  Esa es la única frontera.
- **Un cliente puede ser ligero: solo nombre.** Apellido, CI y teléfono son
  opcionales. Exigir datos completos a quien paga una sesión hace que
  recepción invente datos.
- **"Socio" y "eventual" se DERIVAN**, igual que "vencido":
  socio = tiene alguna membresía de plan con `esPaseDiario = false`.
  Los pases nunca cuentan como socios activos en los reportes.
- **Identidad = `ci` + `ci_extension`**, y el CI puede faltar (menores): ahí
  manda el `nro_socio`. Normalizar siempre con `normalizarIdentificador`.
- **Una sola función decide el acceso**: `evaluarAcceso()` en
  `modules/checkin/domain/acceso.ts`. Pura.
- **Los ingresos se registran SIEMPRE**, permitidos y rechazados.
- **Nada se borra.** Soft delete en clientes; los pagos se anulan con motivo.
- **Auditoría**: toda membresía y todo pago guardan quién los registró
  (`creado_por`, `registrado_por`). No los dejes en null.

## Errores

Excepciones tipadas de `src/lib/errors.ts` y un único middleware que las
traduce. Nunca `new Error()` pelado, nunca un objeto con `status`, nunca
try/catch en una ruta. Lo que no es `AppError` sale 500 y se loguea entero: no
disfraces una falla técnica de mensaje amable.

## Check-in — requisitos duros

- Responde en **< 100ms**. Es SQLite local, no hay excusa.
- Autofoco permanente, Enter envía, sin mouse.
- Pantalla completa: verde / amarillo (≤3 días) / rojo, con nombre, foto y días
  restantes. Se limpia sola a los 3 segundos.
- Sonido distinto para permitido y rechazado.
- Un pase por sesión vigente dice "válido hoy" en verde, no "vence hoy" en
  amarillo. Avisar que renueve un pase diario es ruido.

## Interfaz — leé la skill antes de tocar una pantalla

**Antes de escribir o revisar cualquier cosa en `src/web/`, cargá la skill
`apple-design`** (`.claude/skills/apple-design/SKILL.md`). Define cómo se
comporta la interfaz; los valores concretos (colores, radios, espaciado) los
ponen los tokens de shadcn-vue/Tailwind del repo, y esos ganan.

Esto es un back-office de escritorio manejado con teclado, así que la skill se
aplica **selectivamente**, como ella misma indica:

- **Sí aplican**: §1 respuesta (<100ms), §3 interrumpibilidad, §7 consistencia
  espacial, §14 accesibilidad y movimiento reducido, §15 tipografía,
  §16 formularios y foco, §17 los cuatro estados (cargando, vacío, error,
  cargado), §18 tablas y datos densos, §19 íconos y microcopy.
- **No aplican**: §2, §5, §6, §9, §10 (arrastre, inercia, rubber-banding,
  gestos). No agregues gestos ni springs a una tabla o a un formulario.
- **La pantalla de check-in es un kiosco**: ahí mandan tamaño, contraste y
  latencia. El movimiento es decoración y no va.
- **Sin dependencias de animación** (Motion, etc.) sin preguntar: lo que haga
  falta se resuelve con CSS.
- Microcopy en español y con el vocabulario del dominio: siempre "cliente",
  "socio", "eventual", "membresía", "pago". Un concepto, una palabra.
- Antes de dar una pantalla por terminada, pasá el "Review checklist" del
  final de la skill.
- **El aspecto visual se hace al final**, cuando estén todas las pantallas:
  ver `docs/PASADA-VISUAL.md`. Hasta entonces no rediseñes nada; usá los
  componentes y tokens como están. **Cada vez que crees una pantalla o un
  componente nuevo, anotalo en ese archivo** con lo que habrá que ajustarle.

## Documentación para la guía de usuario

`docs/SISTEMA.md` describe lo que el sistema hace desde el punto de vista de
recepción y del dueño. Es la base de la futura guía de usuario.

**Al terminar cada rebanada, actualizalo en la misma sesión**: las pantallas
nuevas, cómo se usan, los mensajes que puede ver recepción, y tachá lo que
dejó de estar pendiente. Solo lo que ya funciona y fue probado, en lenguaje de
usuario (nada de nombres de archivos, rutas de API ni términos de código).

## Pendiente de confirmar con el dueño

NO implementar hasta que el usuario lo confirme:

- **Congelamiento de membresías.** El enum ya contempla `'congelada'`, pero no
  hay lógica. Si se aprueba: tabla `congelamientos` + recálculo, nunca editando
  la membresía existente.
- **Deuda o pago en cuotas.** Hoy el modelo asume pago completo al vender.

## Convenciones

- Dominio en español (cliente, membresía, pago, ingreso, visita); tipos e
  infraestructura en inglés.
- Frontend por funcionalidad:
  `src/web/features/<nombre>/{api,views,components}` y `src/web/shared/` para
  lo realmente compartido.
- Todo dato del servidor pasa por `@tanstack/vue-query`.
- Los esquemas Zod se comparten entre backend y formularios.

## Nunca

- **No hagas commits** (ni `git commit`, ni `git push`, ni ramas). Al terminar
  una tarea, con typecheck, lint y tests en verde, recordale al usuario que
  haga el commit y proponele el mensaje. El commit lo hace él.
- No agregues dependencias sin preguntar.
- No edites una migración ya aplicada; creá una nueva con `pnpm db:generate`.
- No uses `any`, ni `as` para callar al type checker.
- No uses `new Date()` para lógica de membresías.
- No uses features exclusivas de SQLite.
- No pongas SQL fuera de `infrastructure/`.
- No pongas reglas de negocio en `http/` ni en un componente de Vue.
- No uses la Options API de Vue. Siempre `<script setup lang="ts">`.
- No guardes datos del servidor en Pinia ni en refs sueltos.
- No instales shadcn-vue como dependencia: los componentes se copian al repo.
- No toques `renovacion.ts`, `precios.ts`, `acceso.ts` ni `cliente.ts` sin
  correr sus tests. Si un cambio tuyo rompe uno, el que está mal es tu código.
