# El sistema, tal como está hoy

**Para qué es este archivo:** es la materia prima de la futura guía de usuario.
Describe lo que el sistema hace desde el punto de vista de quien lo usa
(recepción y el dueño), no cómo está programado. Eso último está en
`docs/ARQUITECTURA.md`.

**Cómo se mantiene:** se actualiza al terminar cada rebanada, en la misma
sesión. Solo se documenta lo que ya funciona y fue probado; lo que falta va en
la última sección. Si una pantalla cambia, se corrige acá.

**Última actualización:** rebanada 4 (pase desde el check-in, pagos, visitas).

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
| `http://localhost:3000` | El sistema (abre en Clientes) |
| `http://localhost:3000/checkin` | La pantalla de ingreso |

Hoy **no hay usuario ni contraseña**. Por eso el sistema solo se puede abrir
desde la propia PC de recepción.

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

Al guardar se abre la ficha del cliente nuevo, con su número de socio.

### 4.3 Ficha del cliente

Muestra el nombre, si es socio o eventual, sus datos y su membresía.

- **Editar datos:** cambia nombre, apellido, CI, extensión y teléfono.
- **Acceso bloqueado:** si el cliente está bloqueado, se ve un aviso con el
  motivo. Hoy el bloqueo no se puede poner ni quitar desde la pantalla.
- **Referido por:** si alguien lo trajo, aparece quién, con enlace a su ficha.
- **Pagos:** al final de la ficha está todo lo que pagó, y desde ahí se puede
  anular un pago (ver la sección de Pagos).

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

**Elegir otra fecha de inicio:** casilla opcional ("arranca el lunes"). Solo
de hoy en adelante, y no para pases. Mientras no llegue esa fecha, la persona
no puede entrar.

### 5.4 Precios y promociones

- El precio es el del día en que se paga.
- La membresía guarda lo que se cobró. Si el precio del plan cambia después,
  lo ya vendido no cambia.
- Una promoción es un precio con fecha de inicio y de fin. Mientras está
  vigente, se aplica sola.
- Hoy los planes, precios y promociones **no se pueden cargar ni cambiar desde
  la pantalla**.

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

## 9. Respaldo de los datos

Toda la información está en un solo archivo. El respaldo hace una copia segura
sin apagar el sistema, la guarda en la PC y, si está configurada, en una
carpeta sincronizada a la nube. Conserva las últimas 14 copias.

Se programa para que corra solo dos veces al día. La instalación y la
configuración están en `docs/INSTALACION.md`.

**Nunca copiar el archivo de datos a mano con el sistema encendido:** la copia
puede salir dañada.

## 10. Mensajes que puede ver recepción

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
| No se pudo cargar … / Reintentar | Probar con el botón. Si sigue, revisar que el sistema esté encendido. |
| Algo falló en el sistema. Avisale al administrador. | Un error inesperado. Anotar qué se estaba haciendo y avisar. |

## 11. Lo que todavía no existe

Se va tachando a medida que se construye.

- [x] Vender un pase por sesión directamente desde el check-in
- [x] Pagos: historial y anulación con motivo
- [x] Visitas gratis (cortesías, clases de prueba, acompañantes)
- [ ] Registrar quién anuló un pago y cuándo (hoy solo queda el motivo)
- [ ] Enlazar una clase de prueba con el cliente, si después se inscribe
- [ ] Ver visitas de más de 30 días atrás
- [ ] Reportes para el dueño, desde el celular
- [ ] Usuarios y contraseñas
- [ ] Resumen diario al dueño
- [ ] Cargar y cambiar planes, precios y promociones desde la pantalla
- [ ] Bloquear y desbloquear un cliente desde la pantalla
- [ ] Dar de baja un cliente desde la pantalla
- [ ] Fotos de los clientes
- [ ] Indicar quién refirió a un cliente al registrarlo
- [ ] El aspecto visual definitivo (ver `docs/PASADA-VISUAL.md`)

Pendiente de decidir con el dueño: congelar membresías, y deudas o pago en
cuotas.

## 12. Para armar la guía de usuario

Cosas que este archivo no tiene y la guía va a necesitar:

- Capturas de cada pantalla, tomadas después de la pasada visual.
- El nombre del gimnasio y los precios reales.
- Una sección "primer día": instalar, cargar planes y precios, cargar a los
  socios actuales.
- Qué hacer si se corta la luz o se rompe la PC (restaurar un respaldo).
- Una guía corta aparte para el dueño (reportes), distinta de la de recepción.
