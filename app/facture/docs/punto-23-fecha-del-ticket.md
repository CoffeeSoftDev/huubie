# Si el código cumple el punto 23 (fecha del ticket)

> El punto 23 pide tres cosas: que la generación se ancle a una **fecha operativa**, que esa
> fecha salga de **los movimientos importados** (no del reloj del servidor), y que un archivo
> con **más de una fecha** conserve cada una sin mezclar movimientos ni perder de vista de
> dónde salieron.
>
> **Leído:** controlador y modelo de Tickets, importador de Wansoft, controlador de Cargas,
> la pantalla de Cargas y el DDL con sus 8 migraciones ·
> **Fecha:** 01/09/2026

---

## Veredicto corto

**Lo esencial ya se cumplía.** El papel nace con la fecha de la venta que lo respalda, y las
fechas de un archivo multi-día no se mezclan en ningún punto del reparto.

**Lo que no cumplía estaba un piso más arriba:** el **período del lote** (mes y año) lo escribía
el usuario a mano en el filtro y **nadie lo comparaba contra las fechas que trae el archivo**.
Los movimientos quedaban bien; la bitácora que dice de dónde vinieron, no siempre.

**Corregido el 01/09/2026** (ver "Lo que se implementó" al final).

| Lo que pide el punto | Antes | Ahora |
|---|---|---|
| La generación se asocia a una fecha operativa | Cumple | Cumple |
| Esa fecha es la de los movimientos importados | Cumple | Cumple, y ya no por convención |
| Varias fechas en un archivo se conservan por separado | Cumple | Cumple |
| No mezclar movimientos sin identificar su origen | A medias | **Cumple: el archivo declara su período y se verifica** |

---

## Lo que sí cumple

### 1. La fecha operativa existe y es una columna, no un adorno

`virtual_ticket.issue_date DATE NOT NULL` ([ddl-facturacion.sql:232](../sql/ddl-facturacion.sql)),
y el comentario del propio DDL dice de dónde sale: `DATE(sale.operation_date)`.

No es decorativa: el consecutivo del día cuelga de ella. `UNIQUE KEY uk_virtual_ticket_note
(issue_date, note_number, branch_id)` — la Nota #12 del 30/08 y la Nota #12 del 31/08 conviven
porque la fecha las separa, y dos sucursales del mismo día tampoco chocan.

La corrida también la lleva: `generation_run.issue_date DATE NOT NULL`
([migra-08-corrida-generacion.sql:55](../sql/migra-08-corrida-generacion.sql)), con lo que la
cadena queda cerrada: **corrida → ticket → venta → lote → archivo**, y las cuatro primeras saben
a qué día pertenecen.

### 2. La fecha sale del Excel, no del reloj

El selector de día no ofrece un calendario: ofrece **los días que tienen ventas**.
`lsDias()` ([mdl-facture-tickets.php:70](../mdl/mdl-facture-tickets.php)) es un
`GROUP BY DATE(s.operation_date)` sobre las ventas elegibles de la sucursal, y `init()`
([ctrl-facture-tickets.php:89](../ctrl/ctrl-facture-tickets.php)) abre en el más reciente —no en
hoy—, precisamente porque el Excel del POS se sube en diferido.

El ticket suelto lo hace todavía más explícito: `generarFolio()`
([ctrl-facture-tickets.php:1770](../ctrl/ctrl-facture-tickets.php)) resuelve su día con
`date('Y-m-d', strtotime($item['operation_date']))` —la fecha de **su** venta— y con ella busca
la nota y sella el papel. Regenerar un folio en enero un ticket de agosto no lo mueve de agosto.

Y el papel impreso dice la fecha y la hora del movimiento, no la de impresión:
`cabecera()` (línea 445) escribe `fecha`, `hora` y `fechaHora` desde `operation_date`.

### 3. Cada movimiento entra con su propia fecha

El importador no deduce una fecha para el archivo: la lee renglón por renglón.

| Tabla | Columna | De dónde |
|---|---|---|
| `sale` | `operation_date` (DATETIME) | columna «Fecha» de la fila, vía `cleanDate()` |
| `detail_sale_payment` | `paid_at` | «Fecha de pago» |
| `detail_sale_payment_card` | `operation_date` / `authorized_at` | «Fecha operación» / «Fecha de autorización» |
| `deleted_sale_payment` | `operation_date` / `registered_at` | «Fecha de operación» / «Fecha registro» |

`cleanDate()` ([import-facture-cargas.php:1095](../ctrl/import-facture-cargas.php)) resuelve los
dos formatos con los que el POS exporta: el **serial de Excel** (porque el libro se lee con
`setReadDataOnly`, sin formatos de celda) y el **d/m/Y** —que se voltea a mano antes de
`strtotime`, que si no lo leería como m/d/Y y cambiaría el mes—.

La fecha además **decide qué fila es dato**: el pie de totales trae valor en la columna clave
pero no trae fecha, y por ahí se corta (línea 876).

### 4. Un archivo con varias fechas no se mezcla

Ningún cálculo del módulo trabaja sobre "el archivo": todos trabajan sobre **un día**. Las
consultas del modelo filtran por `DATE(s.operation_date) = ?` sin excepción —el listado, el
conteo, el reparto, los folios libres, la reasignación, la hoja imprimible—, así que el corte
del 16/0%, la numeración de notas y los papeles del 30/08 no ven una sola venta del 31/08.

El resumen diario es el único que recibe el archivo entero, y lo parte él mismo:
`guardarResumen()` ([import-facture2-cargas.php:1336](../ctrl/import-facture2-cargas.php))
agrupa las filas por `substr($fecha, 0, 10)` y escribe una fila de `daily_sale_summary` por día.

Ahí está además el caso mejor resuelto del punto: el bloque de resumen del Excel (comensales,
cortesías, platillos cancelados) es **del rango completo del reporte, no de un día**. Con un
solo día se guarda literal; con varios, el código reconoce que esos conteos no se pueden
repartir y guarda solo los montos, que sí salen día por día de las propias filas
(`$unico = count($dias) === 1`, línea 1354). Es exactamente lo que el punto pide: antes que
inventar un reparto, se deja el dato fuera.

### 5. El origen de cada movimiento está identificado

Cada fila guarda `import_batch_id` y `source_row` —la **fila física** del Excel—, y el lote
guarda `file_name`, la hoja, el usuario y la hora de carga. Desde un ticket se puede llegar al
renglón exacto del archivo que lo originó.

---

## Lo que no cumple

### A. El período del lote lo escribe el usuario y nadie lo verifica contra el archivo

`import_batch` sella cada carga con `period_year` y `period_month`, y esos dos valores salen del
**filtro de la pantalla**, no del contenido:

```php
$mes  = (int) $_POST['mes'];
$anio = (int) $_POST['anio'];
```
([ctrl-facture-cargas.php:919](../ctrl/ctrl-facture-cargas.php))

El propio JS lo declara: *«El periodo lo fija el filtro del modulo, no el nombre del archivo»*
(`confirmarPeriodo`, [cargas.js:1128](../../facture2/src/js/cargas.js)). Y la revisión previa no
podría desmentirlo aunque quisiera: `inspectFile()` **no abre el libro** —le basta con los
nombres de las hojas y la fila de encabezados— así que jamás ve una fecha.

Resultado: un archivo del 31/08 subido con el filtro en julio deja las ventas con su fecha
correcta —el módulo de Tickets sigue funcionando bien— pero el lote dice julio. Y todo lo que
razona por período empieza a apuntar al mes equivocado.

### B. La sobreescritura por período es lo que convierte A en un problema real

`borrarPeriodo()` ([import-facture2-cargas.php:989](../ctrl/import-facture2-cargas.php)) busca
los lotes previos por `(branch_id, anio, mes, hoja)` y borra sus filas. Aplica a las hojas que
**no** son incrementales: bancarias, cancelaciones y eliminados, justo las que no tienen una
llave estable con la que reconocer un movimiento ya visto.

Con un archivo que cruza el corte de mes —30/06 y 01/07 en el mismo export— las filas de junio
quedan dentro de un lote sellado como julio. La recarga de junio no las alcanza, y la de julio
las borra junto con las de julio. En una hoja sin llave de duplicidad, eso son cargos de tarjeta
duplicados o desaparecidos sin que nada lo note.

### C. El candado de notas emitidas también razona por período capturado

`notasDelPeriodo()` (línea 397) impide recargar sobre un período que ya tiene tickets emitidos
—porque el CASCADE de `virtual_ticket.sale_id` se los llevaría—. Pero
`countVirtualTicketByPeriod` ([mdl-facture-cargas.php:294](../mdl/mdl-facture-cargas.php))
cuenta las notas cruzando por `b.period_year` y `b.period_month` **del lote**, no por
`virtual_ticket.issue_date`, que es la fecha real del papel. Con el período mal capturado el
candado protege el mes equivocado: deja pasar la carga que sí iba a borrar notas entregadas.

Es el candado más caro de fallar del módulo, y hoy depende de dos selectores.

### D. El usuario nunca se entera de cuántas fechas trajo el archivo

Terminada la carga, el resumen dice `· resumen del dia guardado` (línea 707) —en singular—
aunque `guardarResumen` haya escrito cinco días. No hay en ninguna parte de la pantalla el rango
de fechas que traía el Excel.

El punto 23 pide conservar cada fecha correctamente **y** no mezclar sin identificar el origen.
Lo primero se cumple; lo segundo se cumple en base pero no a la vista: quien sube un archivo de
tres días creyendo que sube uno no tiene cómo darse cuenta.

### E. El papel se sella con el día de la pantalla, no con el de su venta

`generateDay()` pasa `$dia` —el del POST— y tanto `guardarTicketVirtual()` (línea 1454) como
`guardarTicketServicio()` (línea 1543) lo escriben tal cual en `issue_date`.

Hoy siempre coincide, porque las ventas vienen de `listSaleDayForSplit([branch, $dia])` y ese
filtro es `DATE(s.operation_date) = ?`. Pero es una coincidencia **por convención, no por
construcción**: el día que esa consulta acepte un rango, o que alguien llame al cierre con otro
`dia`, los papeles saldrían sellados con la fecha de la pantalla y no con la de sus ventas.
`generarFolio` ya lo hace bien (línea 1770) y es el patrón a copiar.

Es el hallazgo más barato de cerrar de los cinco.

---

## Lo que hay que construir

### 1. Que el archivo declare su período y el sistema lo verifique (cierra A, B y C)

En la inspección previa, leer la **columna de fecha** de la hoja de detalle y devolver el rango:
primera fecha, última fecha y cuántos días distintos. `inspectFile` hoy no abre el libro por
memoria, pero para esto no hace falta cargarlo entero: la misma lectura por bloques que ya usa
la hoja de comandas (`leePorBloques`) sirve para recorrer una sola columna.

Con eso:

- El diálogo de confirmación deja de preguntar a ciegas: *«Este archivo trae movimientos del
  30/08 al 31/08 (2 días). Se va a cargar en Agosto 2026»*.
- Si el rango **no cae** dentro del período capturado, se rechaza —o se ofrece corregir el
  filtro—, en vez de sellar un lote con un mes que el archivo no contiene.
- Si el rango **cruza dos meses**, el archivo se parte: un lote por mes, cada uno con sus filas.
  Es la única forma de que `borrarPeriodo` siga siendo correcto sin reescribirlo.

### 2. Guardar el rango real en el lote (cierra D y refuerza B)

Dos columnas nuevas en `import_batch`: `first_operation_date` y `last_operation_date`, escritas
del propio contenido al terminar de insertar. Con ellas la bitácora deja de depender de lo que
alguien tecleó, la pantalla puede mostrar *«3 días · 30/08 al 01/09»* en cada renglón, y el
mensaje de cierre puede decir cuántos resúmenes diarios se guardaron en vez de «resumen del dia».

### 3. Contar las notas por su propia fecha (cierra C sin esperar a lo demás)

`countVirtualTicketByPeriod` pasa a filtrar por `YEAR(v.issue_date)` y `MONTH(v.issue_date)`
—o por el rango de fechas del archivo, si ya se implementó el punto 1— en vez de por el período
del lote. El candado deja de depender del filtro y pasa a depender del papel, que es lo que de
verdad se está protegiendo.

Es un cambio de una consulta y se puede hacer solo.

### 4. Sellar el papel con la fecha de su venta (cierra E)

En `guardarTicketVirtual` y `guardarTicketServicio`, cambiar

```php
'issue_date' => $dia,
```

por la fecha del movimiento, como ya hace `generarFolio`:

```php
'issue_date' => date('Y-m-d', strtotime($item['operation_date'])),
```

El resultado es idéntico hoy y deja de serlo por accidente mañana. `$dia` sigue haciendo falta
para la corrida, para la reasignación y para la numeración de notas: eso sí es del día que se
está cerrando.

---

---

## Lo que se implementó (01/09/2026)

Tres de los cinco hallazgos quedaron cerrados. Los cambios se verificaron contra la base local
y contra los dos Excel reales del repositorio.

### 1. El archivo declara su período y el sistema lo verifica — cierra A y B

`fechasAjenas()` en los **dos** importadores, llamado en la revisión previa (para avisar antes de
subir) y otra vez en `procesarLibro` **antes de escribir nada**, junto al candado de notas y por
la misma razón: lo que viene después ya borra.

Lee solo la columna de fecha de cada hoja —declarada como `dateIndex` en el contrato, resuelta
por el mapa de encabezados en Wansoft porque ahí las columnas se corren de sitio— y compara
contra el mes y año del filtro.

**La regla del rechazo** (`periodoAjeno`, en los complements de `import-facture-cargas.php`): se
rechaza solo cuando la **mayoría** de los movimientos cae fuera. Unas pocas filas del mes
anterior son normales —la cuenta que se abre a las 23:50 del último día y se cobra pasada la
medianoche— y bloquear por ellas negaría cargas buenas. El archivo entero del mes equivocado, que
es el error que importa, cae del lado del rechazo sin ambigüedad.

El aviso nombra los días y cuántos movimientos hay en cada uno (`motivo: 'periodo'` en
`alertValidacion`), para que el usuario pueda reconocer su archivo y saber si el mal puesto es el
filtro o el archivo.

### 2. El candado de notas cuenta por la fecha del papel — cierra C

`countVirtualTicketByPeriod` y `listVirtualTicketByPeriod` preguntan por
`YEAR(v.issue_date)` / `MONTH(v.issue_date)` y `v.branch_id`, sin pasar por `import_batch`. El
candado más caro de fallar deja de depender de dos selectores.

De paso, el papel cuyo lote se borró sigue contando: antes el `JOIN import_batch` lo dejaba
fuera del conteo.

### 3. El papel se sella con la fecha de su venta — cierra E

`guardarTicketVirtual` y `guardarTicketServicio` pierden el parámetro `$dia` y escriben
`diaDe($item)`, el helper nuevo que `generarFolio` ya venía aplicando de hecho. Quitar el
parámetro es parte del arreglo: mientras exista, alguien puede pasar un día ajeno.

### Cómo se verificó

| Prueba | Resultado |
|---|---|
| `virtual_ticket.issue_date` contra `DATE(sale.operation_date)` en la base local | **0 desalineados** — el cambio no altera lo ya guardado |
| Candado nuevo vs. viejo sobre agosto 2026, datos reales | **Idénticos**: 26 notas, #3 a #36 |
| Regla de período, 9 casos (mes correcto, mes equivocado, año equivocado, borde de medianoche, mezcla mitad y mitad, hoja vacía, filas sin fecha, d/m/Y que `strtotime` leería al revés) | **9/9** |
| `ReporteVentasPorFormaDePago2026-08-23.xlsx` (Wansoft) subido a 8/2026, 7/2026 y 8/2025 | **pasa, rechaza, rechaza** |
| `Reporte_De_Ventas_20260709.xlsx` (Soft) subido a 6/2026, 7/2026 y 8/2026 | **pasa, rechaza, rechaza** |

Ese último es el hallazgo que mejor justifica el punto 23: **el archivo de ejemplo del propio
repositorio se llama `20260709` y sus 3 821 movimientos son todos de junio de 2026**, repartidos
en 25 días. Quien lo subiera guiándose por el nombre habría sellado el lote en julio, que es
exactamente el error que ahora se rechaza.

### Lo que queda pendiente

- **El rango real en el lote** (hallazgo D): `first_operation_date` / `last_operation_date` en
  `import_batch` piden una migración y una columna en la bitácora. Con la verificación del
  período el dato ya no puede ser incoherente, pero sigue sin poder leerse *«3 días · 30/08 al
  01/09»* en la pantalla de Cargas.
- El mensaje de cierre sigue diciendo `· resumen del dia guardado` en singular aunque se hayan
  escrito varios días.
- Un archivo que **cruza dos meses** entra completo al mes donde está su mayoría, o se rechaza si
  se sube al otro. Partirlo en un lote por mes es lo que lo haría cargable de forma exacta, y es
  trabajo del mismo hallazgo D.

---

## Riesgos detectados de paso

**La fecha del ticket no tiene índice propio.** `virtual_ticket` indexa `issue_date` solo dentro
del UNIQUE `(issue_date, note_number, branch_id)`, que sirve para el consecutivo pero no para
*«dame los papeles del 30/08 de esta sucursal»*: esa consulta entra por el prefijo de la llave y
funciona, pero cualquier búsqueda por sucursal y fecha —sin nota— recorre de más. Con volumen de
varios meses conviene `(branch_id, issue_date)`.

**Un movimiento sin fecha no entra, y no queda registrado que no entró.** La lectura descarta la
fila cuando `cleanDate()` devuelve null (línea 878), que es lo correcto para el pie de totales.
Pero un movimiento real con la celda de fecha vacía o corrupta se descarta por el mismo camino y
en el mismo silencio: no cuenta como rechazado ni como omitido. La carga reporta menos filas de
las que el archivo traía y nada dice por qué.
