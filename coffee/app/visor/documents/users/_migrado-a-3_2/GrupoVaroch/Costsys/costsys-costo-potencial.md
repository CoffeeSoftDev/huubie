# COSTSYS — Tablero de Costo Potencial

| | |
|---|---|
| **Proyecto** | CostSys — Sistema de Costeo Gastronómico (ERP Grupo Varoch) |
| **Documento** | Especificación funcional y técnica del tablero de Costo Potencial |
| **Versión** | 1.0 |
| **Fecha** | 27/06/2026 |
| **Base de datos** | `rfwsmqex_gvsl_costsys` |
| **Módulo** | `DEV/costsys/` |

> Documento generado a partir del análisis del código fuente real del módulo.
> Complementa a [costsys-ers.md](costsys-ers.md) y [costsys-overview.md](costsys-overview.md).

---

## 1. ¿Qué es el Costo Potencial?

El **Costo Potencial** es el tablero analítico central de CostSys. Es un **snapshot mensual por receta** que responde una pregunta concreta del negocio para cada restaurante (UDN):

> **Si este mes vendimos X platillos, ¿cuánto ganamos o perdemos en cada uno?**

Cruza tres elementos:

| Elemento | De dónde sale |
|---|---|
| **Costo real de producción** | Se calcula recursivamente desde ingredientes → subrecetas → recetas (motor `aux_cp`). |
| **Precio de venta** | El precio vigente de la receta, o un **precio propuesto** para simular escenarios. |
| **Desplazamiento** | Unidades realmente vendidas en el mes, importadas desde **Soft Restaurant** (POS). |

El resultado deja de ser sólo "este platillo cuesta $X" para convertirse en "este mes se vendieron 80, el estimado de ventas fue $Y, el costo fue $Z y el margen fue $W".

---

## 2. La tabla en pantalla

El controlador [ctrl-costo-potencial.php](../ctrl/ctrl-costo-potencial.php) en `lsCostoPotencial()` ([línea 42](../ctrl/ctrl-costo-potencial.php#L42)) construye el `thead` y arma las filas. La tabla se **agrupa por subclasificación** (ej. *CORTES*, *BEBIDAS*); las filas de encabezado de grupo llevan `opc: 1` (sin acciones) y las de producto `opc: 0`.

### 2.1 Columnas y origen de cada dato

| Columna | Fórmula / Origen |
|---|---|
| **Producto** | `recetas.nombre` |
| **P. propuesto** | `costopotencial.precio_propuesto` — editable inline al hacer clic en la celda |
| **P. venta** | `recetas.precioVenta` (con IVA) |
| **P. venta sin IVA** | `precioVenta / (1 + (iva + ieps)/100)` |
| **Costo** | `costopotencial.costo` — costo guardado en el snapshot del mes |
| **Costo %** | `(costo / pVentaSinIVA) * 100` |
| **MC** (margen de contribución) | `pVentaSinIVA - costo` |
| **Desplazamiento** | `costopotencial.desplazamiento` — unidades vendidas (Soft Restaurant) |
| **Ventas estimadas** | `pVentaSinIVA * desplazamiento` |
| **Costo estimado** | `costo * desplazamiento` |
| **MC estimado** | `MC * desplazamiento` |

> ⚠️ **Nota sobre el código:** en `aplicarCalculo()` y `calculateCostoPotencial()` la variable se llama `$pVentaIVA`, pero su valor es en realidad el **precio de venta SIN IVA** (`precioVenta / (1 + impuestos/100)`). El nombre es engañoso; la fórmula es correcta.

### 2.2 Semáforos (colores de las celdas)

Definidos en `lsCostoPotencial()` ([líneas 148-152](../ctrl/ctrl-costo-potencial.php#L148-L152)), comparando contra los umbrales del **Tablero de Control** (sección 6):

| Indicador | Regla |
|---|---|
| `bgCosto` | Amarillo (`bg-warning-2`) + icono de alerta si el costo cambió respecto al snapshot guardado. |
| `bgPorcentajeCosto` | Verde si el % de costo es bajo (saludable), rojo si supera el umbral alto. |
| `bgMC` | Verde si el margen de contribución es alto, rojo si es bajo. |
| `bgDesplazamiento` | Verde si el platillo vende por encima del promedio de su clasificación, rojo si por debajo. |

---

## 3. El motor de cálculo de costo (clase `aux_cp`)

El costo real de cada receta se calcula de forma **recursiva** en [mdl-calculo.php](../mdl/mdl-calculo.php), encadenando **ingredientes → subrecetas → recetas**.

### 3.1 Costo de los ingredientes — `totalIngredientesxReceta()` ([línea 344](../mdl/mdl-calculo.php#L344))

```sql
SELECT ROUND(SUM( (precio/contNeto) * cantidad ), 2) AS total
FROM recetas_ingredientes, ingredientes
WHERE idIngrediente = id_Ingrediente AND id_Receta = ?
```

**Fórmula por ingrediente:**

```
costo_ingrediente = (precio_compra / contenido_neto) * cantidad_usada
```

> *Ejemplo:* aceite de oliva a $120 el litro (`precio = 120`, `contNeto = 1000 ml`); la receta usa 50 ml → `(120 / 1000) * 50 = $6.00`.

### 3.2 Costo de la subreceta — `totalSubreceta()` ([línea 14](../mdl/mdl-calculo.php#L14))

Incluye subrecetas anidadas (un nivel), normalizadas por su rendimiento:

```
totalSubreceta = ingredientesSubreceta
               + Σ [ (totalSubSubreceta / rendimientoSubSub) * cantidadUsada ]
```

### 3.3 Costo de la receta — `totalReceta()` ([línea 207](../mdl/mdl-calculo.php#L207))

Combina ingredientes directos + subrecetas vinculadas (normalizadas por rendimiento):

```
totalReceta = totalIngredientesxReceta(idReceta)
            + Σ [ (totalSubreceta / rendimientoSub) * cantidadEnReceta ]
```

La función recorre las subrecetas de la receta (`select_idSubreceta`), y por cada una obtiene su rendimiento (`SelectRendimientoSubreceta`) y la cantidad usada (`SelectCantidadReceta`).

### 3.4 Costo unitario (por porción)

```
costoUnitario = totalReceta / rendimiento_de_la_receta
```

Éste es el costo de producir **una** porción y es la base de todos los indicadores del tablero.

---

## 4. Fórmulas del Costo Potencial

Dos funciones del modelo [mdl-costo-potencial.php](../mdl/mdl-costo-potencial.php) calculan los indicadores:

- **`calculateCostoPotencial()`** ([línea 585](../mdl/mdl-costo-potencial.php#L585)) — usada al **guardar** el snapshot (ejercicio / subir ventas). Si `costopotencial.costo` está vacío, calcula el costo fresco desde `totalReceta / rendimiento`.
- **`aplicarCalculo()`** ([línea 142](../mdl/mdl-costo-potencial.php#L142)) — usada al **mostrar** la tabla. Recalcula los indicadores en tiempo real sobre el `costo` del snapshot, y además calcula `costoReceta = totalReceta / rendimiento` (costo fresco) para detectar diferencias.

### 4.1 Indicadores base

```
impuestos       = iva + ieps
pVentaSinIVA    = precioVenta / (1 + impuestos/100)
MC              = pVentaSinIVA - costo
%costo          = (costo / pVentaSinIVA) * 100

ventasEstimadas = pVentaSinIVA * desplazamiento
costoEstimado   = costo        * desplazamiento
mcEstimado      = MC           * desplazamiento
```

### 4.2 Precio propuesto (simulación)

Si la receta tiene un `precio_propuesto` ≠ 0, el bloque se recalcula con ese precio para responder *"si subo el precio a $X, ¿cuánto gano más?"*:

```
pVentaSinIVApropuesto = precio_propuesto / (1 + impuestos/100)
mcPropuesto           = pVentaSinIVApropuesto - costo
ventasEstPropuesto    = pVentaSinIVApropuesto * desplazamiento
```

En `aplicarCalculo()`, cuando el filtro modificable está activo y hay precio propuesto, la celda de *P. propuesto* se resalta con `bg-warning` y los indicadores mostrados pasan a usar los valores propuestos.

---

## 5. Flujo de datos completo (de Soft Restaurant a la celda)

```
[Soft Restaurant POS]
   │  exporta Excel de productos vendidos del mes
   ▼
[ctrl-subir-ventas.php]  ── carga el archivo
   ▼
[ctrl-costo-potencial-soft.php → SubirCostoPotencialUDNs()]  (línea 390)
   1. Busca el enlace en soft_costsys (tabla puente) → obtiene idReceta de CostSys
   2. Suma el desplazamiento del mes (_GET_CANT_X_MES: soft_folio ⨝ soft_productosvendidos)
   3. Llama a calculateCostoPotencial() con el desplazamiento real
   4. UPDATE costopotencial: guarda costo, %costo, MC, ventas/costo/MC estimados
   ▼
[tabla costopotencial]  ← snapshot persistido
   ▼
[ctrl-costo-potencial.php → lsCostoPotencial()]  (línea 42)
   1. Lee el snapshot (costo, desplazamiento, precio_propuesto)
   2. aplicarCalculo() recalcula MC / %costo / estimados EN TIEMPO REAL
   3. Aplica semáforos (bgCosto, bgPorcentajeCosto, bgMC, bgDesplazamiento)
   4. verificarCostoDiferente(): compara el costo del snapshot vs. el costo
      fresco de aux_cp → si difieren, pinta la fila de amarillo
   ▼
[Tabla HTML en layout/costo-potencial.php]
```

### 5.1 "Real" (snapshot) vs. costo fresco

La columna **Costo** muestra el valor **guardado** en `costopotencial.costo` (del último ejercicio mensual). Pero `verificarCostoDiferente()` ([línea 1073](../ctrl/ctrl-costo-potencial.php#L1073)) compara ese valor contra el costo recalculado al vuelo por `aux_cp`. Si alguien cambió el precio de un ingrediente **después** del ejercicio, ambos difieren: la fila se pinta de **amarillo** y el platillo entra en la lista de "productos modificados" (pendientes de re-costear).

---

## 6. El Ejercicio Mensual

`ejercicioMensual()` ([línea 565](../ctrl/ctrl-costo-potencial.php#L565)) **crea el snapshot de un mes nuevo**:

1. Lee los registros de `costopotencial` del mes anterior (`fecha_inicio`).
2. Verifica que **no** exista ya un registro para el mes nuevo (`fecha_final`).
3. Inserta una copia de cada receta en `costopotencial` con la fecha nueva, heredando `precio_propuesto` y `costo`, pero con `desplazamiento = 0`.
4. Sólo arrastra recetas que aún no tienen ventas (`desplazamiento == 0`) para no duplicar.

Después del ejercicio se debe ejecutar **Subir ventas** para que el desplazamiento se llene con los datos reales de Soft Restaurant.

---

## 7. El Tablero de Control (umbrales de los semáforos)

La tabla `tablerocontrol` guarda, **por clasificación y por mes**, los umbrales que definen los colores del tablero:

| Umbral | Efecto |
|---|---|
| `CostoProduccionAlto` / `CostoProduccionBajo` | Si `%costo` supera el alto → rojo; si baja del bajo → verde. |
| `MargenContribucionAlto` / `MargenContribucionBajo` | Si el MC supera el alto → verde; si baja del bajo → rojo. |

Si no existe tablero para ese mes/clasificación, `lsCostoPotencial()` ([línea 73](../ctrl/ctrl-costo-potencial.php#L73)) lo **crea automáticamente** copiando los umbrales del tablero más reciente de esa clasificación.

---

## 8. Tablas de base de datos involucradas

| Tabla | Rol |
|---|---|
| `costopotencial` | Snapshot mensual por receta (costo, desplazamiento, precio_propuesto, estimados). |
| `recetas`, `recetas_ingredientes`, `recetas_subrecetas` | Composición y precio de venta de las recetas. |
| `ingredientes` | Precio de compra y contenido neto (base del costo). |
| `subrecetas`, `subreceta_subreceta` | Preparaciones intermedias y su anidamiento. |
| `tablerocontrol` | Umbrales (semáforos) por clasificación/mes. |
| `soft_costsys` (BD finanzas) | Tabla puente que homologa producto de Soft ↔ receta de CostSys. |
| `soft_folio`, `soft_productosvendidos` | Ventas importadas de Soft Restaurant (desplazamiento). |

---

## 9. Resumen del ciclo

```
Catálogo de ingredientes/precios
        ↓  (aux_cp calcula costo por receta, recursivo)
Ejercicio mensual  →  crea el snapshot en costopotencial
        ↓
Subir ventas (Soft Restaurant)  →  actualiza el desplazamiento
        ↓
Tablero de control  →  aplica semáforos (costo % y margen)
        ↓
Tabla de Costo Potencial  →  todos los indicadores en tiempo real
```

---

## 10. Glosario rápido

- **Costo unitario:** lo que cuesta producir una porción (`totalReceta / rendimiento`).
- **Desplazamiento:** unidades vendidas del platillo en el mes.
- **MC (Margen de Contribución):** `precio sin IVA − costo`; lo que aporta cada plato vendido.
- **% de Costo:** `(costo / precio sin IVA) × 100`; entre más bajo, más saludable.
- **Snapshot:** foto del costo/ventas del mes, guardada en `costopotencial`; no cambia aunque luego se modifiquen precios de ingredientes (por eso existe la alerta amarilla).
- **Precio propuesto:** precio hipotético para simular el impacto de un ajuste de precio.
