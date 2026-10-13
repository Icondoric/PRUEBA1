# El sistema, tal como está hoy

**Para qué es este archivo:** es la materia prima de la futura guía de usuario.
Describe lo que el sistema hace desde el punto de vista de quien lo usa
(recepción y el dueño), no cómo está programado. Eso último está en
`docs/ARQUITECTURA.md`.

**Cómo se mantiene:** se actualiza al terminar cada rebanada, en la misma
sesión. Solo se documenta lo que ya funciona y fue probado; lo que falta va en
la última sección. Si una pantalla cambia, se corrige acá.

**Última actualización:** rebanada 7 (planes y precios, bloqueo, baja de clientes, mi cuenta).

---

## 1. Qué es

Un sistema para un gimnasio chico, de una sola sede: quiénes son los clientes,
qué membresía tiene cada uno, cuánto pagó y quién entra.

Corre en la PC de recepción. No necesita internet para funcionar: si se corta,
el gimnasio sigue trabajando igual. Internet solo hace falta para que el
respaldo llegue a la nube.

### Lo que no hace

No emite facturas, no cobra solo, no manda campañas y no maneja clases ni
reservas. Tampoco maneja deudas ni pagos en cuotas: hoy quien compra paga todo
en el momento.

## 2. Cómo se abre

Con el sistema encendido, en el navegador de la PC de recepción:

| Dirección | Qué es |
|---|---|
| `http://localhost:3000` | El sistema (abre en Inicio) |
| `http://localhost:3000/checkin` | La pantalla de ingreso |

### Ingresar

Lo primero que aparece es la pantalla de ingreso: **usuario y contraseña**.
Cada persona tiene su propio usuario; no se comparten.

- El usuario no distingue mayúsculas de minúsculas.
- Tras 5 intentos fallidos seguidos hay que esperar un minuto. La espera es
  para el equipo desde el que se falló: si alguien se equivoca desde otro
  lado, la PC de recepción puede seguir entrando.
- Si desde un mismo equipo se prueba entrar más de 20 veces en un minuto, el
  sistema pide esperar, sea cual sea el usuario.
- **La sesión se cierra sola después de 8 horas sin uso.** Al volver, pide la
  contraseña y deja a la persona donde estaba.
- **Cerrar sesión:** abajo en el menú, donde también se ve quién está usando
  el sistema. Hay que cerrarla al terminar el turno.
- Quien olvida su contraseña se la pide al dueño, que le pone una nueva desde
  "Usuarios".
- **Mi cuenta:** haciendo clic en el propio nombre, abajo en el menú. Desde
  ahí cada uno cambia su contraseña: pide la actual y la nueva. Al cambiarla
  se cierra la sesión y hay que entrar con la nueva.

En el menú aparecen solo las secciones a las que cada uno tiene acceso.

**En el celular** el menú no está a la vista: arriba se ve en qué pantalla se
está y, a la derecha, el botón **Menú**, que abre todas las secciones, "Mi
cuenta", el modo claro u oscuro y "Cerrar sesión". Se cierra solo al elegir
una sección, o tocando fuera.

### Inicio

Es lo primero que se ve al entrar: lo de hoy y lo que más se hace.

- **Accesos directos:** Registrar cliente, Abrir check-in, Registrar visita.
- **Cobrado hoy:** el total y cuánto por cada forma de pago. Al hacer clic
  lleva a Pagos.
- **Vencen en estos días** y **Vencidas:** cuántos clientes hay en cada
  situación. Al hacer clic se abre la lista ya filtrada.
- **Socios activos** y **Entraron hoy:** solo los ve el dueño.
- **Lista de los que vencen en estos días**, con su teléfono y el botón
  **Renovar**, que lleva directo a la venta. Si no vence nadie, lo dice.

Cada uno ve solo los bloques de lo que tiene acceso. Quien solo usa el
check-in no pasa por Inicio: entra directo al check-in.

### Modo claro y modo oscuro

El sistema se ve en **modo oscuro** salvo que se elija otra cosa. Para
cambiarlo: **"Usar modo claro"** (o "Usar modo oscuro"), abajo en el menú o
arriba a la derecha en la pantalla de ingreso.

- La elección queda guardada **en ese navegador**: la PC de recepción puede
  estar en oscuro y el celular del dueño en claro.
- El claro conviene para mirar los reportes en la calle, con sol.
- La pantalla de check-in no tiene el botón: usa lo que se haya elegido antes.

### Avisos

Cuando algo se hace bien y el resultado no queda a la vista (se cerró una
ventana o se cambió de pantalla), aparece un **aviso abajo a la derecha**:
"Pago anulado.", "Cliente bloqueado.", "Plan creado.", "Precio agregado.".

- Se va solo a los pocos segundos. Mientras el mouse está encima, se queda.
- Se puede cerrar con la ✕.
- Los errores de un formulario no salen ahí: siguen apareciendo al lado del
  campo que hay que corregir.

## 3. Palabras que usa el sistema

| Palabra | Qué significa |
|---|---|
| **Cliente** | Cualquier persona que pagó algo alguna vez. |
| **Socio** | Un cliente que compró al menos un plan (Mensual, Trimestral, Anual). |
| **Eventual** | Un cliente que solo compró pases por sesión. |
| **Nº de socio** | El número corto del carnet. Lo asigna el sistema, es correlativo y no se repite. Los eventuales también tienen uno. |
| **Membresía** | Un período pago: desde una fecha hasta otra. |
| **Pase por sesión** | Una membresía de un solo día: vale el día que se paga. |
| **Vigente / vencida** | Lo calcula el sistema cada día. El último día todavía cuenta como vigente. |
| **Bloqueado** | Un cliente que no puede entrar aunque tenga la membresía al día. |
| **Ingreso** | Cada vez que alguien teclea su número en el check-in, lo dejen pasar o no. |
| **Pago** | Lo que se cobró por una membresía o un pase. Nace junto con la venta. |
| **Anular** | Dejar sin efecto un pago mal cargado. No se borra: queda marcado, con el motivo. |
| **Visita** | Una entrada gratis: cortesía, clase de prueba o acompañante. No es un cliente. |

Socio o eventual no se elige: el sistema lo deduce de lo que la persona
compró. Un eventual pasa a ser socio en el momento en que compra su primer plan.

## 4. Clientes

### 4.1 Lista de clientes

**Cómo está cada uno, sin abrir la ficha.** La columna "Membresía" dice, al
lado de cada nombre:

| Se ve | Qué significa |
|---|---|
| ✓ Al día · hasta el 08/11/2026 | Tiene pago y le quedan más de 3 días |
| ⚠ Vence hoy / Vence mañana / Vence en 3 días | Está al día, pero conviene ofrecerle renovar |
| ✕ Vencida · hace 5 días | Ya no puede entrar |
| Sin membresía | Nunca compró nada |
| ✓ Pase válido hoy | Pagó una sesión y vale hoy |
| Empieza el 20/10/2026 | Ya pagó, pero todavía no arranca |

El filtro **Membresía** deja ver solo los que están al día, los que vencen
en estos días, los vencidos o los que no tienen ninguna. Sirve, por ejemplo,
para llamar a los que vencen esta semana.

Menú **Clientes**. Muestra a todos, del más nuevo al más viejo, de a 25.

- **Buscar:** por nombre, apellido, CI o número de socio. Busca solo mientras
  se escribe; también se puede presionar Enter.
- **Tipo:** todos, solo socios o solo eventuales.
- **Quitar filtros:** aparece cuando hay una búsqueda o un filtro puesto.
- Abajo dice cuántos hay ("1–25 de 150 clientes") y están las páginas.
- Hacer clic en una fila abre la ficha.

Columnas: nº de socio, nombre, CI, teléfono, tipo (y "Bloqueado" si lo está) y
fecha de registro.

### 4.2 Registrar un cliente

Botón **Registrar cliente**.

- **Solo el nombre es obligatorio.** Apellido, CI y teléfono son opcionales:
  a quien viene a entrenar un día no hace falta pedirle todos los datos.
- **CI:** solo números, entre 4 y 12 dígitos. Se puede escribir con puntos;
  el sistema los quita. Para menores sin CI se deja vacío.
- **Extensión del CI:** el departamento (LP, CB, SC…). Por defecto, La Paz.
- Dos clientes no pueden tener el mismo CI con la misma extensión. Si se
  intenta, el sistema avisa de quién es ese CI.
- **Referido por** (opcional): el número de socio o el CI de quien lo trajo.
  Si ese número no es de ningún cliente, el sistema avisa y no guarda. Se
  puede agregar, cambiar o quitar después, desde "Editar datos".

Al guardar se abre la ficha del cliente nuevo, con su número de socio.

### 4.3 Ficha del cliente

Además de sus datos, la ficha muestra **cuándo vino por última vez** ("Ayer",
"Hace 5 días", "Todavía no entró nunca") y **cuántos días vino en el último
mes**. Cuentan solo las veces que pasó: si lo rebotaron en la puerta, no.

Cuando la membresía está por vencer o ya venció, el recuadro de "Membresía"
se destaca y lo dice con todas las letras: "Vence el 13/10/2026. Le queda
1 día. Conviene ofrecerle renovar."

Muestra el nombre, si es socio o eventual, sus datos y su membresía.

- **Editar datos:** cambia nombre, apellido, CI, extensión y teléfono.
- **Acceso bloqueado:** si el cliente está bloqueado, se ve un aviso con el
  motivo, quién lo bloqueó y cuándo.
- **Referido por:** si alguien lo trajo, aparece quién, con enlace a su ficha.
- **Pagos:** al final de la ficha está todo lo que pagó, y desde ahí se puede
  anular un pago (ver la sección de Pagos).

### 4.4 Bloquear a un cliente

Al pie de la ficha, en "Acceso y estado". Lo ve quien tiene el acceso
"Bloquear y desbloquear clientes".

- **Bloquear cliente** pide el motivo, que es obligatorio. Desde ese momento
  el check-in lo rechaza aunque tenga la membresía al día.
- Queda registrado **quién lo bloqueó y a qué hora**, y se ve en la ficha.
- No toca su membresía ni sus pagos: los días siguen corriendo.
- **Desbloquear cliente** lo deja entrar de nuevo y borra el motivo.

### 4.5 Dar de baja a un cliente

También al pie de la ficha. Lo puede hacer el dueño y quien tenga el acceso
"Dar de baja y reactivar clientes", que no viene con recepción: lo da el dueño.

- **Dar de baja no borra nada.** El cliente queda guardado con su número de
  socio y todo su historial de membresías, pagos e ingresos. Lo que cambia es
  que deja de aparecer en las listas y en los reportes, y no puede entrar.
- Pide confirmación antes de hacerlo.
- **Para encontrarlo después:** en la lista de clientes, el filtro
  **Estado → Dados de baja** (lo ve quien tiene ese mismo acceso).
- **Reactivar cliente**, desde su ficha, lo devuelve como estaba.

## 5. Membresías

### 5.1 La sección "Membresía" de la ficha

Dice en qué situación está el cliente hoy:

| Lo que dice | Qué significa |
|---|---|
| Sin membresía | Nunca compró nada. |
| Vigente hasta el DD/MM/AAAA | Está al día. Abajo dice cuántos días le quedan. |
| Pase por sesión, válido hoy | Pagó la sesión de hoy y no tiene un plan. |
| Venció el DD/MM/AAAA | Ya no puede entrar. Dice hace cuántos días. |
| Empieza el DD/MM/AAAA | Pagó una membresía que arranca más adelante. Hoy todavía no entra. |

Debajo está el **historial**: cada membresía que tuvo, con plan, fechas,
precio pagado y estado. El historial nunca se borra ni se modifica.

### 5.2 Vender o renovar

Botón **Vender membresía** (o **Renovar membresía** si ya tuvo alguna).

1. **Elegir el plan.** Cada uno muestra su duración y su precio de hoy. Si hay
   una promoción, se ve el precio rebajado, el precio habitual tachado y el
   nombre de la promo.
2. **Cómo pagó:** efectivo, QR, transferencia o tarjeta.
3. **Nota** (opcional).
4. **Revisar el resumen** antes de cobrar: desde cuándo y hasta cuándo corre,
   por qué empieza ese día, y el total.
5. Botón **Cobrar Bs … y registrar**.

Se registran juntos la membresía y el pago.

### 5.3 Desde cuándo corre una membresía

Lo decide el sistema, y lo explica en el resumen:

- **Primera membresía:** empieza hoy.
- **Renueva antes de que venza:** la nueva empieza al día siguiente del
  vencimiento. No pierde los días que le quedaban.
- **Renueva cuando ya venció:** empieza hoy. Los días vencidos no se regalan.
- **Pase por sesión:** vale hoy, siempre, aunque tenga un plan vigente.
- **Pase hoy y plan el mismo día:** el plan empieza mañana.

**El plan viene elegido al renovar.** Si el cliente ya tuvo un plan, ese
mismo aparece marcado ("Es el plan que ya tenía"); se cambia con un clic. Los
planes van primero y el pase por sesión al final. El botón dice cuánto se va
a cobrar: "Cobrar Bs 200 y registrar".

**Elegir otra fecha de inicio:** casilla opcional ("arranca el lunes"), hasta
un año hacia adelante. Solo
de hoy en adelante, y no para pases. Mientras no llegue esa fecha, la persona
no puede entrar.

### 5.4 Precios y promociones

- El precio es el del día en que se paga.
- La membresía guarda lo que se cobró. Si el precio del plan cambia después,
  lo ya vendido no cambia.
- Una promoción es un precio con fecha de inicio y de fin. Mientras está
  vigente, se aplica sola.
- Los planes, precios y promociones se administran desde la pantalla
  "Planes" (ver esa sección).

## 6. Check-in (la pantalla de ingreso)

Menú **Check-in**, o directo en `/checkin`. Ocupa toda la pantalla y se usa
sin mouse.

**Cómo se usa:** se teclea el número de socio o el CI y se presiona Enter. El
cursor está siempre en el campo; no hay que hacer clic.

**Qué responde,** durante 3 segundos, con sonido:

| Color | Dice | Qué significa |
|---|---|---|
| Verde | Adelante · Quedan N días | Puede pasar. |
| Verde | Adelante · Pase por sesión — válido hoy | Pagó la sesión de hoy. |
| Amarillo | Adelante · Vence en N días / Último día de membresía | Puede pasar, pero le quedan 3 días o menos. Conviene ofrecerle renovar. |
| Rojo | No podés ingresar · Venció hace N días | Membresía vencida. |
| Rojo | No podés ingresar · Sin membresía registrada | Nunca compró, o lo que pagó todavía no empieza (en ese caso dice cuándo empieza). |
| Rojo | No podés ingresar · Acceso bloqueado | Está bloqueado. |
| Rojo | Número no encontrado | Ese número no es de ningún cliente. |

- **Sonido:** dos notas agudas si pasa; dos pulsos graves si no.
- No hay que esperar los 3 segundos: el siguiente puede teclear enseguida.
- Si ya renovó por adelantado, no se le avisa que está por vencer.
- **Todo intento queda registrado**, también los rechazados. La única
  excepción es un número que no es de nadie.
- **Salir del check-in:** enlace abajo a la derecha, con el mouse.

### 6.1 Vender un pase por sesión desde el check-in

Para quien viene a entrenar solo hoy. Se hace sin salir de la pantalla de
ingreso y sin mouse, con la tecla **F2**.

**Si el check-in acaba de rechazar a alguien** (vencido o sin membresía), la
pantalla roja dice "F2 para venderle un pase por sesión":

1. **F2.** Se abre el panel ya con esa persona y el precio del pase.
2. Si no paga en efectivo, elegir cómo pagó.
3. **Enter.** Cobra, registra y muestra la pantalla verde "válido hoy".

**Si es alguien que no está en el sistema:**

1. **F2** con la pantalla en espera.
2. Escribir el nombre. Con el nombre alcanza.
3. Mientras se escribe aparecen los clientes parecidos. Si ya vino antes,
   elegirlo con las flechas para no crearlo dos veces.
4. **Enter.**

**Esc** cierra el panel sin cobrar.

El sistema no deja vender un pase a quien ya puede entrar hoy (para no
cobrarle de más) ni a un cliente bloqueado.

## 7. Pagos

Menú **Pagos**. Abre mostrando lo cobrado **hoy**, que es lo que hace falta
para cerrar la caja.

- **Cobrado:** el total y cuánto entró por efectivo, QR, transferencia y
  tarjeta, con la cantidad de pagos de cada uno.
- **Desde / Hasta / Método:** para ver otro día, un rango o un solo método.
  **Ver solo hoy** vuelve al día actual.
- **La tabla:** cada pago con fecha, cliente, qué pagó, método y monto.

Los pagos no se cargan a mano: aparecen solos cuando se vende una membresía o
un pase.

### 7.1 Anular un pago

Para un pago mal cargado (plan equivocado, cobrado dos veces). Botón **Anular
pago** en la fila, desde Pagos o desde la ficha del cliente.

- Pide el **motivo**, y es obligatorio.
- El pago **no se borra**: queda en el historial tachado, con la etiqueta
  "Anulado" y el motivo. Deja de sumar en la caja.
- **La membresía que pagaba se cancela** y deja de dar acceso.
- **No se puede deshacer.** Si se anuló por error, hay que vender de nuevo.

Para corregir un plan mal cargado: anular el pago y hacer la venta correcta.
La venta nueva arranca como si la anulada no hubiera existido.

## 8. Visitas (entradas gratis)

Menú **Visitas**. Para quien entra **sin pagar**: una cortesía, una clase de
prueba, el acompañante de un socio. Si la persona paga, no va acá: se le vende
un pase por sesión.

- **Nombre** y **motivo** (cortesía, clase de prueba, acompañante, otro).
- **Invitado por:** el número de socio o el CI de quien lo trae. Es
  obligatorio cuando el motivo es acompañante.
- Teléfono y nota, opcionales.

Debajo se ven las visitas de los últimos 30 días.

Una visita no crea un cliente, no tiene número de socio y no pasa por el
check-in.

## 9. Reportes (solo para el dueño)

Menú **Reportes**. Está pensado para leerse desde el celular: una sola
columna y números grandes.

**Es una pantalla del dueño.** Recepción no la ve, salvo que el dueño le dé el
acceso "Ver los reportes" a alguien.

| Sección | Qué muestra | Para qué sirve |
|---|---|---|
| **Hoy** | Socios activos, cobrado, cuántos entraron y cuántos rebotaron. | El pulso del día. |
| **Vencen en los próximos 7 días** | Quiénes, con plan, teléfono y fecha. | Llamarlos antes de que venzan. |
| **Vencidos en los últimos 60 días** | Quiénes y hace cuánto. Aparte, cuántos vencieron hace más tiempo. | Recuperar a los que se fueron hace poco. |
| **Cobrado por mes** | Los últimos 6 meses, con el desglose por método. | Ver cómo viene el negocio. |
| **Ingresos por día** | Del mes que se elija: cuántos entraron y cuántos rebotaron cada día. | Ver los días flojos y los fuertes. |
| **Asistencia por día de la semana** | Promedio de personas que entran cada día, en las últimas 8 semanas. | Saber qué días se llena. |
| **Socios nuevos** | Cuántos compraron su primer plan cada mes. | Medir el crecimiento. |
| **Pases por sesión vendidos** | Cuántos por mes, y quiénes vinieron más de 3 veces en 90 días. | Ofrecerles un plan a los que vienen seguido. |

Cómo se cuentan las cosas:

- **Socio activo** es quien tiene un plan vigente hoy. **Los pases por sesión
  nunca cuentan** como socios activos ni como socios nuevos.
- Los pagos anulados y las membresías canceladas no suman en nada.
- Quien ya renovó por adelantado no aparece como "por vencer".
- Un vencido que ya pagó la membresía que viene no aparece para llamar.
- Los clientes dados de baja no aparecen.

**Exportar a CSV:** cada lista tiene su botón. El archivo se abre en Excel con
doble clic, con los montos listos para sumar.

## 9.5 Planes y precios

Menú **Planes**. Lo ve el dueño y quien tenga el acceso "Planes y precios".

Cada plan muestra cuánto dura, **cuánto se cobra hoy** y el historial de sus
precios.

**Cambiar precio.** Se escribe el precio nuevo y desde qué fecha rige (hoy o
más adelante). El precio anterior **no se borra ni se modifica**: queda en el
historial, y lo que ya se vendió sigue como estaba.

**Cargar promoción.** Precio, desde cuándo, hasta cuándo y un nombre (es lo
que se ve al cobrar). Mientras dure se cobra ese precio; al terminar vuelve
solo el precio habitual.

**Siempre en dos pasos.** Después de escribir, el sistema muestra qué se va a
cobrar con ese cambio (hoy, y el día que empieza a regir). Recién ahí se
guarda. Enter confirma.

- El precio se escribe sin puntos de miles: `1900` o `1900,50`.
- No se puede cargar un precio con fecha pasada.
- **Quitar un precio** solo es posible si todavía no empezó a regir y nadie
  compró con él. Es para deshacer un error de carga. Si ya rige, se corrige
  cargando otro precio encima.

**Crear plan.** Nombre, duración en días y precio. Un pase por sesión dura
siempre 1 día. **La duración no se puede cambiar después:** si un plan pasa a
durar distinto, se crea otro y se da de baja el viejo.

**Cambiar nombre** y **Dar de baja plan.** Un plan dado de baja deja de
aparecer al vender, pero no se borra: quienes lo compraron lo conservan. Se
puede volver a ofrecer.

## 10. Usuarios y accesos (solo para el dueño)

Menú **Usuarios**. Solo lo ve el dueño, y eso no se puede delegar.

### 10.1 Quién puede qué

**El dueño puede todo, siempre.** A los demás, el dueño les da accesos sueltos,
con casillas agrupadas por módulo:

| Módulo | Acceso | Viene con recepción |
|---|---|---|
| Clientes | Ver, registrar y editar clientes | Sí |
| | Bloquear y desbloquear clientes | No |
| | Dar de baja y reactivar clientes | No |
| Membresías | Vender y renovar membresías | Sí |
| Check-in | Usar la pantalla de check-in | Sí |
| | Vender pases por sesión | Sí |
| Pagos | Ver lo cobrado hoy | Sí |
| | Ver lo cobrado en otras fechas | No |
| | Anular pagos | No |
| Visitas | Registrar y ver visitas gratis | Sí |
| Reportes | Ver los reportes | No |
| Planes y precios | Crear y cambiar planes, precios y promociones | No |

Lo que cada uno no tiene, no lo ve: ni la sección en el menú ni el botón. Por
ejemplo, quien no puede anular pagos no ve "Anular pago", y quien solo puede
ver lo cobrado hoy no tiene los filtros de fecha en Pagos.

Lo único que es solo del dueño y no aparece entre las casillas es administrar
usuarios y accesos.

### 10.2 Crear un usuario

Botón **Crear usuario**: nombre y apellido, usuario (sin espacios, por ejemplo
`ana.quispe`) y una contraseña de 8 caracteres o más. El sistema rechaza las
que probaría cualquiera primero ("12345678", "password123", una sola letra
repetida) y pide elegir otra.

Las casillas vienen con lo básico de recepción ya marcado. Se agrega o se
quita lo que haga falta. **Dejar lo básico de recepción** vuelve al punto de
partida.

### 10.3 Cambiar a un usuario que ya existe

Se entra haciendo clic en su fila. Cada cosa tiene su propio botón:

- **Guardar cambios:** el nombre y los accesos. Se aplican en el acto, sin
  que la persona tenga que salir y volver a entrar.
- **Cambiar contraseña:** le pone una nueva y le cierra las sesiones que
  tenga abiertas.
- **Desactivar usuario:** deja de poder entrar en ese mismo momento. No se
  borra: lo que registró sigue a su nombre. Se puede reactivar.

### 10.4 Lo que queda registrado

- Cada venta, pago y visita guarda **quién la cargó**.
- Al bloquear a un cliente queda **quién lo bloqueó** y cuándo.
- Al anular un pago queda **quién lo anuló** y cuándo; se ve en la tabla.
- Cada acceso guarda quién lo dio.

### 10.5 La cuenta del dueño

No se crea desde el navegador sino con un comando en la PC de recepción (ver
`docs/INSTALACION.md`). El mismo comando sirve si el dueño olvida su
contraseña. Desde la pantalla, la cuenta del dueño no se puede desactivar ni
recortar.

## 11. Respaldo de los datos

Toda la información está en un solo archivo. El respaldo hace una copia segura
sin apagar el sistema, la guarda en la PC y, si está configurada, en una
carpeta sincronizada a la nube. Conserva las últimas 14 copias.

Se programa para que corra solo dos veces al día. La instalación y la
configuración están en `docs/INSTALACION.md`.

**Nunca copiar el archivo de datos a mano con el sistema encendido:** la copia
puede salir dañada.

## 12. Mensajes que puede ver recepción

| Mensaje | Qué hacer |
|---|---|
| Ese CI ya está registrado a nombre de … | Esa persona ya es cliente. Buscarla en la lista en vez de crearla de nuevo. |
| El CI debe tener entre 4 y 12 dígitos | Revisar el número. |
| Hay N campos para revisar | El cursor queda en el primero que tiene un problema. |
| Elegí un plan | Falta marcar el plan antes de cobrar. |
| La fecha de inicio no puede ser anterior a hoy | Elegir hoy o una fecha futura. |
| El plan … ya no se vende | Ese plan fue dado de baja. Elegir otro. |
| Sin precio configurado (en un plan) | A ese plan le falta el precio. Avisar al administrador. |
| … ya puede entrar hoy: no necesita un pase | Esa persona tiene membresía o pase vigente. No hay que cobrarle. |
| … tiene el acceso bloqueado: no se le puede vender un pase | Derivar a administración. |
| No hay un pase por sesión con precio cargado | Falta configurar el pase. Avisar al administrador. |
| Escribí por qué se anula el pago | El motivo es obligatorio y tiene que explicar algo. |
| Ese pago ya estaba anulado | No hay nada que hacer: ya está anulado. |
| Indicá a qué socio acompaña | Para un acompañante hay que poner quién lo trae. |
| “…” no es un número de socio ni un CI registrado | Revisar el número de quien invita. |
| Escribí por qué se lo bloquea | El motivo del bloqueo es obligatorio. |
| Tu usuario no puede ver a los clientes dados de baja | Hace falta el acceso "Dar de baja y reactivar"; lo da el dueño. |
| Escribí el precio sin puntos de miles: 1900 o 1900,50 | Sacar el punto de miles. |
| La fecha desde la que rige no puede ser anterior a hoy | Un precio rige desde hoy o más adelante. |
| Una promoción necesita fecha de fin / Ponele un nombre a la promoción | Completar esos datos. |
| Ese precio ya empezó a regir o ya se vendió con él: no se puede quitar | Cargar otro precio encima para corregirlo. |
| Un pase por sesión dura 1 día | Si dura más, es un plan, no un pase. |
| La contraseña actual no es esa | Revisar la contraseña con la que se entró. |
| Un cliente no puede referirse a sí mismo | Revisar el número de quien lo trajo. |
| Usuario o contraseña incorrectos | Revisar las dos cosas. El mensaje es el mismo si el usuario no existe o está desactivado. |
| Demasiados intentos seguidos. Esperá … segundos | Esperar y volver a probar con calma. |
| Tu sesión se cerró por inactividad | Volver a ingresar. |
| No tenés acceso a esta parte | Pedirle al dueño que habilite ese acceso. |
| Tu usuario solo puede ver lo cobrado hoy | Para otras fechas hace falta un acceso que da el dueño. |
| Ya existe un usuario "…" | Elegir otro nombre de usuario. |
| No se pudo cargar … / Reintentar | Probar con el botón. Si sigue, revisar que el sistema esté encendido. |
| Algo falló en el sistema. Avisale al administrador. | Un error inesperado. Anotar qué se estaba haciendo y avisar. |

## 13. Lo que todavía no existe

Se va tachando a medida que se construye.

- [x] Vender un pase por sesión directamente desde el check-in
- [x] Pagos: historial y anulación con motivo
- [x] Visitas gratis (cortesías, clases de prueba, acompañantes)
- [x] Registrar quién anuló un pago y cuándo
- [ ] Enlazar una clase de prueba con el cliente, si después se inscribe
- [ ] Ver visitas de más de 30 días atrás
- [x] Reportes para el dueño
- [x] Que recepción no vea los reportes
- [x] Usuarios, contraseñas y accesos por módulo
- [ ] Probar el acceso desde el celular del dueño por Tailscale (ya se puede
      configurar; ver `docs/INSTALACION.md`)
- [x] Que cada uno pueda cambiar su propia contraseña
- [ ] Resumen diario al dueño
- [x] Cargar y cambiar planes, precios y promociones desde la pantalla
- [x] Bloquear y desbloquear un cliente desde la pantalla
- [x] Registrar quién bloqueó a un cliente y cuándo
- [x] Dar de baja y reactivar un cliente desde la pantalla
- [ ] Fotos de los clientes
- [x] Indicar quién refirió a un cliente al registrarlo
- [ ] El aspecto visual definitivo (ver `docs/PASADA-VISUAL.md`)

Pendiente de decidir con el dueño: congelar membresías, y deudas o pago en
cuotas.

## 14. Para armar la guía de usuario

Cosas que este archivo no tiene y la guía va a necesitar:

- Capturas de cada pantalla, tomadas después de la pasada visual.
- El nombre del gimnasio y los precios reales.
- Una sección "primer día": instalar, cargar planes y precios, cargar a los
  socios actuales.
- Qué hacer si se corta la luz o se rompe la PC (restaurar un respaldo).
- Una guía corta aparte para el dueño (reportes), distinta de la de recepción.
