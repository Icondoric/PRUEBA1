# Estilo — paleta, contrastes y reglas

El sistema visual sale del logo del gimnasio: ámbar sobre negro cálido. Los
valores viven en `src/web/shared/styles/tokens.css` y en ningún otro lado.

Cómo se **comporta** la interfaz (foco, estados, tablas, textos) lo define la
skill `apple-design`. Este documento define cómo se **ve**. Si los dos
discrepan en un valor concreto, gana este.

## Regla número uno

**Ningún componente escribe un color.** Ni `#F2920E`, ni `text-orange-500`, ni
`bg-[#1C1917]`, ni `text-white`. Siempre un token semántico: `bg-primary`,
`text-muted-foreground`, `bg-estado-permitido`. La paleta va a cambiar, y basta
un color literal perdido en una vista para romperlo.

## Dos modos, los dos terminados

- Hay modo claro y modo oscuro. **Ninguna pantalla se da por terminada hasta
  estar revisada en los dos.**
- Se conmuta con la clase `.dark` en `<html>`. El de fábrica es el **oscuro**:
  el logo es oscuro, el gimnasio tiene poca luz y el check-in está encendido
  todo el día.
- El interruptor guarda la elección en el navegador (`gym-tema`). Si no hay
  nada guardado, oscuro. Está al pie del menú y en la pantalla de ingreso; el
  check-in no lo muestra y usa lo guardado.
- El claro existe sobre todo para los reportes, que el dueño mira desde el
  celular en la calle, con sol.
- **En oscuro las sombras casi no funcionan.** Para separar capas se usa un
  fondo más claro (`bg-card` sobre `bg-background`), no una sombra.
- Si un elemento solo se distingue por su borde, en oscuro desaparece: necesita
  además un fondo distinto.

Para revisar los dos modos hay una pantalla de muestra en `/muestra`. Existe
solo con `pnpm dev`; no llega a la versión instalada.

## Marca

El ámbar del logo va de `#C07711` a `#FFCE4F`. Ancla: `#F2920E`. Es el mismo
bloque en los dos modos.

| Paso | HSL | | Paso | HSL |
|---|---|---|---|---|
| 50 | 38 100% 96% | | 500 (ancla) | 35 89% 50% |
| 100 | 38 95% 89% | | 600 | 33 91% 44% |
| 200 | 38 93% 78% | | 700 | 30 87% 36% |
| 300 | 38 93% 65% | | 800 | 28 79% 30% |
| 400 | 36 93% 57% | | 900 | 27 74% 25% |

En el archivo de tokens es el bloque rotulado **MARCA** (`--marca-50` a
`--marca-900`, más los dos tintes de fondo). Cambiar de gimnasio es editar solo
ese bloque.

Neutros: escala stone (negro **cálido**). Nada de slate ni zinc: un gris frío
al lado de ese ámbar se ve sucio.

## Tokens

| Token | Claro | Oscuro |
|---|---|---|
| `background` | 40 33% 99% | 20 14% 4% |
| `foreground` | 20 14% 4% | 40 20% 96% |
| `card` / `popover` | 0 0% 100% | 20 12% 8% |
| `primary` | ámbar-500 | ámbar-500 (no cambia) |
| `primary-foreground` | 20 14% 4% | 20 14% 4% |
| `primary-text` | ámbar-700 | ámbar-400 |
| `secondary` / `muted` | 30 10% 95% | 20 10% 15% |
| `muted-foreground` | 25 6% 40% | 30 8% 64% |
| `accent` | 38 95% 92% | 28 60% 18% |
| `accent-foreground` | 28 79% 25% | ámbar-300 |
| `destructive` | 0 72% 45% | 0 72% 51% |
| `destructive-foreground` | blanco | blanco |
| `border` | 25 10% 88% | 20 10% 18% |
| `input` | 25 6% 56% | 20 8% 40% |
| `ring` | ámbar-600 | ámbar-400 |
| `overlay` (fondo de diálogos) | 20 14% 4% al 55% | 20 14% 2% al 70% |
| `estado-permitido` | 142 72% 29%, texto blanco | 142 70% 33%, texto blanco |
| `estado-por-vencer` | ámbar-500, texto casi negro | ámbar-400, texto casi negro |
| `estado-rechazado` | 0 74% 42%, texto blanco | 0 72% 48%, texto blanco |

Lo único que cambia entre modos en la marca es `primary-text`: ámbar-700 en
claro, ámbar-400 en oscuro. El relleno del botón es ámbar-500 en los dos.

Tres valores se apartan de la primera lista que se pasó, decididos con el
usuario el 2026-10-11:

- **`ring` en claro es ámbar-600, no 500.** El 500 da 2,36 contra el fondo y el
  foco necesita 3:1. Además el anillo va a opacidad plena (`ring-ring`), nunca
  `ring-ring/50`.
- **`input` es más oscuro que `border`** en los dos modos. Con el mismo valor
  el contorno de un campo daba 1,3:1 en claro y 1,6:1 en oscuro.
- Se agregaron `popover`, `destructive-foreground` y `overlay`, que los
  componentes necesitan y no estaban en la lista.

## Contrastes — son reglas, no sugerencias

| Par | Contraste | |
|---|---|---|
| ámbar-500 como texto sobre blanco | 2,36 | ilegible |
| ámbar-600 como texto sobre blanco | 3,28 | solo texto grande |
| ámbar-700 como texto sobre blanco | 4,97 | sí |
| texto **blanco** sobre relleno ámbar | 2,36 | nunca |
| texto **casi negro** sobre relleno ámbar | 8,37 | siempre |
| ámbar-400 sobre fondo oscuro | 9,96 | sí |
| ámbar-700 sobre fondo oscuro | 3,97 | se hunde |

Para rellenos con texto blanco: verde-700 (`#15803D`, 5,02) y rojo-700
(`#B91C1C`, 6,47). Verde-600 con blanco da 3,30 y no alcanza para texto normal.

Medidos al armar los tokens (WCAG, calculados con un script):

| Par | Contraste | Qué implica |
|---|---|---|
| `ring` claro (ámbar-600) / fondo | 3,09 | alcanza para el foco |
| `input` claro / blanco | 3,23 | alcanza para el contorno |
| `input` oscuro / fondo · / card | 3,41 · 3,17 | alcanza para el contorno |
| `estado-permitido` oscuro / blanco | 4,15 | **solo texto grande o en negrita** |
| `estado-permitido` claro / blanco | 5,07 | sí |
| `estado-rechazado` / blanco | 6,41 claro · 5,24 oscuro | sí |
| `destructive` oscuro como **texto** / fondo · / card | 4,13 · 3,83 | **pendiente, ver abajo** |
| `primary-text` claro / `muted` | 4,40 | sobre `muted`, solo texto grande |
| `muted-foreground` / `muted` | 5,13 claro · 6,10 oscuro | sí |
| ámbar-500 / `muted` claro | 2,12 | no sirve como barra de gráfico sin el número al lado |

**Pendiente de decidir:** en oscuro, el rojo de `destructive` usado como texto
(los mensajes de error de los formularios) da 3,83 sobre `card`, por debajo de
4,5. Propuesta: un `destructive-text` más claro para oscuro, igual que
`primary-text` hace con el ámbar, dejando el relleno como está.

## El ámbar es marca o es aviso, según la pantalla

El ámbar de la marca y el amarillo de "por vencer" son el mismo color. Se
resuelve con una regla de ubicación, no de color:

- **En el check-in el ámbar significa SOLO "por vencer".** Nada más en esa
  pantalla lleva color de marca: ni el logo, ni el encabezado, ni el borde del
  campo, ni los botones. La pantalla está en blanco y negro hasta que hay
  resultado. Se logra con la clase `sin-marca` en la raíz de la pantalla, que
  vuelve neutros `primary`, `accent` y `ring`; los componentes no se tocan.
- **En el resto del sistema vale lo inverso:** el ámbar es marca y nunca
  significa advertencia. Para advertir fuera del check-in, texto e ícono.

**El color nunca es la única señal.** Cada resultado del check-in lleva color +
ícono + texto + un sonido distinto. Recepción muchas veces no mira la pantalla,
y con 150 socios es probable que alguno no distinga rojo de verde.

| Estado | Fondo | Texto | Ícono |
|---|---|---|---|
| permitido | verde | blanco | ✓ |
| pase por sesión | verde | blanco | ✓ ("válido hoy", no es aviso) |
| por vencer (≤ 3 días) | ámbar | casi negro | ! |
| rechazado | rojo | blanco | ✕ |

## Tipografía y densidad

- Pila del sistema (`system-ui`): corre en Windows y no cuesta descarga.
- `tabular-nums` en montos, fechas y columnas numéricas. Sin eso las cifras
  bailan y no se comparan de un vistazo.
- Números a la derecha, texto a la izquierda, encabezado alineado con su
  columna.
- Tablas compactas: alto de fila ~40 px, celdas `px-3 py-2`.
- Espaciado en múltiplos de 4 px.
- Los reportes se diseñan primero para 390 px de ancho.

## Movimiento

Solo CSS, corto, y con `transform` y `opacity`. Nada espera a que una
animación termine ni bloquea el teclado.

- Cada pantalla entra con un movimiento mínimo al navegar (180 ms).
- Los diálogos llegan desde abajo y el fondo se atenúa a la par (160 ms).
- Botones, enlaces del menú y opciones responden al presionar.
- Las barras de los gráficos crecen desde cero al aparecer.
- Los avisos entran y salen por el mismo camino.
- **En el check-in no se mueve nada**: es un kiosco.
- Con "movimiento reducido" activado en el sistema operativo, todo queda sin
  desplazamientos.

## Avisos

`avisos.exito('Pago anulado.')` (`src/web/shared/lib/avisos.ts`) para
confirmar una acción terminada cuyo resultado no queda a la vista. No se usan
para errores de formulario (van junto al campo) ni para nada que haya que leer
sí o sí: un aviso se va solo. Un formulario que al guardar vuelve a otra
pantalla deja su mensaje con `router.replace({ state: { aviso } })` y aparece
solo.

## Gráficos

Las barras usan el token `grafico`: ámbar-700 en claro (4,40 sobre `muted`) y
ámbar-500 en oscuro. El número va siempre escrito al lado.

## Anchos: del celular a la pantalla grande

Toda pantalla tiene que servir en un celular y aprovechar un monitor grande.
Se revisa en cinco anchos: **390, 768, 1024, 1440 y 1920 px**.

- **Nunca se desliza la página de costado**, y una tabla tampoco. Lo que no
  entra como columna en angosto se muestra en una segunda línea, debajo del
  dato principal de la fila (la fecha y el método debajo del cliente, por
  ejemplo). No se esconde información: se reacomoda.
- **El menú lateral aparece desde 1024 px.** Por debajo es una barra arriba
  con el botón "Menú". A 768 px una columna lateral le quita al contenido
  más de la mitad del ancho.
- **En pantalla grande se usan dos columnas, no renglones más largos.** Un
  texto o un formulario estirado a 1600 px se lee peor. Lo que se reparte
  es el contenido: datos a la izquierda e historial a la derecha (ficha),
  lo que se elige y lo que se cobra (venta), formulario y listado
  (visitas), secciones en dos columnas (reportes, planes).
- **Un formulario corto no se estira** (Mi cuenta, registrar cliente).
  Queda angosto a propósito.
- **El orden en angosto es el orden de importancia.** Al pasar a dos
  columnas se reubica con la grilla, sin cambiar el orden en el código, para
  que el teclado y el lector de pantalla sigan el mismo recorrido.
- Controles táctiles de 40 px o más.

## Rendimiento

La PC de recepción puede ser modesta. El desenfoque (`backdrop-filter`) va a lo
sumo en el menú y en un encabezado fijo, siempre con su versión sólida de
respaldo, y nunca en el check-in.
