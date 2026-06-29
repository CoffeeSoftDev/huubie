# CostSys — Sistema de Costeo de Recetas y Costo Potencial

> Documentación funcional y técnica del módulo `costsys` del ERP-GV (Grupo Varoch).
> Generado por **Coffee Intelligence 🧠☕** a partir del análisis del código fuente y del esquema vivo en MySQL.
> Ruta del módulo: `DEV/costsys/` · Base de datos principal: `rfwsmqex_gvsl_costsys`

---

## 1. ¿Qué es CostSys y cuál es su alcance?

CostSys es el **sistema de costeo gastronómico** del ERP. Resuelve dos grandes preguntas del negocio restaurantero:

1. **¿Cuánto cuesta producir cada platillo?** — A partir de ingredientes, subrecetas y recetas, calcula el costo real de cada producto de forma recursiva (un ingrediente tiene precio; una subreceta agrupa ingredientes y otras subrecetas; una receta agrupa ingredientes y subrecetas).
2. **¿Cuánto debería costar y cuánto se gana?** — Con el costo calculado, el precio de venta y el **desplazamiento** (unidades vendidas), construye el **Costo Potencial**: margen de contribución, % de costo, ventas/costos/MC estimados, y el comparativo contra resultados reales.

El alcance cubre **toda la cadena de costeo y rentabilidad de menú**:

| Bloque | Qué resuelve |
|---|---|
| **Catálogo** | Alta y mantenimiento de Ingredientes, Subrecetas y Recetas (con sus componentes y técnicas). |
| **Administración** | Clasificaciones y subclasificaciones por UDN (categorías de menú). |
| **Costo Potencial** | El corazón: tablero mensual de costo, margen y rentabilidad por clasificación. |
| **Tablero de control** | Umbrales (semáforos) de costo alto/bajo y margen alto/bajo por clasificación/mes. |
| **Integración Soft Restaurant** | Importa desplazamientos (ventas) reales desde el POS para alimentar el costo potencial. |
| **Ingeniería de menú** | Identifica productos a promocionar por ingreso o por margen (matriz de menú). |
| **Cuadro comparativo** | Estado de resultados estimado vs. ventas/costos reales. |
| **Impresión** | Fichas técnicas de recetas, subrecetas y recetario completo. |

Las UDN (Unidades de Negocio) operadas son restaurantes del grupo: **Quinta Tabachines, Baos, Sonora's Meat, Fogaza, Punto Modelo**, etc.

---

## 2. Stack y arquitectura

- **Backend:** PHP 7+ con patrón **MVC manual** (`ctrl/` controladores, `mdl/` modelos, `layout/` vistas).
- **Acceso a datos:** clase base `CRUD` (`conf/_CRUD.php`) con PDO + sentencias preparadas. Métodos `_Read`, `_CUD`, `_Select`, `_Insert`, `_Update`, `_Delete`.
- **Frontend:** **CoffeeSoft.js** (framework jQuery propio, `class App extends Templates`), Bootstrap 5, DataTables, Select2, SweetAlert2, TailwindCSS (CDN, sólo en costo-potencial).
- **Patrón de petición:** cada acción del front envía `POST` con `opc` (la operación). El controlador hace `switch($_POST['opc'])` o resuelve por método (`$fn = $_POST['opc']; $ctrl->$fn();`).
- **Autenticación:** por cookie `IDU` (si falta, redirige a `acceso/ctrl/ctrl-logout.php`). El perfil (`IDP`/`IDP==2`) habilita acciones administrativas en el front.

### Estructura de carpetas

```
costsys/
├── index.php                 # Redirige a catalogo.php (requiere cookie IDU)
├── catalogo.php              # Página: tabs Ingredientes / Subrecetas / Recetas
├── ingredientes.php          # Vista parcial (tab)
├── subrecetas.php            # Vista parcial (tab)
├── recetas.php               # Vista parcial (tab)
├── costo-potencial.php       # Página: tablero de costo potencial (núcleo)
├── administracion.php        # Página: clasificación / subclasificación
├── printReceta.php / printSubReceta.php / printRecetario.php
├── ctrl/                     # 14 controladores (ver §6)
├── mdl/                      # 9 modelos (incluye mdl-calculo.php = motor de costos)
├── src/js/                   # Lógica CoffeeSoft del front (1 archivo por apartado)
├── src/css/ · src/img/
├── layout/head.php · layout/script.php   # <head> y carga de plugins
└── doc/                      # Scripts de importación (xlsx → SQL) de productos/recetas
```

---

## 3. Configuración y conexión a base de datos

### 3.1 Conexión activa

`CRUD` extiende `Conection` (`conf/_Conect.php`). **Toda consulta usa esta conexión.**

```php
// conf/_Conect.php  (Conection)   <-- la que usa _CRUD
$host = "localhost"; $user = "root"; $pass = ""; $db = "rfwsmqex_erp";
```

- En **desarrollo (WAMP local)** la conexión apunta a `localhost / root / rfwsmqex_erp`.
- Existe además `conf/_Conect2.php` (`Conection2`) con las credenciales de **producción**
  (`www.erp-varoch.com`, usuario `rfwsmqex_rs`), pero `_CRUD.php` **no** la usa; queda como conexión alterna.
- Init command: `SET NAMES utf8mb4`. Modo de error: `PDO::ERRMODE_EXCEPTION`.
- Para consultas pesadas se eleva `max_execution_time` a 300s (en `Conection2`).
- Zona horaria: `America/Mexico_City`. Errores se registran en `error.log` (al inicio del archivo, no append).

> ⚠️ **La base de datos del DSN es `rfwsmqex_erp`, no la de costsys.** Por eso el código **referencia cada tabla con su esquema completo** (`rfwsmqex_gvsl_costsys.recetas`, `rfwsmqex_gvsl_produccion.homologado`, etc.). Las tablas sin prefijo (`udn`) se resuelven contra `rfwsmqex_erp` (maestro corporativo de Unidades de Negocio).

### 3.2 Bases de datos involucradas

| Esquema | Rol en CostSys |
|---|---|
| **`rfwsmqex_gvsl_costsys`** | **BD principal**: recetas, ingredientes, subrecetas, costo potencial, tablero, clasificaciones. |
| `rfwsmqex_gvsl_costsys2` | **Clon / staging** con la misma estructura (21 tablas idénticas). Útil para pruebas; el código de producción apunta a `costsys`. |
| `rfwsmqex_erp` | Maestro corporativo: tabla **`udn`** (Unidades de Negocio). |
| `rfwsmqex_gvsl_produccion` | `homologado`, `listaproductos`, `almacen_productos`, `lista_productos`, `almacen_area` (enlace producción ↔ costsys y productos vendidos). |
| `rfwsmqex_gvsl_finanzas` | Familia `soft_*` (Soft Restaurant POS): `soft_productos`, `soft_costsys`, `soft_folio`, `soft_productosvendidos`, `soft_grupoproductos`, etc. |

> 📌 El prefijo de BD está **hardcodeado** dentro de cada modelo (`$this->bd = 'rfwsmqex_gvsl_costsys.'`). No hay archivo de configuración central de esquemas. Ver oportunidades de mejora (§8).

---

## 4. Modelo de datos (`rfwsmqex_gvsl_costsys`)

21 tablas. Volúmenes reales (aprox.): `costopotencial` ≈ 59.6k filas, `recetas` ≈ 1.3k, `recetas_ingredientes` ≈ 4.1k, `ingredientes` ≈ 1.3k, `subreceta_ingrediente` ≈ 2k.

### 4.1 Catálogo de insumos

```
ingredientes(idIngrediente PK, id_UDN, nombre, contNeto, precio,
             id_Unidad→unidad, id_Proveedor→proveedor, id_Marca→marca, descripcion)
unidad(idUnidad PK, nombre)         marca(idMarca PK, nombre)
proveedor(idProveedor PK, nombre)
```

- **`contNeto`** = contenido neto de presentación; **`precio`** = precio de compra de esa presentación.
- Costo unitario de un ingrediente en una receta = `(precio / contNeto) * cantidad`.

### 4.2 Recetas y subrecetas (estructura recursiva)

```
subreceta(idSubreceta PK, id_UDN, id_Clasificacion, nombre, precioVenta,
          id_Unidad, rendimiento, nota, folio, foto, id_Status)
recetas(idReceta PK, id_UDN, id_Clasificacion, id_Subclasificacion, nombre,
        precioVenta, rendimiento, iva, ieps, id_Estado→estados, ...)

-- Composición (tablas puente con cantidad + técnica):
subreceta_ingrediente(id_Subreceta, id_Ingrediente, cantidad, tecnica)
subreceta_subreceta(id_Subreceta1, id_Subreceta2, cantidad, tecnica)   -- subreceta dentro de subreceta
recetas_ingredientes(id_Receta, id_Ingrediente, cantidad, tecnica)
recetas_subrecetas(id_Receta, id_Subreceta, cantidad, tecnica)
```

> ⚠️ Las tablas puente **no tienen PK propia ni claves foráneas declaradas** (la integridad la garantiza la aplicación).

```
            ┌──────────────┐
            │ ingredientes │ (precio, contNeto)
            └──────┬───────┘
        cantidad   │   cantidad
   ┌───────────────┼────────────────┐
   ▼                                 ▼
┌────────────┐  subreceta_subreceta ┌──────────┐
│ subreceta  │◄────(rendimiento)────│ subreceta│
└─────┬──────┘                      └──────────┘
      │ recetas_subrecetas (cantidad)
      ▼
┌────────────┐  recetas_ingredientes
│  recetas   │◄───── ingredientes
└─────┬──────┘
      │  receta = idReceta
      ▼
┌────────────────┐
│ costopotencial │ (snapshot mensual de costo + rentabilidad)
└────────────────┘
```

### 4.3 Clasificación de menú

```
clasificacion(idClasificacion PK, Clasificacion, id_UDN, iva, ieps, stado)
subclasificacion(idSubClasificacion PK, id_Clasificacion, nombre, Stado)
estados(idEstado PK, name_estado)   -- 0=DESCONTINUADO, 1=POR VALIDAR, 2=VALIDADO
```

Ejemplos reales de clasificaciones: UDN 5 (Sonora's Meat) → BEBIDAS, CORTES, GUARNICIONES, ADITAMENTOS PARA ASAR; UDN 6 (Fogaza) → BIZCOCHO, CAFE, FRANCES, PASTELERIA, ABARROTES. El **IVA** suele ser 8% y el **IEPS** 0 a nivel clasificación (heredados a la receta).

### 4.4 Costo Potencial (tabla central de análisis)

`costopotencial` es un **snapshot mensual por receta**:

```
costopotencial(
  idcostopotencial PK, idE (UDN), id_Clasificacion, receta→recetas, fecha_costo (mensual),
  precioventa, precio_propuesto, iva, ieps, costo, costo_porc, margencontribucion,
  desplazamiento,                              -- unidades vendidas (de Soft Restaurant)
  ventasestimadas, costoestimado, mc_estimado, -- escenario actual
  ventasestimadas_propuesto, costoestimado_propuesto, mcestimado_propuesto,
  mc_propuesto, costo_porc_propuesto,          -- escenario con precio propuesto
  upd_receta)
```

### 4.5 Tablero de control y comparativos

```
tablerocontrol(idTablero PK, id_UDN, id_Clasificacion, fechaMovimiento,
   CostoProduccionAlto, CostoProduccionBajo,        -- umbrales semáforo de % costo
   MargenContribucionAlto, MargenContribucionBajo,  -- umbrales semáforo de MC
   ventascosto, ventasoficial, desplazamientoPromedio,
   costoPotencialPropuesto, costoPotencialReal,
   ventaEstimadaPropuesta/Real, costoEstimadoPropuesto/Real, mcEstimadoPropuesto/Real)

comparativo(idComparativo PK, costopotencial1, estadoResultado, costopotencial2,
            ventasCostos, id_Clasificacion)
bitacora_precios(idBitacora PK, idReceta, precioAnterior, precioActual, iva, fechaCambio)
```

### 4.6 Menú / homologación POS

```
costsys_menu(idmenu PK, categoria, status, id_udn, id_clasificacion, orderMenu)
dishes(idDishes PK, dish, status, id_receta, id_menu)
costsys_folio(idfolio PK, fecha_folio, id_udn)
receta(...)   -- tabla "receta" (singular) legacy, distinta de "recetas"
```

> 🔎 Convivencia de `receta` (singular, legacy con `idcostsys`/`idSoft`) y `recetas` (plural, la que usa el motor actual). El código productivo usa **`recetas`**.

---

## 5. Motor de costeo (`mdl/mdl-calculo.php` → clase `aux_cp`)

Es la pieza más importante. Calcula el costo total de una receta recorriendo su árbol de componentes.

### Costo de una receta — `totalReceta($idReceta)`

```
totalReceta = totalIngredientesxReceta(idReceta)
            + Σ  ( totalSubreceta(idSub) / rendimientoSub ) * cantidadEnReceta
```

- `totalIngredientesxReceta` = `Σ (precio/contNeto) * cantidad` de `recetas_ingredientes`.
- Por cada subreceta ligada (`recetas_subrecetas`), se calcula su costo, se normaliza por su `rendimiento` y se multiplica por la `cantidad` usada.

### Costo de una subreceta — `totalSubreceta($idSubreceta)` (un nivel de anidación)

```
totalSubreceta = totalIngredientesxSubreceta(idSub)
               + Σ ( totalIngredientesxSubreceta(idSub2) / rendimientoSub2 ) * cantidad
```

Soporta **subrecetas dentro de subrecetas** (`subreceta_subreceta`), un nivel de profundidad.

### Costo unitario y costo potencial

```
costoUnitario   = totalReceta / rendimiento
impuestos       = iva + ieps
pVentaSinIVA    = precioVenta / (1 + impuestos/100)
margenContrib   = pVentaSinIVA − costoUnitario
%costo          = (costoUnitario / pVentaSinIVA) * 100
ventasEstimadas = pVentaSinIVA  * desplazamiento
costoEstimado   = costoUnitario * desplazamiento
mcEstimado      = margenContrib * desplazamiento
```

Si la receta tiene **`precio_propuesto`**, se recalcula el mismo bloque con ese precio para el **escenario propuesto** (columnas `*_propuesto`), permitiendo simular cambios de precio.

> Hay **tres implementaciones casi duplicadas** de este cálculo (`Costsys::aplicarCalculo`, `Costsys::calculateCostoPotencial`, `SoftRestaurant::calculoCostoPotencial`, `Costopotencial::calculoCostoPotencial`). Difieren en detalles (uso de costo guardado vs. recalculado, precio propuesto del mes anterior). Ver §8.

---

## 6. Apartados del sistema (módulos)

### 6.1 Catálogo (`catalogo.php`)
Página con tres pestañas. Selector de **UDN** y **Clasificación** arriba.

| Tab | Controlador / Modelo | Funcionalidad |
|---|---|---|
| **Ingredientes** | `ctrl-ingredientes` · `mdl-ingredientes` | CRUD de ingredientes; alta de proveedor/marca/unidad (`ctrl-catalogo`); listas para recetas/subrecetas. |
| **Subrecetas** | `ctrl-subrecetas` · `mdl-subrecetas` | CRUD de subrecetas; gestión de `subreceta_ingrediente` y `subreceta_subreceta`; procedimiento culinario; impresión; foto. |
| **Recetas** | `ctrl-recetas` · `mdl-recetas` | CRUD de recetas; componentes (`recetas_ingredientes`, `recetas_subrecetas`); **vincular con Soft Restaurant** y con **Producción**; validar receta; foto; impresión. |

Operaciones (`opc`) típicas: `tbIngredientes`, `createOrUpdateIngredientes`, `tbRecetas`, `createRecetasIngredientes`, `vincularSoftReceta`, `vincularProduccionReceta`, `procedimientoCulinarioReceta`, `printReceta`…

### 6.2 Administración (`administracion.php`)
`ctrl-administracion` · `mdl-administracion`. Dos pestañas:
- **Clasificación**: alta/baja por UDN, con impuestos (IVA/IEPS).
- **SubClasificación**: alta/baja ligada a una clasificación.

### 6.3 Costo Potencial (`costo-potencial.php`) — núcleo
Página que orquesta **7 controladores** y otros tantos JS. El front instancia las clases CoffeeSoft `CostSys`, `TableroControl`, `cuadroComparativo`, `SoftRestaurant`, `MenuCostsys`, `Desplazamiento`, `AppSoftRestaurant`, `AppSoft`.

| Controlador | Responsabilidad |
|---|---|
| **`ctrl-costo-potencial`** | Tablero principal: lista costo potencial por clasificación/mes/año; captura de **precio propuesto** y **desplazamiento**; ejercicio mensual (genera el snapshot del mes); limpiar desplazamiento/precio; actualizar precios; productos modificados. |
| **`ctrl-costo-potencial-tablero`** | `tablerocontrol`: define y actualiza **umbrales semáforo** (% costo alto/bajo, MC alto/bajo), ventas/costos y márgenes estimados vs. reales. |
| **`ctrl-costo-potencial-soft`** | Puente con Soft Restaurant: **subir desplazamientos** (ventas) por UDN, crear el tablero de costo potencial del mes, casos especiales (p. ej. Fogaza). |
| **`ctrl-costo-potencial-desplazamiento`** | Lista de desplazamientos cargados (estados/semáforo). |
| **`ctrl-cuadro-comparativo`** | **Estado de resultados** estimado y **ventas vs. costos** reales; color por desviación. |
| **`ctrl-menu`** | **Ingeniería de menú**: clasifica productos a promocionar por **ingreso** y por **margen**; gráficas; productos sin venta. |
| **`ctrl-app-soft-restaurant`** / **`ctrl-app-soft`** | Productos vendidos, ventas, KPI y bitácora desde el POS. |

Semáforos de color (`getDesplazamientoClass`, `determinarBgCosto`, `determinarBgMC`) comparan cada receta contra los umbrales del `tablerocontrol`.

### 6.4 Subir Ventas (`ctrl-subir-ventas`)
Importa archivos de **productos vendidos / ventas** del POS Soft Restaurant, los categoriza (claves 801–809) y alimenta el desplazamiento. Genera tickets de resumen (`ticket_head` / `ticket_footer`).

### 6.5 Impresión
`printReceta.php`, `printSubReceta.php`, `printRecetario.php` (+ sus JS) generan **fichas técnicas** con ingredientes, técnicas, costos y rendimiento, usando el motor `aux_cp`.

---

## 7. Flujo de trabajo end-to-end

```
1. Catálogo → Ingredientes        : se cargan insumos con precio y contenido neto.
2. Catálogo → Subrecetas          : se arman bases/preparaciones (ingredientes + subrecetas).
3. Catálogo → Recetas             : se arma el platillo final (ingredientes + subrecetas),
                                     se asigna precioVenta, rendimiento, IVA/IEPS, clasificación.
   └─ (opcional) Vincular receta ↔ Soft Restaurant / Producción.
4. Soft Restaurant → Subir ventas : se importan unidades vendidas (desplazamiento) del mes.
5. Costo Potencial → Ejercicio    : se genera el snapshot mensual (costopotencial) por
                                     clasificación: costo, %costo, MC, estimados.
6. Tablero de control             : se fijan umbrales (semáforos) de costo y margen.
7. Análisis                       : Cuadro comparativo (estimado vs real) + Ingeniería de menú
                                     (qué promover por ingreso/margen) + precios propuestos.
```

---

## 8. Oportunidades de mejora

### 8.1 Arquitectura y convenciones (vs. estándar ERP-GV)
- **Nombres de métodos fuera de convención.** Los controladores usan `list()`, `init()` y `switch($_POST['opc'])` con cadenas tipo `createOrUpdateIngredientes`. El estándar del proyecto (CLAUDE.md) prohíbe `list/create/update/get` en controladores y pide `init()/ls()/add[E]()/edit[E]()`. Migrar progresivamente.
- **Esquemas de BD hardcodeados** en cada modelo (`'rfwsmqex_gvsl_costsys.'`). Centralizar en un archivo de configuración (constantes/env) para poder cambiar entre `costsys` y `costsys2` o entre dev/prod sin editar 9 modelos.
- **Dos clases de conexión** (`Conection` local vs `Conection2` prod) y credenciales en texto plano dentro de `_Conect*.php`. Mover a `.env` (ya existe `conf/.env` + `getEnv.php` para OpenAI; extenderlo a la BD) y dejar una sola conexión parametrizada.

### 8.2 Duplicación de lógica
- **El cálculo de costo potencial está replicado 3–4 veces** (`aplicarCalculo`, `calculateCostoPotencial`, `calculoCostoPotencial` en `Costsys`, `SoftRestaurant`, `Costopotencial`). Unificar en **un solo servicio de costeo** (extender/centralizar en `aux_cp`) para evitar divergencias de fórmula.
- Varias clases en `mdl-costo-potencial.php` (`Costsys`, `TableroControl`, `SoftRestaurant`, `cuadroComp`, `Costopotencial`) repiten `selectTablero`, `selectSumatoriasEstimadas`, `lsUDN`. Consolidar.
- `getFilterDate`, `evaluar`, `determinarBgCosto/MC` están **copiados** entre `ctrl-costo-potencial`, `ctrl-menu`, etc. Extraer a un helper compartido.

### 8.3 Integridad y modelo de datos
- **Faltan PK y FOREIGN KEYs** en las tablas puente (`recetas_ingredientes`, `recetas_subrecetas`, `subreceta_ingrediente`, `subreceta_subreceta`). Agregar PK compuesta + FKs evita huérfanos y duplicados.
- Convivencia de tablas `receta` (legacy) y `recetas` (activa): documentar o **deprecar** la legacy.
- `costopotencial` tiene `id_Clasificacion`/`idE` denormalizados respecto de `recetas`; hay registros con `fecha_costo = 1969-12-31` (datos basura) — conviene una limpieza y un `CHECK`/validación de fecha mensual (día 01).
- La BD **`costsys2`** es un clon con datos divergentes (51k vs 59k filas en `costopotencial`). Definir cuál es la fuente de verdad y retirar la otra para evitar confusión.

### 8.4 Robustez y rendimiento
- **`_Read` retorna `[]` al fallar** (silencioso). Muchos métodos hacen `return $sql[0]` o `foreach($sql as $row)` sin validar vacío → posibles *notices*/datos nulos. Añadir guardas.
- El motor `aux_cp` ejecuta **N+1 queries** por receta (una por subreceta/ingrediente). Para recetarios grandes o el ejercicio mensual masivo, considerar **precálculo** (materializar el costo en `recetas`/`costopotencial`) o queries agregadas con CTE.
- `costopotencial` (≈60k filas) se filtra por `MONTH()`/`YEAR()` de `fecha_costo`, lo que **impide usar índice**. Indexar `fecha_costo`, `receta`, `id_Clasificacion`, `idE` (compuesto) acelera el tablero.
- Falta manejo `try/catch` consistente; el estándar del proyecto pide validaciones condicionales — homogeneizar.

### 8.5 Seguridad
- Credenciales de producción versionadas en `_Conect2.php`. **Rotar y mover a `.env`** fuera del repositorio.
- Autorización basada sólo en cookie `IDU`/`IDP` validada en el front (`setTimeout` que oculta botones). La validación de permisos debe hacerse también en el **backend**.

---

## 9. Referencia rápida

| Quiero… | Voy a… |
|---|---|
| Dar de alta un insumo | Catálogo → Ingredientes |
| Armar una preparación base | Catálogo → Subrecetas |
| Crear/costear un platillo | Catálogo → Recetas |
| Ver el costo real del mes | Costo Potencial → ejercicio mensual |
| Definir semáforos de costo/margen | Costo Potencial → Tablero de control |
| Cargar ventas del POS | Subir Ventas / Costo Potencial → Soft |
| Decidir qué promocionar | Costo Potencial → Ingeniería de menú |
| Comparar estimado vs real | Costo Potencial → Cuadro comparativo |
| Imprimir ficha técnica | printReceta / printRecetario |

---

*Documento generado con conexión MCP/CLI al MySQL vivo (`rfwsmqex_gvsl_costsys`) y lectura del código fuente. Cualquier cambio de esquema o de convención debe reflejarse aquí.*
