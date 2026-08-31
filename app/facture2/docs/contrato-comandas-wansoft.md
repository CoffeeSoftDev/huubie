# Contrato de comandas · Wansoft

Medición de `reporte-ventas.xlsx` (RYORI RYOKAN, 1–24 ago 2026, generado
2026-08-25 13:51) contra la base viva `fayxzvov_facturacion`.

Este documento cierra el pendiente que el propio importador dejó escrito en
`import-facture2-cargas.php::tabsReservados()`:

> «El layout de Wansoft todavía no se ha medido […] adivinarlo sería escribir un
> contrato que la primera carga real tiraría a la basura.»

Ya está medido. Nada de lo que sigue es supuesto.

---

## 1. Qué trae el libro

Dos hojas, ninguna con pie de totales (a diferencia de las hojas de pago, que sí
lo traen y por eso necesitan `dateIndex`).

| Hoja | headerRow | 1ª fila de datos | Filas | Qué es |
|---|---|---|---|---|
| `Tiempo de orden` | 6 | 7 | **759** | Cabecera: una fila por orden |
| `Detalle de ventas` | 9 | 10 | **8 719** | Renglón: lo que se consumió |

Las dos arrancan en la **columna C** → `startIndex = 2`.

759 filas de cabecera = 759 `Movimiento PDV` distintos en el detalle. La relación
es exacta: **`Tiempo de orden` es el encabezado de la comanda y `Detalle de
ventas` son sus partidas.**

### Cuadre aritmético (verificado, 0 excepciones)

```
Σ Total de renglón (col 40, acción = Venta)  =  1,004,680.00
Σ Total del ticket (col 19, sin repetir)     =  1,004,680.00
tickets que no cuadran: 0 de 759
```

El `Total` del ticket (col 16–19) **se repite en cada partida** — es el total del
movimiento, no del renglón. Nunca se suma. El único monto sumable es el bloque
36–40 («Detalles de venta»). Mismo error que la hoja de pagos ya documenta para
`sale_subtotal / sale_tax / sale_total`.

### Los cuatro bloques de montos

El encabezado de grupo (fila 8) parte la hoja, y **la columna `Acción` decide
qué bloque viene lleno**. Medido:

| Acción | Filas | Bloque 37–40 | Bloque 41–44 | Bloque 45–48 |
|---|---|---|---|---|
| Venta | 8 672 | ✔ | | |
| Anulación de platillo | 34 | | | ✔ |
| Cancelación de platillo | 9 | | ✔ | |
| Cortesía de platillo | 3 | ✔ | ✔ | |
| Cortesía de orden | 1 | ✔ | ✔ | |

Las 43 filas con `Subtotal` (col 16) vacío son exactamente las 34 anulaciones +
9 cancelaciones: el POS no les asigna el total del ticket porque nunca llegaron
a cobrarse. **No son filas corruptas y no deben descartarse** — son la bitácora
de lo que se tiró.

---

## 2. Los tres hallazgos que cambian el diseño

### 2.1 `Descripción` NO es el nombre del producto

La columna 29 tiene **1 267 valores únicos** contra 157 platillos reales. Es
texto libre del capturista:

```
TONKOTSU GYUU RAMEN, 1 CON HUEVO
OCEAN ROLL TEMPURA,** PARA LLEVAR **,
PEDIDO DEL ING LUIS AUTORIZO EL CHEF
autorizo erika fernandez
```

Llega a **123 caracteres** — `detail_sale.description` es `VARCHAR(60)` y lo
truncaría. Es la **nota de la comanda**, y el nombre del producto sale de otro
lado:

- `¿Es modificador? = No` → nombre = col 30 `Platillo / Artículo`
- `¿Es modificador? = Si` → nombre = col 31 `Modificador`

Con esa regla el catálogo queda limpio y sin una sola colisión:

```
157 claves de platillo    -> 157 nombres distintos   (0 claves con 2 nombres)
 17 claves de modificador ->  17 textos distintos    (0 claves con 2 textos)
174 claves totales        -> coincide con los 174 codigos del archivo
```

Las claves `MOD*` son siempre y solo modificadores (1 008 filas, correlación
perfecta con `¿Es modificador? = Si`). En esas filas `Platillo / Artículo` trae
al **padre**, no al producto de la fila: por eso `MODA018` aparece bajo tres
yakisobas distintas. No es una colisión, es la jerarquía.

Los 1 008 modificadores tienen **precio 0 sin excepción**: no aportan importe,
solo describen. Sumarlos como renglones cobrables inflaría la comanda.

### 2.2 El catálogo actual es de otro POS **y de otro restaurante** ⚠

```
claves en el archivo : 174
ya en `product`      :   0   <-- CERO
nuevas               : 174
```

Cero coincidencias no es casualidad: son catálogos de **dos negocios
distintos**, revueltos hoy bajo la misma sucursal.

```
branch 1 = «CAFE DE CHIAPAS SUC. POLIFORUM»   (Tuxtla Gutierrez)  pos_id = 2 (Wansoft)
  ├─ 379 product   -> menu de Soft Restaurant: ARRACHERA SUIZA, HUEVOS AL GUSTO,
  │                   CALDO TLALPENO, BAGUETTE ARRECHO...            (cocina mexicana)
  ├─  17 waiter    -> con `code` numerico (98, 03, 124) = formato Soft Restaurant
  ├─   7 waiter    -> con `code` NULL y nombre real   = formato Wansoft
  └─  36 sale      -> «Sucursal: RYORI RYOKAN», 22 de agosto, cargadas por Wansoft

reporte-ventas.xlsx = «Sucursal: RYORI RYOKAN»
  └─ 174 claves    -> SUSHI BAR ROLLS, RAMEN-YA SOPAS, YAKIMESHI...  (cocina japonesa)
```

El nombre de la sucursal dice Café de Chiapas, el `pos_id` ya apunta a Wansoft, y
los datos que entran son de Ryori Ryokan. **`branch 1` es hoy una bolsa
revuelta.**

#### Por qué esto no puede quedarse así

Ni `sale` ni `product` tienen `pos_id` — verificado. **La única separación que
existe en el modelo es `branch_id`.** Y el generador de tickets virtuales filtra
exactamente por eso, sin nada más
([mdl-facture-tickets.php:529](../../facture/mdl/mdl-facture-tickets.php#L529)):

```sql
WHERE active = 1 AND is_bridge = 1 AND is_modifier = 0 AND price > 0
  AND branch_id <=> ?
```

Si los 174 productos de Ryori Ryokan entran con `branch_id = 1`, quedan en la
misma bolsa que los 379 de Café de Chiapas, y el generador **arma la nota que se
le entrega al cliente mezclando los dos menús**: una cuenta de sushi respaldada
con renglones de «ARRACHERA SUIZA 200GRS» y «CALDO TLALPEÑO».

Hoy no ha explotado solo porque `virtual_ticket` está en **0**: nunca se ha
generado uno. Es una bomba con la mecha puesta, no un problema latente.

Y hay una segunda cara: los **14 productos puente** (`is_bridge = 1`), que son
justamente los que arman esas notas, son **todos de Café de Chiapas**. Para
Ryori Ryokan no existe ni uno. Aunque se resuelva la mezcla, ese catálogo puente
hay que constituirlo.

> **Esta decisión es previa a la carga de comandas y la condiciona entera.**
> Está planteada en §7.

Con los meseros pasa lo mismo en pequeño: 9 en el archivo, 6 ya existen (los de
`code NULL`, cargados por Wansoft), **3 nuevos** (`JORGE GORDILLO`, `MOISES
ROBLES`, `NANCI MARTINEZ`). Los otros 17 son códigos numéricos de Soft
Restaurant que no corresponden a nadie de este archivo. Para resolverlos ya está
`listWaiterByName` + `claveNombre()`, que compara sin acentos.

### 2.3 723 de 759 comandas llegan huérfanas

```
Movimiento PDV en el archivo : 759   (rango 5596 – 6356)
Movimiento PDV en `sale`     :  36   (rango 6266 – 6301)
cruzan hoy                   :  36
huerfanas                    : 723
```

Y `detail_sale` está **vacía (0 filas)**.

Esto no es un defecto del archivo: el reporte de comandas cubre 24 días y el de
ventas solo se ha cargado para un puñado. Pero define la arquitectura de la
carga, y es la decisión más importante del diseño:

> **Los renglones se guardan aunque su venta no exista todavía**, con
> `sale_id = NULL`, y se re-enlazan cuando llegue el reporte de ventas de ese
> día.

El precedente ya está escrito en el mismo módulo: `linkPaymentToSaleByPdv()`
(`mdl-facture2-cargas.php:89`) hace exactamente eso con los pagos. La carga de
comandas necesita su gemelo `linkDetailToSaleByPdv()`, **y además hay que
llamarlo al terminar la carga de ventas**, para que los 723 huérfanos se
enganchen solos cuando su ticket aparezca.

Sin esto, el orden en que el usuario suba los archivos decide si los datos se
enlazan o no — y eso es una trampa.

---

## 3. El contrato, listo para pegar

En `import-facture2-cargas.php::contrato()`. `normalizeHeader()` ya quita los
acentos, por eso los nombres van planos como el resto del archivo.

```php
'Tiempo de orden' => [
    'tab'          => 'commands',
    'target'       => 'wansoft-order',
    'orden'        => 1,              // la cabecera antes que sus renglones
    'headerRow'    => 6,
    'startIndex'   => 2,              // arranca en la columna C
    'keyIndex'     => 1,              // Orden (+ Fecha = identidad del dia)
    'dateIndex'    => 0,              // Fecha de operacion
    'controlIndex' => 9,              // Total
    'required'     => [0, 1, 9],      // Fecha, Orden, Total
    'modo'         => 'incremental',
    'columns' => [
        'Fecha de operacion', 'Orden', 'Tipo de orden', 'Subtipo de orden',
        'Terminal', 'Mesero', 'Subtotal', 'IVA', 'IEPS', 'Total',
        'Hora inicio', 'Hora fin', 'Tiempo total'
    ]
],
'Detalle de ventas' => [
    'tab'          => 'commands',
    'target'       => 'wansoft-command',
    'orden'        => 2,
    'headerRow'    => 9,
    'startIndex'   => 2,
    'keyIndex'     => 4,              // Movimiento PDV: cruza con sale.pdv_movement
    'dateIndex'    => 1,              // Fecha de operacion
    'controlIndex' => 37,             // Total del renglon (bloque sumable)
    // Sin estas no hay renglon que armar: el movimiento lo ancla al ticket,
    // la clave y la cantidad dicen que se consumio, la accion decide de que
    // bloque de montos leer el importe.
    'required'     => [1, 4, 12, 18, 29],
    'modo'         => 'incremental',
    'columns' => [
        'Dia', 'Fecha de operacion', 'Hora de cierre', 'Semana',
        'Movimiento PDV', 'Orden', 'Tipo de orden', 'Subtipo de orden',
        'No. Mesa', 'No. Personas', 'Mesero', 'Terminal', 'Accion',
        'Subtotal', 'IVA', 'IEPS', 'Total', 'Descuento',
        'Cantidad', 'Precio unitario', 'Precio unitario con modificador',
        'Costo real', 'Costo con modificadores', 'Costo ideal',
        'Tipo de grupo', 'Grupo', 'Descripcion', 'Platillo / Articulo',
        'Modificador', 'Clave platillo', 'Codigo de barras',
        'Es modificador', 'Hora de captura', 'Terminal de captura',
        'Subtotal', 'IVA', 'IEPS', 'Total',      // Detalles de venta  (sumable)
        'Subtotal', 'IVA', 'IEPS', 'Total',      // Cortesias y cancelaciones
        'Subtotal', 'IVA', 'IEPS', 'Total'       // Anulaciones
    ]
],
```

> Los índices de `required`, `keyIndex`, `dateIndex` y `controlIndex` son
> **relativos a `startIndex`**, igual que en el resto del contrato: el índice 0
> es la columna C del Excel.

Con esto el tab sale de `tabsReservados()` y deja de ser una radiografía.

**Ojo con el nombre del tab:** el ctrl lo llama `commands` y
[cargas.js:1112](../src/js/cargas.js#L1112) pinta su ícono bajo la llave
`'comandas'`. Hoy no se nota porque el tab nunca ha cargado nada; en cuanto lo
haga, el ícono cae al genérico. Hay que unificar la llave.

---

## 4. Mapeo a la base

### 4.1 `detail_sale` — el renglón de la comanda

Se reusa la tabla, no se crea otra: el DDL la describe como «réplica literal de
`comandas.xls`» y este archivo es su equivalente Wansoft. Las columnas que ya
existen se llenan igual; lo que Wansoft trae de más se agrega con
`addColumnIfMissing`, el mismo patrón con que `migra-05` extendió `sale`.

| Col Excel | # | → `detail_sale` | Nota |
|---|---|---|---|
| Movimiento PDV | 7 | `sale_folio` | llave de cruce con `sale.pdv_movement` |
| No. Mesa | 11 | `table_number` | 238 vacías (para llevar); 42 vienen como texto |
| Mesero | 13 | `waiter_code` + `waiter_id` | resolver con `claveNombre()` |
| Acción | 15 | **`action`** *(nueva)* | decide el bloque de montos |
| Cantidad | 21 | `quantity` | entera 1–10 |
| Precio unitario c/mod | 23 | **`unit_price`** *(nueva)* | idéntica a col 22 en las 8 719 filas |
| Tipo de grupo | 27 | **`group_type`** *(nueva)* | ALIMENTOS / BEBIDAS / DESECHABLES |
| Grupo | 28 | **`group_name`** *(nueva)* | 23 valores |
| Descripción | 29 | `description` → **`VARCHAR(150)`** | nota libre, hasta 123 car. |
| Clave platillo | 32 | `product_code` + `product_id` | 174 claves, todas nuevas |
| ¿Es modificador? | 34 | **`is_modifier`** *(nueva)* | `Si`→1 · `No`→0 |
| Hora de captura | 35 | `captured_at` | |
| Terminal de captura | 36 | **`capture_terminal`** *(nueva)* | |
| Hora de cierre | 5 | `closed_at` | del ticket, se repite |
| Total (bloque activo) | 40/44/48 | `amount` | **según `Acción`**, ver §1 |
| Descuento | 20 | `discount_percent` | 0 en todo el archivo |
| — | | `opened_at` | de `Tiempo de orden`.`Hora inicio` |
| — | | `comanda_folio` | Wansoft no lo trae → `NULL` |

Columnas que **no se guardan** porque son derivables o están vacías:
`Día` (de la fecha), `Semana` (de la fecha), `Orden` / `Tipo de orden` /
`Subtipo` / `Terminal` / `No. Personas` (viven en la cabecera), `Costo real`,
`Costo con modificadores`, `Costo ideal` (0 en las 8 676 filas),
`Código de barras` (vacía en las 8 719), `Precio unitario` (duplica col 23),
`IEPS` (0 en todo el archivo).

### 4.2 `Tiempo de orden` — la cabecera

Sus 13 columnas son todas atributos del ticket, no una entidad nueva. La opción
sobria es **enriquecer `sale`** por `(operation_date, order_number)`, que ya
existen ahí desde `migra-05`:

| Col | → `sale` | Nota |
|---|---|---|
| Hora inicio | **`opened_at`** *(nueva)* | apertura de la mesa |
| Hora fin | `operation_date` | ya se llena desde la hoja de pagos |
| Tiempo total | **`service_minutes`** *(nueva)* | 43–178 min, ya viene calculado |
| Tipo de orden | **`order_type`** *(nueva)* | Restaurant / Para llevar |
| No. Personas | **`guest_count`** *(nueva)* | de `Detalle de ventas` col 12 |

`Subtotal`, `IVA`, `Total` y `Mesero` de esta hoja ya los trae la hoja de pagos:
no se reescriben, se usan para **contrastar**. Si difieren, es un aviso de
cuadre, no una sobrescritura.

### 4.3 `product` — alta del catálogo

174 productos nuevos en la primera carga. `product` ya tiene la forma exacta:

```
code        = Clave platillo
name        = Platillo/Articulo  (si es modificador -> Modificador)
is_modifier = 1 si la clave empieza con MOD
price       = Precio unitario con modificador   (0 en modificadores)
branch_id   = ⚠ PENDIENTE — depende de la decision de §7
```

La forma del registro no tiene discusión; **a qué sucursal pertenece, sí**. Con
`branch_id = 1` los 174 platillos japoneses caen en la misma bolsa que el menú
mexicano de Café de Chiapas y contaminan el generador de notas (§2.2). Este paso
queda bloqueado hasta resolver §7.

`uk_product_code (code, branch_id)` aguanta en cualquiera de los dos escenarios:
las 174 claves son únicas bajo la regla de nombre de §2.1, y ninguna choca con
las 379 existentes (formatos distintos: `SBR022` vs `01036`).

---

## 5. La migración

`migra-10-wansoft-comandas.sql`, con su `-rollback` al lado, siguiendo el patrón
de las nueve anteriores (`addColumnIfMissing` / `addIndexIfMissing`).

```sql
-- detail_sale: lo que Wansoft trae de mas
ALTER TABLE detail_sale MODIFY COLUMN description VARCHAR(150) NULL
    COMMENT 'Wansoft escribe notas del capturista, hasta 123 car.';

CALL addColumnIfMissing('detail_sale', 'action',
    "VARCHAR(30) NULL COMMENT 'Wansoft · Venta/Cortesia/Cancelacion/Anulacion' AFTER description");
CALL addColumnIfMissing('detail_sale', 'group_type',
    "VARCHAR(30) NULL COMMENT 'Wansoft · ALIMENTOS/BEBIDAS/DESECHABLES' AFTER action");
CALL addColumnIfMissing('detail_sale', 'group_name',
    "VARCHAR(60) NULL COMMENT 'Wansoft · grupo del platillo' AFTER group_type");
CALL addColumnIfMissing('detail_sale', 'capture_terminal',
    "VARCHAR(30) NULL COMMENT 'Wansoft · terminal que capturo el renglon' AFTER group_name");
CALL addColumnIfMissing('detail_sale', 'is_modifier',
    "TINYINT NOT NULL DEFAULT 0 COMMENT 'Wansoft · renglon sin importe que describe al padre' AFTER capture_terminal");
CALL addColumnIfMissing('detail_sale', 'unit_price',
    "DOUBLE NOT NULL DEFAULT 0 COMMENT 'Wansoft · precio unitario con modificador' AFTER quantity");

-- El re-enlace de huerfanos busca por aqui.
CALL addIndexIfMissing('detail_sale', 'idx_detail_sale_pdv',
    'KEY idx_detail_sale_pdv (sale_folio, sale_id)');

-- sale: la cabecera de Tiempo de orden
CALL addColumnIfMissing('sale', 'opened_at',
    "DATETIME NULL COMMENT 'Wansoft · Hora inicio de la orden' AFTER operation_date");
CALL addColumnIfMissing('sale', 'service_minutes',
    "INT NULL COMMENT 'Wansoft · Tiempo total en minutos' AFTER opened_at");
CALL addColumnIfMissing('sale', 'order_type',
    "VARCHAR(30) NULL COMMENT 'Wansoft · Restaurant / Para llevar' AFTER order_number");
CALL addColumnIfMissing('sale', 'guest_count',
    "INT NULL COMMENT 'Wansoft · No. Personas' AFTER order_type");
```

Nada de esto rompe la carga de Soft Restaurant: todas las columnas entran
`NULL` o con default, y `description` solo se ensancha.

---

## 6. Orden de trabajo

0. **Resolver §7** (a qué sucursal pertenece Ryori Ryokan). Bloquea los pasos 3
   y 6; los demás pueden avanzar sin ella.
1. **`migra-10-wansoft-comandas.sql`** + su rollback. Aislado y reversible.
2. **Contrato** (§3) en `import-facture2-cargas.php`; sacar `commands` de
   `tabsReservados()` y unificar la llave del ícono con `cargas.js`.
3. **`product` y `waiter`**: alta de los 174 productos y 3 meseros durante la
   carga, con la regla de nombre de §2.1. Sin esto los renglones entran con
   `product_id = NULL`. *(Depende de §7.)*
4. **Parser de `Detalle de ventas`**: el selector de bloque de montos por
   `Acción` es lo único que no existe en los parsers actuales.
5. **`linkDetailToSaleByPdv()`** en el modelo, gemelo de
   `linkPaymentToSaleByPdv`, **llamado también al cerrar la carga de ventas**.
   Es lo que rescata los 723 huérfanos.
6. **Cabecera `Tiempo de orden`**: enriquecer `sale`, contrastando —no
   sobrescribiendo— los montos que ya vinieron de pagos.

### Números de control para la primera carga

Si el importador queda bien, esto es lo que debe reportar con este archivo:

```
import_batch  Detalle de ventas   row_count 8719   control_total 1,004,680.00
import_batch  Tiempo de orden     row_count  759   control_total 1,004,680.00
detail_sale   8719 filas   ·   enlazadas hoy: 448   ·   huerfanas: 8271 renglones / 723 tickets
product       +174    waiter +3
```

---

## 7. Decidido: Ryori Ryokan es sucursal propia

**Ryori Ryokan es el cliente de Wansoft**; Café de Chiapas es el de Soft
Restaurant. Son dos negocios distintos que hoy comparten `branch 1` porque se
reusó esa sucursal para probar la carga de Wansoft — de ahí el `pos_id = 2` sobre
un `business_name` que sigue diciendo Café de Chiapas.

La separación va por **sucursal**, que es la que el modelo ya sabe hacer: no
exige tocar una línea de código. `uk_product_code` ya es `(code, branch_id)` y
`listBridgeProducts` / `listTaxProducts` ya filtran por sucursal.

```
branch 1 = CAFE DE CHIAPAS SUC. POLIFORUM   pos 1 Soft Restaurant   379 product
branch 2 = RYORI RYOKAN                     pos 2 Wansoft           174 product  <- NUEVA
```

### Trabajo previo: los datos de Wansoft ya escritos en branch 1

Las cargas de prueba dejaron datos de Ryori Ryokan dentro de Café de Chiapas.
Antes de dar de alta el catálogo hay que mudarlos:

| Qué | Cuánto | Cómo se identifica |
|---|---|---|
| `sale` | 36 | las que tienen `pdv_movement` (Soft no lo usa) |
| `detail_sale_payment` | 38 | por su `sale_id` |
| `waiter` | 7 | los de `code IS NULL` (Soft los trae con código numérico) |
| `import_batch` | 2 | los de hoja `Detalle por forma de pago` |

Y `branch 1` recupera su `pos_id = 1`, que es el que le corresponde.

> Es un `UPDATE` acotado y reversible, pero **toca datos ya escritos**: va con
> respaldo previo y confirmación explícita, no dentro de la carga.

### Lo que falta en cualquier caso

Constituir el **catálogo puente de Ryori Ryokan**. Los 14 productos
`is_bridge = 1` que hoy existen son de Café de Chiapas, y son los que arman el
papel que se entrega al cliente. Para Ryori Ryokan no hay ninguno: mientras siga
así, ese restaurante no puede generar una nota, y si se le deja usar los
existentes, la genera con platillos que no vende.

Con la sucursal separada esto deja de ser un riesgo de contaminación y pasa a ser
una tarea de alta: los 174 productos entran a `branch 2`, y de ellos se marcan
como puente los que correspondan. Hasta que se marque el primero,
`listBridgeProducts` devuelve vacío para esa sucursal — que es el comportamiento
correcto: mejor no generar nota que generarla mal.

---

## 8. Estado

Sólo se implementó la hoja **Detalle de ventas**. `Tiempo de orden` queda fuera
por decisión explícita: de sus 13 columnas, lo único que no llega por otro lado
es el tiempo de servicio. Las columnas `opened_at` y `service_minutes` de
`migra-10` se quedan en NULL hasta que alguien las pida.

| Paso | Estado |
|---|---|
| Medición del archivo y contrato (§1–§4) | ✅ |
| `migra-10` · columnas del renglón | ✅ aplicada, idempotente |
| `migra-11` · `pos_id` + grupo al catálogo | ✅ aplicada, idempotente |
| `migra-12` · el padre va por nombre | ✅ aplicada, idempotente |
| `limpia-01` · fuera los datos de prueba | ✅ ejecutada, base en cero |
| Contrato de la hoja + salir de `tabsReservados` | ✅ |
| Lector por bloques de 2 000 filas | ✅ probado con 128 MB |
| Parser del bloque de montos por `Acción` | ✅ |
| Alta de `product` y `waiter` | ✅ 174 + 3 |
| Rescate de huérfanos al cargar ventas | ✅ probado: 448 renglones |
| Nombre y RFC de la sucursal | ⏸ **pendiente**: dato de negocio |

### Lo que dio la carga real

```
8 719 renglones   ·   174 productos   ·   759 comandas
suma de ventas    1,004,680.00   (cuadra al centavo con el Excel)
memoria           74 MB de 128        tiempo   39 s
recarga           "ya estaba cargado" · 0 duplicados
```

---

## 9. Lo que sólo se supo al ejecutarlo

Seis defectos que no se veían leyendo el código. Se listan porque cada uno
describe una trampa del entorno, no un descuido puntual, y la siguiente hoja
grande se va a encontrar las mismas.

**1 · PhpSpreadsheet no libera memoria al soltar la variable.** Una hoja
referencia a su libro y el libro a sus hojas; ese ciclo impide al recolector
llevarse nada. Sin `disconnectWorksheets()` explícito, el bloque 3 arrancaba con
93 MB encima y moría. Es el defecto que anulaba la técnica entera: leer por
bloques sin soltar es leer el archivo completo, más lento.

**2 · `mapaIndices` devuelve el índice ABSOLUTO de la columna**, con `startIndex`
ya sumado. Volver a sumarlo corría la lectura dos columnas y el renglón salía con
los datos del vecino. Se notó porque el catálogo daba 2 productos en vez de 174 —
una cifra absurda delata lo que una plausible habría escondido.

**3 · Reemplazo e incremental no pueden convivir.** `borrarPeriodo` borra el lote,
y `fk_detail_sale_batch` es `ON DELETE SET NULL`: los renglones no se van, se
quedan con `import_batch_id` en nulo. Así ya no los ve la consulta que pregunta
por lote, la siguiente carga los da por nuevos y 8 719 se vuelven 17 438.

**4 · `Utileria::sql` convierte el cero en NULL.** Compara con `==`, y en PHP
`0 == ''` es cierto. Contra una columna `NOT NULL` el insert falla entero. No se
tocó la utilería —la usa todo el ecosistema—: no se declaran los ceros y se deja
que la columna tome su DEFAULT.

**5 · El vendor se carga bajo demanda, a propósito.** Una clase que implemente una
interfaz de PhpSpreadsheet no puede declararse al incluir el archivo: obligaría a
tener la librería presente para listar cargas o borrar un lote, que hoy funcionan
sin ella. Va como clase anónima dentro de la función que la usa.

**6 · El archivo declara al platillo padre por NOMBRE, no por clave.** Diez
caracteres no alcanzan: guardaba «YAKIMESHI » por «YAKIMESHI DE CAMARON
AGRIDULCE». Y resolverlo a clave durante la carga no es opción, porque en 238 de
1 008 casos el modificador aparece antes que su platillo.

---

## 10. Lo que queda pendiente

**El nombre y el RFC de la sucursal.** `branch 1` sigue diciendo «CAFE DE CHIAPAS
SUC. POLIFORUM» / `ASSDFCCEEAS` mientras dentro vive el menú de Ryori Ryokan. No
es cosmético: ese nombre y ese RFC son los que se imprimen en la nota que se
entrega al cliente. Es dato de negocio y no se inventa.

**Una comanda corregida no se actualiza.** La carga incremental salta el
movimiento que ya conoce, así que un ticket que el POS corrigió después vuelve a
exportarse pero no entra. Para rehacerlo hay que borrar su lote desde el módulo.
Es el precio de no reemplazar, y es el correcto mientras el archivo cubra un mes
y las ventas se suban por días.

**El error de memoria sigue sin atraparse.** Ya no se dispara en esta hoja, pero
el `catch (Exception)` del módulo no cubre el agotamiento de memoria —en PHP 7 es
un `Error`, otra jerarquía—, así que un archivo bastante más grande daría una
pantalla rota en vez de un aviso. Se resuelve con un `shutdown handler`.
