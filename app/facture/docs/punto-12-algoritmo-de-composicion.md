# Si el código que arma los tickets cumple el punto 12

> El sistema tiene que inventar una lista de platillos y bebidas que sume justo lo que
> se cobró en una venta. Este documento revisa si eso que ya está escrito hace lo que
> el cliente pidió, punto por punto.
>
> **Nivel:** a los 12 · **Leído:** 2 archivos de código (1,948 líneas), 6 consultas a la
> base de datos real, 3 simulaciones del algoritmo con el catálogo y las ventas
> verdaderas · **Fecha:** 27/08/2026
>
> Va sin analogías, por preferencia del usuario.

---

## Veredicto corto

De los diez sub-requisitos del punto 12, **ocho se cumplen sin peros, uno se cumple con
un matiz y uno se cumple con un defecto real pero invisible.**

| # | Lo que pidió el cliente | Veredicto |
|---|---|---|
| 1 | Seleccionar productos y cantidades de manera automática | Cumple |
| 2 | Alcanzar el monto sin excederlo incorrectamente | Cumple |
| 3 | Usar productos individuales | Cumple |
| 4 | Usar repetición de productos | Cumple |
| 5 | Usar cantidades mayores a 1 | Cumple |
| 6 | Usar diferentes combinaciones | Cumple |
| 7 | Mantener coherencia matemática | Cumple |
| 8 | No generar importes negativos | Cumple con un defecto invisible |
| 9 | No usar productos inactivos | Cumple |
| 10 | No usar productos del catálogo incorrecto | Cumple |

El matiz está en el punto 2 y se explica abajo. El defecto del punto 8 no se ve en el
papel impreso, pero sí queda escrito en la base de datos.

---

## De qué tamaño es la cosa

Todo esto son conteos, no estimaciones.

| Cosa | Cuánto |
|---|---|
| Archivos que participan | 2: el controlador (1,469 líneas) y el modelo (479) |
| Funciones que forman el algoritmo | 8, entre las líneas 421 y 630 del controlador |
| Funciones vecinas que lo alimentan o guardan su resultado | 4 más |
| Productos del catálogo de tasa 0% (los "puente") | 13, de $35 a $500, **todos con precio en pesos cerrados** |
| Productos del catálogo con IVA | 334, de los cuales 5 traen centavos |
| Ventas cargadas hoy en la base local | 36 |
| De esas, las que el módulo puede procesar | 19 (Wansoft: solo lo cobrado con tarjeta de crédito) |
| Montos de esas 19 ventas | de $393 a $4,177, **todas en pesos cerrados** |
| De esas 19, cuántas cierran el monto exacto | **19 de 19** |
| Descuento que se aplicó en esas 19 | **$0.00 en todas** |

Esa última fila es el dato más importante del documento: hoy, con el catálogo que está
cargado y las ventas que están cargadas, el sistema **nunca necesita descontar nada.**

---

## Cómo está armado

Son ocho piezas. Cada una hace una sola cosa.

| La pieza | Qué hace, en llano | Cómo se llama en el código |
|---|---|---|
| La puerta de entrada | Recibe un monto y decide qué camino tomar: primero intenta el exacto, y solo si no se puede, el del descuento | `armarPapel()` |
| La lista de montos posibles | Antes de empezar, calcula qué cantidades se pueden pagar justo con los precios que hay | `tablaAlcance()` |
| Los precios disponibles | Junta los precios del catálogo, sin repetir, de mayor a menor | `preciosDe()` |
| Los productos de cada precio | Agrupa los productos que cuestan lo mismo, para poder elegir cuál se imprime | `productosPorPrecio()` |
| El camino principal | Arma la lista que suma **justo** el monto | `armarExacto()` |
| El camino de respaldo | Cuando el monto justo no se puede, arma una lista que se pasa a propósito y descuenta la diferencia | `armarConDescuento()` |
| El armador de renglones | Junta lo elegido y lo convierte en los renglones del ticket | `renglonesDe()` y `lineaPuente()` |
| La semilla | Convierte el número de folio en un número fijo que hace que el resultado sea siempre el mismo | `semillaFolio()` |

Y estas cuatro las rodean:

| La pieza | Qué hace | Nombre |
|---|---|---|
| El repartidor de catálogos | Entrega el catálogo que toca (tasa 0% o con IVA) y lo guarda en memoria para no volver a pedirlo | `catalogo()` |
| El envoltorio de una venta | Pide el papel de una venta y arma la respuesta que ve la pantalla | `armarTicket()` |
| El que guarda | Escribe el ticket y sus renglones en la base | `guardarTicketVirtual()` |
| Las dos consultas | Traen los productos de cada catálogo desde la base | `listBridgeProducts()` y `listTaxProducts()` |

Ninguna se quedó fuera: son las doce que participan.

---

## Cómo funciona por dentro

### La idea central: saber de antemano a dónde no meterse

Si uno va sumando platillos al azar hasta acercarse al monto, se queda atorado. Ejemplo
real con el catálogo cargado: la venta es de **$393**. Si el sistema empieza metiendo una
**ARRACHERA GRATINADA de $254**, le quedan **$139** por cubrir. Y con los precios que hay
—$35, $85, $144, $219, $235, $254, $350, $375, $500— no existe **ninguna** combinación
que sume $139. Ya no hay salida: o se pasa, o se queda corto.

Para que eso no ocurra, antes de elegir el primer producto el sistema construye una
**lista de montos posibles**: recorre del $1 al monto de la venta y va marcando cuáles se
pueden pagar justo. Con este catálogo, por ejemplo, **$139 no se puede** y **$393 sí**.

Con esa lista en la mano, la regla de cada paso es: *solo elijo un precio si lo que me
queda después también está marcado como posible.* Así nunca se llega a un callejón sin
salida, y por eso el camino exacto termina siempre en el monto justo o no arranca
siquiera.

Esa lista se calcula una vez y se guarda mientras dura la corrida, porque el cierre del
día arma decenas de tickets seguidos y todos preguntan lo mismo.

### Cuántos renglones debe tener el ticket

El sistema no mete productos hasta llenar. Apunta a un número de partidas, con esta
cuenta (línea 520 del controlador):

```
partidas = el monto ÷ 220, redondeado, con un mínimo de 3 y un máximo de 12
```

El **220** es un promedio de lo que cuesta una partida en este catálogo. Con eso:

| Venta | Cuenta | Partidas a las que apunta | Renglones que salieron de verdad |
|---|---|---|---|
| $393 (folio 6292) | 393 ÷ 220 = 1.8 → sube al mínimo | 3 | 3 |
| $1,870 (folio 6271) | 1870 ÷ 220 = 8.5 | 9 | 8 |
| $4,177 (folio 6284) | 4177 ÷ 220 = 19 → baja al máximo | 12 | 7 |

En cada paso divide lo que le falta entre las partidas que le quedan, y de los precios
que caben elige **uno de los tres más cercanos a esa cifra**, al azar. Por eso no salen
ochenta aguas de $35: el precio que elige se parece a lo que debería costar la partida.

### Por qué el mismo folio da siempre el mismo ticket

El azar del sistema no es azar de reloj: arranca desde un número que sale del folio de la
venta (`mt_srand($semilla)`, línea 525). El folio **6292** siempre produce el mismo número
de arranque, y de ahí las mismas elecciones.

Comprobado corriendo el algoritmo dos veces sobre el mismo folio:

```
pasada 1: 1x AGUA DE MELON | 2x BISTECES A LA MEXICANA | 2x PIÑA 480 ML
pasada 2: 1x AGUA DE MELON | 2x BISTECES A LA MEXICANA | 2x PIÑA 480 ML
```

**Por qué conviene que sea así:** el ticket se imprime, se vuelve a abrir en pantalla, se
reimprime meses después. Si cada impresión inventara productos distintos, el mismo folio
tendría dos papeles diferentes circulando y ninguno de los dos podría defenderse. Con la
semilla, el papel es reproducible: se puede volver a generar años después y sale idéntico.

Y sigue habiendo variedad entre tickets distintos, porque cada folio trae su propia
semilla. Tres folios con el mismo monto de $393:

```
folio 6292: 2x BISTECES | 1x AGUA DE MELON | 2x PIÑA 480 ML
folio 7001: 2x BISTECES | 1x PIÑA 480 ML | 1x AGUA DE MELON | 1x AGUA DE PIÑA
folio 7002: 2x BISTECES | 2x AGUA DE MELON | 1x PIÑA 480 ML
```

### El camino de respaldo

Si el monto no se puede cerrar justo —porque trae centavos, o porque los precios no dan—
el sistema toma el otro camino: mete productos al azar entre los que caben, y cuando ya no
cabe ninguno completo, agrega **una pieza más del más barato**. Esa última pieza se pasa
del monto a propósito, y la diferencia se registra como **descuento**, para que el papel
cuadre contra lo que de verdad se cobró.

Ejemplo real simulado, una venta de **$1,250.50** (con centavos, así que el camino exacto
no aplica):

```
 1 x ALITAS EN SALSA BBQ           = $  375.00
 3 x PIÑA 480 ML                   = $  105.00
 1 x BAGUETTE ARRECHO              = $  219.00
 1 x ARRACHERA GRATINADA 200 GR    = $  254.00
 1 x ARRACHERA DE LA CASA 250GRS   = $  235.00
 1 x BLUEBERRY R.                  = $   85.00
                        SUBTOTAL     $1,273.00
                       DESCUENTO     $   22.50
                           TOTAL     $1,250.50
```

---

## Un ejemplo de punta a punta

Venta real de la base: **folio 6292, sucursal CAFÉ DE CHIAPAS POLIFORUM, 22/08/2026.**

**1. La venta llega del punto de venta.**
```
folio 6292 · total $393.00 · subtotal $338.79 · IVA $54.21
cobrada con TARJETA DE CREDITO · estado Pagada
```

**2. El reparto del día decide que esta venta va a la tasa 0%.**
El sistema factura el 70% del día al 16% y lo que sobra al 0%. Esta cae del lado del cero,
así que necesita un papel inventado.

**3. Se pide el catálogo correcto.** Los 13 productos marcados como puente:
```
$500 Rollito de jamon · $375 ALITAS EN SALSA BBQ · $375 ALITAS LEMON PEPPER
$350 Extra de queso · $254 ARRACHERA GRATINADA 200 GR · $235 ARRACHERA CESAR
$235 ARRACHERA DE LA CASA 250GRS · $219 BAGUETTE ARRECHO · $144 BISTECES A LA MEXICANA
$85 BLUEBERRY R. · $35 AGUA DE MELON · $35 AGUA DE PIÑA · $35 PIÑA 480 ML
```

**4. El folio se convierte en semilla.**
```
semillaFolio("6292") = 364418469
```

**5. Se calcula la lista de montos posibles hasta $393.** El $393 sale marcado como
alcanzable, así que se toma el camino exacto.

**6. Se apunta a 3 partidas** (393 ÷ 220 = 1.8, sube al mínimo de 3) y se eligen los
precios, cuidando en cada paso que lo que quede siga siendo pagable.

**7. El papel que queda:**
```
 1 x AGUA DE MELON              $ 35.00 c/u  = $  35.00
 2 x BISTECES A LA MEXICANA     $144.00 c/u  = $ 288.00
 2 x PIÑA 480 ML                $ 35.00 c/u  = $  70.00
                                  SUBTOTAL     $ 393.00
                                 DESCUENTO     $   0.00
                                     TOTAL     $ 393.00
```

**8. Se guarda.** Un renglón encabezado en `virtual_ticket` (nota, subtotal $393,
descuento $0, tasa 0, total $393) y tres renglones en `detail_virtual_ticket`.

**9. Se imprime.** El papel sale con el membrete de la sucursal, la mesa y el mesero
—que también salen de la semilla cuando el punto de venta no los exportó— y esos tres
renglones.

---

## Veredicto por cada sub-requisito

### 1. "Seleccionar productos y cantidades de manera automática" — **Cumple**

Nadie captura nada. Se le da un monto y devuelve la lista. Las 19 ventas elegibles del día
22/08/2026 se armaron solas, sin intervención.

### 2. "Alcanzar el monto requerido sin excederlo incorrectamente" — **Cumple**

Las dos mitades de la frase se cumplen, y hay que separarlas:

- **Alcanzar el monto:** siempre. El total que se guarda y se imprime es exactamente el
  total de la venta, por los dos caminos.
- **Sin excederlo incorrectamente:** el camino exacto no se excede nunca. El camino de
  respaldo **sí se excede, pero a propósito y declarándolo**: pone el sobrante como
  descuento en el papel, que es justo la salida que el propio cliente autorizó en el
  documento original ("en caso de que no puedan, a lo mejor un descuento"). Un exceso
  declarado y restado no es un exceso incorrecto.

**Evidencia:** de las 19 ventas reales elegibles, las 19 cerraron por el camino exacto y
el descuento fue $0.00 en todas. La venta de $4,177 (folio 6284) se armó con 7 renglones
que suman $4,177.00 clavados.

**El matiz:** el camino exacto solo funciona con montos en pesos cerrados y con productos
de precio cerrado. Con este catálogo de 13 precios, **416 de los primeros 6,000 montos
enteros no se pueden pagar justo** — por ejemplo $348, $401 y $776. El más alto que no se
puede es $776; de $777 en adelante todos se pueden. Es decir: el riesgo de caer al
descuento vive casi entero en las ventas por debajo de $777. Hoy no muerde porque la venta
más chica de la base es $393 y sí se puede, pero una venta de $348 caería al descuento y
saldría con $11 descontados.

### 3. "Productos individuales" — **Cumple**

En el ticket del folio 6292 hay un renglón de **1 x AGUA DE MELON**. Cantidad uno.

### 4. "Repetición de productos" — **Cumple**

En el ticket del folio 6284 aparecen a la vez **ALITAS EN SALSA BBQ** y **ALITAS LEMON
PEPPER**, dos productos distintos que cuestan lo mismo ($375). El sistema elige al azar
entre los productos que comparten precio (línea 553), así que el papel dice el nombre del
platillo y no un precio repetido.

### 5. "Cantidades mayores a 1" — **Cumple**

Cuando el sistema vuelve a elegir un producto que ya puso, no abre otro renglón: le sube
la cantidad al que ya existe (línea 556). El folio 6284 salió con **4 x Extra de queso** y
**4 x ALITAS LEMON PEPPER**.

### 6. "Diferentes combinaciones" — **Cumple**

Ya mostrado arriba: tres folios distintos con el mismo monto de $393 producen tres
combinaciones distintas. La variedad viene de dos sorteos: cuál de los tres precios más
cercanos se toma, y cuál de los productos que cuestan ese precio se imprime.

### 7. "Coherencia matemática" — **Cumple**

Tres cuentas tienen que cuadrar y las tres cuadran:

- **Cada renglón:** importe = cantidad × precio. 2 × $144.00 = $288.00.
- **El papel:** subtotal − descuento = total. $393.00 − $0.00 = $393.00. Y en el ejemplo
  con descuento: $1,273.00 − $22.50 = $1,250.50.
- **El desglose fiscal del 16%:** base + IVA = total, calculados dividiendo el total entre
  1.16.

Una aclaración que no es un defecto pero conviene tener escrita: en un ticket al 16%, el
`subtotal` que se guarda en la base **es lo que suman los renglones, no la base gravable**.
La base gravable se calcula aparte al momento de imprimir. Están separados a propósito y
el código lo dice en sus comentarios (líneas 923-925), pero quien lea la tabla en crudo
puede confundirlos.

### 8. "No generar importes negativos" — **Cumple, con un defecto invisible**

Lo que se imprime nunca es negativo, y hay que decir por qué de cada cifra:

- **Los importes de renglón:** imposible que sean negativos. Las consultas solo traen
  productos con `price > 0` y las cantidades arrancan en 1.
- **El subtotal:** es la suma de esos renglones, siempre positivo.
- **El total:** es el de la venta.
- **El descuento:** aquí está el defecto.

**El defecto.** El descuento se guarda como `subtotal − total` sin blindarlo (línea 938).
En el camino de respaldo puede quedar un sobrante minúsculo que no llega a cubrirse con
otro producto, y entonces el subtotal queda una pizca por debajo del total y el descuento
sale negativo.

**Comprobado, no supuesto.** Probando combinaciones con los cinco productos que sí tienen
centavos en el catálogo con IVA ($675.27, $110.04, $110.04, $100.04, $65.03), aparecen
**12,153 combinaciones** que dejan ese sobrante. Ejemplo: una venta de $895.35 armada con
$675.27 + $110.04 + $110.04 deja un residuo de 0.00000000000002842 pesos, y el descuento
se guarda como **−0.00000000000002842**.

**Qué tan grave es, en la práctica:**

- **Lo que ve el usuario: nada.** Comprobado: al imprimir, esa cifra sale como `$0.00`. La
  columna del papel no muestra nada raro.
- **Lo que queda en la base: sí importa.** La columna `discount` es de tipo `double`, no un
  decimal de dos posiciones, así que **el número negativo se guarda tal cual**. Un reporte
  que sume descuentos, o un validador fiscal que lea el valor crudo y rechace negativos,
  se topa con él.
- **Qué tan probable es hoy: prácticamente cero.** Requiere tres condiciones juntas: caer
  al camino de respaldo, con productos de precio con centavos, y que la resta deje ese
  residuo. Los 13 productos de tasa 0% —los que arman casi todos los tickets— **tienen
  precios en pesos cerrados**, así que por ese lado no puede pasar. Solo asoma en el
  catálogo con IVA, y ahí solo en 5 productos de 334.

**Conclusión honesta:** el requisito se cumple para lo que el cliente puede ver. El
defecto es real, está confirmado, y es de higiene de datos, no de cara al usuario.

### 9. "No usar productos inactivos" — **Cumple**

Las dos consultas que traen productos exigen `active = 1` (líneas 337 y 350 del modelo).
Un producto dado de baja en Catálogos deja de aparecer en el siguiente ticket que se arme.
No hay ninguna otra vía por la que un producto entre al algoritmo: las dos consultas son
la única fuente.

### 10. "No usar productos del catálogo incorrecto" — **Cumple**

Hay tres filtros encadenados y los tres se aplican en la base, no en el código:

| Filtro | Qué deja fuera |
|---|---|
| `is_bridge = 1` / `is_bridge = 0` | Un ticket al 0% jamás toma un producto con IVA, y al revés |
| `is_modifier = 0` | Los modificadores ("sin cebolla", "término medio") no pueden salir como renglón suelto |
| `branch_id` | Productos de otra sucursal |

Y el reparto del día pide el catálogo que corresponde a cada grupo: al 0% le pasa los
puente, al 16% los que llevan IVA (líneas 788, 800, 834 y 842 del controlador). No hay
punto donde se crucen.

---

## Los otros dos huecos que se revisaron

Además del descuento negativo, se revisaron dos señalamientos más. Uno se confirma, el
otro sale más chico de lo que parecía.

### La venta de total cero desaparece sin explicación — **Confirmado, pero sí se avisa**

Si una venta llegara con total $0.00, el algoritmo devuelve una lista vacía y el sistema
no guarda ningún ticket para ella.

**Qué vería el usuario:** al terminar el reparto del día, el resumen incluye un renglón que
dice **"sin papel: N — faltan productos de tasa 0%"** (línea 689 del archivo de pantalla).
O sea que la venta no desaparece en silencio: se cuenta y se avisa. Lo que sí es engañoso
es **el motivo que da**: dice que faltan productos, cuando en realidad el problema fue que
la venta venía en cero.

**Qué tan probable es:** de las 36 ventas cargadas, **ninguna tiene total cero ni
negativo**; la más baja es $348. Con el punto de venta Wansoft, además, el módulo solo
procesa lo cobrado con tarjeta de crédito, y una venta que no tuvo cobro con tarjeta ni
siquiera entra a la lista.

### El camino de respaldo mete cantidades enormes — **Se confirma la causa, se corrige el tamaño**

Es cierto que el camino de respaldo **no apunta a un número de partidas**: elige al azar
entre todo lo que quepa, sin la cuenta del ÷220 que sí usa el camino exacto. Eso está
verificado en el código (líneas 579-594).

Pero al medirlo con montos reales, **la diferencia es mucho menor de lo que sugiere**.
Comparando los dos caminos sobre los mismos montos:

| Venta | Camino exacto | Camino de respaldo |
|---|---|---|
| $393 | 3 renglones, 5 piezas | 3 renglones, 5 piezas |
| $573 | 5 renglones, 8 piezas | 3 renglones, 3 piezas |
| $1,141 | 6 renglones, 7 piezas | 4 renglones, 6 piezas |
| $1,870 | 8 renglones, 13 piezas | 8 renglones, 12 piezas |
| $4,177 | 7 renglones, 17 piezas | 10 renglones, 22 piezas |

En el rango de una cuenta de restaurante, el papel del respaldo se ve normal — a veces
hasta más corto. **La distorsión sí aparece, pero en montos que este negocio no factura:**
una venta de $24,999.50 sale con 13 renglones y 117 piezas, incluidas 14 órdenes de
BISTECES A LA MEXICANA en un solo renglón. Es un papel que no resiste una mirada, pero
para llegar ahí hace falta una venta seis veces mayor que la más grande registrada.

---

## Con qué habla y qué pasa si se rompe

| Con qué | Por dónde | Qué viaja | Qué deja de funcionar si se rompe |
|---|---|---|---|
| Tabla `product` de `fayxzvov_facturacion` | `listBridgeProducts()` y `listTaxProducts()` | id, código, nombre y precio de los productos activos de cada catálogo | Sin productos puente **no se puede armar ni un solo ticket al 0%**: el reparto del día se detiene con el mensaje "No hay productos de tasa 0% dados de alta" y nadie del 30% queda con papel |
| Tabla `virtual_ticket` | `guardarTicketVirtual()` y `generarFolio()` | nota, subtotal, descuento, tasa, total, fecha y venta | Los tickets se arman pero no se guardan: cada vez que se abre el panel se vuelven a inventar y **la hoja de impresión sale vacía** |
| Tabla `detail_virtual_ticket` | `createVirtualDetail()` | los renglones del papel | Queda el encabezado del ticket sin platillos: **el papel se imprime en blanco** con solo el total |
| Tabla `sale` y sus pagos | `listSaleDayForSplit()` | folio, fecha, subtotal, impuesto y monto cobrado con tarjeta | Sin ventas cargadas el día abre vacío y **el botón de generar responde "No hay ventas pagadas con tarjeta de crédito en el día"** |
| Tabla `branch` y su punto de venta | `getPosCode()` y `getBranch()` | qué sistema exportó el Excel | Si el punto de venta se resuelve mal, **cambian las reglas de qué venta es elegible**: con Wansoft se exige tarjeta de crédito y estado Pagada, y con el otro solo que no sea efectivo. Resolver mal esta columna vacía el listado o lo llena con ventas que no debían facturarse |

Todas estas filas se verificaron abriendo las consultas en el archivo del modelo.

---

## Las palabras que vas a ver

| La palabra | Qué es |
|---|---|
| **Producto puente** | Platillo o bebida marcado a mano en Catálogos para armar los tickets sin IVA. Hoy hay 13 |
| **Ticket virtual** | El papel inventado: no es una venta real, es una lista de productos que suma lo que sí se cobró |
| **Tasa 0% / tasa 16%** | Si el ticket lleva IVA o no. El acuerdo es facturar el 70% del día al 16% y el resto al 0% |
| **Semilla** | Un número que sale del folio y hace que el azar del sistema dé siempre el mismo resultado para esa venta |
| **Lista de montos posibles** | La cuenta previa de qué cantidades se pueden pagar justo con los precios que hay. En el código: `tablaAlcance()` |
| **Partida** | Un renglón del ticket: un producto con su cantidad |
| **Descuento de cuadre** | El sobrante que se resta cuando los productos suman más que el total, para que el papel cierre contra lo cobrado |
| **Modificador** | Un agregado que acompaña a un platillo ("sin cebolla"). Nunca sale como renglón suelto |
| **Folio** | El número con el que el punto de venta identifica la venta |
| **Nota** | El lugar que la venta ocupa en su día. La venta número 7 es la nota 7, antes y después de repartir |

---

## Notas de obra

Lo que no pude verificar, dicho como pendiente:

- **No probé el módulo en el navegador.** Todo se verificó leyendo el código y corriendo el
  algoritmo por separado con el catálogo y las ventas reales. La pantalla podría hacer algo
  distinto con estos datos y yo no lo vería.
- **La base que consulté es la local, no la de producción.** Tiene **36 ventas de un solo
  día** (22/08/2026) y **una sola sucursal**. Todas las cifras de "cuántas cierran exacto"
  valen para ese universo. En producción, con meses de ventas, **la proporción de tickets
  que caen al camino del descuento podría ser distinta** y merece medirse antes de dar el
  punto 12 por cerrado del todo.
- **No pude confirmar si en producción llegan ventas con total cero o negativo.** En local
  no hay ninguna. Lo dejo señalado; no concluyo que no puedan existir.
- **No pude confirmar si en producción hay productos puente con centavos.** Los 13 de local
  son todos de precio cerrado, y de ahí sale la conclusión de que el descuento negativo hoy
  no puede tocar los tickets del 0%. **Si alguien da de alta un producto puente con
  centavos, esa conclusión deja de valer.**
- **El descuento negativo lo reproduje en un banco de pruebas, no en el módulo corriendo.**
  Copié las funciones tal como están y las alimenté con los precios reales con centavos.
  Reproduce el caso, pero no es el mismo código en ejecución.
- **No revisé si algún reporte del sistema suma la columna `discount`.** Es el lugar donde
  el valor negativo sí se notaría, y no lo busqué.

Cosas que encontré de paso y no toqué:

- El aviso "sin papel — faltan productos de tasa 0%" del resumen del reparto da un motivo
  que puede ser falso: también se dispara con una venta de total cero. ¿Lo revisamos aparte?
- La columna `discount` es `double`, no un decimal de dos posiciones. Es lo que permite que
  el residuo minúsculo se guarde en lugar de redondearse a cero.

---

## Tres preguntas para saber si esto se entendió

1. ¿Por qué el sistema calcula la lista de montos posibles **antes** de elegir el primer
   producto, en vez de ir probando y corrigiendo?
2. Dos tickets del mismo día, ambos de $393. ¿Salen con los mismos productos? ¿Y el mismo
   ticket reimpreso un año después?
3. El descuento negativo está confirmado. ¿Por qué **no** lo va a ver el cajero en el papel,
   y dónde sí aparece?

---

## Qué leí para escribir esto

Archivos abiertos completos:

- `app/facture/ctrl/ctrl-facture-tickets.php` — las 1,469 líneas
- `app/facture/mdl/mdl-facture-tickets.php` — las 479 líneas

Archivos leídos por partes:

- `app/facture/src/js/tickets.js` — el resumen del reparto (líneas 660-692) y el texto de
  ayuda del panel (líneas 545-560 y 760-770)
- `app/facture/ERS.md` — las primeras 30 líneas, para contrastar con lo que pidió el cliente

Consultas a `fayxzvov_facturacion` (base local):

- Tipos de columna de `product`, `sale` y `virtual_ticket`
- Conteo de productos por catálogo y cuántos traen centavos
- Los 13 productos puente con su precio
- Las 36 ventas con su total y su monto cobrado con tarjeta
- Sucursal y punto de venta configurados
- Los 5 productos con centavos del catálogo con IVA

Simulaciones corridas con PHP 8.1, copiando las funciones del controlador tal como están:

- Las 19 ventas elegibles reales por el camino que les toque
- Montos que el catálogo no cierra ($348, $401, $776) y montos con centavos
- Búsqueda por fuerza bruta del residuo que produce el descuento negativo
- Comparación de los dos caminos sobre los mismos montos
