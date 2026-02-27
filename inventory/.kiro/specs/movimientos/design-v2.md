# Design Document - Módulo de Movimientos de Inventario v2.0 (Por Grupos)

## Overview

El módulo de Movimientos de Inventario v2.0 es un sistema de consulta y visualización que permite a los usuarios del ERP CoffeeSoft monitorear el historial completo de entradas y salidas del inventario **organizado por grupos de productos**. El módulo proporciona filtros dinámicos por grupo, estadísticas en tiempo real, y un historial detallado con trazabilidad completa de operaciones.

**Características principales:**
- Consulta de movimientos con filtros por mes, año y **grupo** (categoría de productos)
- Tarjetas resumen con totales, entradas, salidas y balance dinámico con colores
- Historial detallado con información de productos, grupos, cantidades y responsables
- Actualización dinámica sin recarga de página (AJAX)
- Validación de datos para mantener integridad del inventario por grupo
- Trazabilidad completa con timestamps, usuarios responsables y grupos
- Pre-selección automática del mes y año actual

**Cambios arquitectónicos v2.0:**
- Reemplazo de `mtto_almacen_zona` por `mtto_almacen` (grupos)
- Filtro de "Almacén" reemplazado por "Grupo"
- Balance con colores dinámicos (verde/rojo)
- Integración con estructura de grupos de la base de datos

## Architecture

### Patrón MVC (Model-View-Controller)

El módulo sigue la arquitectura estándar de CoffeeSoft:

```
operacion/almacen/
├── index.php                    # Vista principal (entry point)
├── js/
│   └── movimientos.js          # Frontend (Templates class)
├── ctrl/
│   └── ctrl-movimientos.php    # Controlador (lógica de negocio)
└── mdl/
    └── mdl-movimientos.php     # Modelo (acceso a datos)
```

### Flujo de Datos

```
Usuario → index.php → movimientos.js (Frontend)
                           ↓
                    useFetch() / AJAX
                           ↓
              ctrl-movimientos.php (Controller)
                           ↓
              mdl-movimientos.php (Model)
                           ↓
        Base de Datos MySQL (mtto_inventar, mtto_almacen)
                           ↓
                    JSON Response
                           ↓
              Actualización UI (jQuery + TailwindCSS)
```

### Diagrama de Relaciones de Base de Datos

```
mtto_inventar (movimientos)
    ├── id_movimiento (PK)
    ├── folio
    ├── fecha
    ├── tipo_movimiento (Entrada/Salida)
    ├── user_id (FK → usuarios)
    └── fecha_creacion

mtto_inventario_d (detalle)
    ├── id_detalle (PK)
    ├── id_movimiento (FK → mtto_inventar)
    ├── id_producto (FK → mtto_almacen)
    ├── cantidad
    ├── stock_anterior
    └── stock_resultante

mtto_almacen (productos/grupos)
    ├── idAlmacen (PK)
    ├── UDN_Almacen
    ├── CodigoEquipo
    ├── Equipo (nombre del producto)
    ├── Area (FK → mtto_almacen_area)
    ├── id_categoria (grupo/categoría)
    └── cantidad (stock actual)

mtto_almacen_area (áreas)
    ├── idArea (PK)
    ├── nombre_area
    └── active

usuarios
    ├── idUser (PK)
    ├── user
    └── usr_estado
```

## Components and Interfaces

### Frontend Components (movimientos.js)

#### Clase Principal: `Movimientos extends Templates`

**Constructor:**
```javascript
constructor(link, div_modulo) {
    super(link, div_modulo);
    this.PROJECT_NAME = "movimientos";
}
```

**Métodos principales:**

1. **`render()`**
   - Inicializa el layout y componentes
   - Llama a `layout()`, `filterBar()`, `summaryCards()`, `lsMovimientos()`

2. **`layout()`**
   - Usa `primaryLayout()` de CoffeeSoft
   - Crea contenedores: `filterBarMovimientos`, `containerMovimientos`
   - Prepara secciones para tarjetas resumen y tabla

3. **`filterBar()`**
   - Usa `createfilterBar()` de CoffeeSoft
   - **Filtros:**
     - **Mes:** Select con todos los meses (moment.js)
     - **Año:** Select con últimos 5 años
     - **Grupo:** Select con grupos activos de `mtto_almacen` (id_categoria)
   - Evento `onchange` → `movimientos.lsMovimientos()`
   - **Pre-selección automática:** Mes y año actual

4. **`summaryCards()`**
   - Crea 4 tarjetas con TailwindCSS:
     - **Total Movimientos:** Icono `icon-box`, color azul
     - **Entradas:** Icono `icon-up-circled`, color verde
     - **Salidas:** Icono `icon-down-circled`, color rojo
     - **Balance:** Icono `icon-chart-line`, color dinámico (verde/rojo)
   - IDs: `cardTotal`, `cardEntradas`, `cardSalidas`, `cardBalance`

5. **`lsMovimientos()`**
   - Usa `createTable()` de CoffeeSoft
   - Consulta: `{ opc: 'lsMovimientos', mes, anio, grupo }`
   - Actualiza tarjetas resumen con `response.resumen`
   - **Balance dinámico:**
     ```javascript
     const balance = response.resumen.balance;
     const balanceColor = balance >= 0 ? "text-green-600" : "text-red-600";
     const balanceSign = balance >= 0 ? "+" : "";
     $("#cardBalance")
         .text(balanceSign + balance)
         .removeClass("text-green-600 text-red-600 text-purple-600")
         .addClass(balanceColor);
     ```
   - Renderiza tabla con historial de movimientos

### Backend Components

#### Controlador (ctrl-movimientos.php)

**Clase:** `ctrl extends mdl`

**Métodos:**

1. **`init()`**
   ```php
   function init() {
       return [
           'grupos' => $this->lsGrupos(),
           'meses' => moment.months(),
           'anios' => Array.from({ length: 5 }, (_, i) => moment().year() - i)
       ];
   }
   ```

2. **`lsMovimientos()`**
   - **Entrada:** `$_POST['mes']`, `$_POST['anio']`, `$_POST['grupo']`
   - **Proceso:**
     1. Llama a `$this->listMovimientos([$mes, $anio, $grupo])`
     2. Itera sobre resultados y formatea filas
     3. Calcula resumen (totales, entradas, salidas, balance)
   - **Salida:**
     ```php
     return [
         'row' => $__row,
         'resumen' => [
             'total' => $totalMovimientos,
             'entradas' => $totalEntradas,
             'salidas' => $totalSalidas,
             'balance' => $totalEntradas - $totalSalidas
         ]
     ];
     ```

3. **`getMovimiento()`**
   - Obtiene detalle de un movimiento específico
   - Incluye información de producto, grupo, área y responsable

#### Modelo (mdl-movimientos.php)

**Clase:** `mdl extends CRUD`

**Métodos:**

1. **`listMovimientos($array)`**
   ```php
   function listMovimientos($array) {
       $query = "
           SELECT 
               m.id_movimiento,
               m.folio,
               m.fecha,
               m.tipo_movimiento,
               m.total_unidades,
               a.Equipo AS producto,
               a.id_categoria AS grupo_id,
               COALESCE(cat.nombre_categoria, 'Sin grupo') AS grupo,
               ar.nombre_area AS area,
               u.user AS responsable,
               u.usr_estado AS responsable_estado
           FROM {$this->bd}mtto_inventar m
           INNER JOIN {$this->bd}mtto_inventario_d d ON m.id_movimiento = d.id_movimiento
           INNER JOIN {$this->bd}mtto_almacen a ON d.id_producto = a.idAlmacen
           LEFT JOIN {$this->bd}mtto_almacen_area ar ON a.Area = ar.idArea
           LEFT JOIN {$this->bd}categorias cat ON a.id_categoria = cat.id
           LEFT JOIN {$this->bd}usuarios u ON m.user_id = u.idUser
           WHERE MONTH(m.fecha) = ? 
             AND YEAR(m.fecha) = ?
             AND (? = 'Todos' OR a.id_categoria = ?)
           ORDER BY m.fecha DESC, m.id_movimiento DESC
       ";
       return $this->_Read($query, $array);
   }
   ```

2. **`lsGrupos()`**
   ```php
   function lsGrupos() {
       $query = "
           SELECT DISTINCT 
               a.id_categoria AS id,
               COALESCE(c.nombre_categoria, 'Sin categoría') AS valor
           FROM {$this->bd}mtto_almacen a
           LEFT JOIN {$this->bd}categorias c ON a.id_categoria = c.id
           WHERE a.id_categoria IS NOT NULL
           ORDER BY valor ASC
       ";
       return $this->_Read($query, []);
   }
   ```

3. **`getResumenMovimientos($array)`**
   ```php
   function getResumenMovimientos($array) {
       $query = "
           SELECT 
               COUNT(DISTINCT m.id_movimiento) AS total_movimientos,
               SUM(CASE WHEN m.tipo_movimiento = 'Entrada' THEN m.total_unidades ELSE 0 END) AS total_entradas,
               SUM(CASE WHEN m.tipo_movimiento = 'Salida' THEN m.total_unidades ELSE 0 END) AS total_salidas
           FROM {$this->bd}mtto_inventar m
           INNER JOIN {$this->bd}mtto_inventario_d d ON m.id_movimiento = d.id_movimiento
           INNER JOIN {$this->bd}mtto_almacen a ON d.id_producto = a.idAlmacen
           WHERE MONTH(m.fecha) = ? 
             AND YEAR(m.fecha) = ?
             AND (? = 'Todos' OR a.id_categoria = ?)
       ";
       return $this->_Read($query, $array)[0];
   }
   ```

## Data Models

### Tabla: `mtto_inventar` (Movimientos)

```sql
CREATE TABLE `mtto_inventar` (
  `id_movimiento` INT(11) PRIMARY KEY AUTO_INCREMENT,
  `folio` VARCHAR(20) UNIQUE NOT NULL,
  `fecha` DATE NOT NULL,
  `tipo_movimiento` ENUM('Entrada', 'Salida') NOT NULL,
  `total_productos` INT(11) DEFAULT 0,
  `total_unidades` INT(11) DEFAULT 0,
  `estado` ENUM('Activa', 'Cancelada') DEFAULT 'Activa',
  `fecha_creacion` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `user_id` INT(11),
  FOREIGN KEY (`user_id`) REFERENCES `usuarios`(`idUser`),
  INDEX `idx_fecha` (`fecha`),
  INDEX `idx_tipo_movimiento` (`tipo_movimiento`),
  INDEX `idx_fecha_tipo` (`fecha`, `tipo_movimiento`)
);
```

### Tabla: `mtto_inventario_d` (Detalle de Movimientos)

```sql
CREATE TABLE `mtto_inventario_d` (
  `id_detalle` INT(11) PRIMARY KEY AUTO_INCREMENT,
  `id_movimiento` INT(11) NOT NULL,
  `id_producto` INT(11) NOT NULL,
  `cantidad` INT(11) NOT NULL CHECK (`cantidad` > 0),
  `stock_anterior` INT(11) NOT NULL,
  `stock_resultante` INT(11) NOT NULL,
  FOREIGN KEY (`id_movimiento`) REFERENCES `mtto_inventar`(`id_movimiento`) ON DELETE CASCADE,
  FOREIGN KEY (`id_producto`) REFERENCES `mtto_almacen`(`idAlmacen`) ON DELETE RESTRICT,
  INDEX `idx_movimiento` (`id_movimiento`),
  INDEX `idx_producto` (`id_producto`)
);
```

### Tabla: `mtto_almacen` (Productos/Grupos)

```sql
-- Tabla existente, se usa para obtener grupos
-- Campos relevantes:
-- - idAlmacen (PK)
-- - Equipo (nombre del producto)
-- - id_categoria (grupo/categoría)
-- - cantidad (stock actual)
-- - Area (FK a mtto_almacen_area)
```

### Relaciones

```
mtto_inventar (1) ←→ (N) mtto_inventario_d
mtto_inventario_d (N) ←→ (1) mtto_almacen (productos)
mtto_almacen (N) ←→ (1) mtto_almacen_area (áreas)
mtto_inventar (N) ←→ (1) usuarios (responsables)
mtto_almacen (N) ←→ (1) categorias (grupos)
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Filter consistency by group
*For any* combination of month, year, and group filters, the displayed movements should only include records where the associated product belongs to the selected group.
**Validates: Requirements 2.1, 2.2, 2.3**

### Property 2: Balance calculation accuracy
*For any* filtered set of movements, the balance displayed should always equal the sum of entry units minus the sum of exit units.
**Validates: Requirements 3.4**

### Property 3: Movement type badge color coding
*For any* movement displayed in the history table, "Entrada" badges should be green and "Salida" badges should be red consistently.
**Validates: Requirements 4.2**

### Property 4: Quantity sign consistency
*For any* movement displayed, entry quantities should have "+" prefix and exit quantities should have "-" prefix.
**Validates: Requirements 4.3**

### Property 5: Chronological ordering
*For any* set of movements displayed, they should be ordered in descending order by date and movement ID (most recent first).
**Validates: Requirements 4.4**

### Property 6: Group association consistency
*For any* movement record, the displayed group should match the id_categoria of the associated product in mtto_almacen table.
**Validates: Requirements 5.5**

### Property 7: Dynamic balance color
*For any* balance value, if balance >= 0 then color should be green with "+" prefix, otherwise red with "-" prefix.
**Validates: Requirements 8.1, 8.2**

### Property 8: Pre-selection accuracy
*For any* initial page load, the month filter should be set to current month and year filter should be set to current year.
**Validates: Requirements 9.1, 9.2**

### Property 9: "Todos los grupos" filter behavior
*For any* query with group filter set to "Todos", the result should include movements from all groups without filtering by id_categoria.
**Validates: Requirements 2.4**

### Property 10: Summary card synchronization
*For any* filter change, all four summary cards should update simultaneously and reflect calculations from the same filtered dataset.
**Validates: Requirements 3.5**

## Error Handling

### Frontend Error Handling

1. **AJAX Request Failures**
   ```javascript
   useFetch({
       url: api,
       data: { opc: 'lsMovimientos', mes, anio, grupo },
       success: (data) => { /* render */ },
       error: (error) => {
           alert({
               icon: 'error',
               title: 'Error de conexión',
               text: 'No se pudieron cargar los movimientos. Intente nuevamente.'
           });
       }
   });
   ```

2. **Empty Results**
   - Mostrar mensaje: "No se encontraron movimientos para el grupo y período seleccionado"
   - Mantener filtros visibles para ajustar búsqueda
   - Mostrar tarjetas resumen con valores en 0

3. **Invalid Group Selection**
   - Validar que el grupo seleccionado exista en la lista
   - Si grupo no existe, revertir a "Todos los grupos"

### Backend Error Handling

1. **Database Connection Errors**
   ```php
   try {
       $movimientos = $this->listMovimientos($params);
   } catch (Exception $e) {
       error_log("Error en listMovimientos: " . $e->getMessage());
       return [
           'status' => 500,
           'message' => 'Error al consultar movimientos',
           'row' => [],
           'resumen' => [
               'total' => 0,
               'entradas' => 0,
               'salidas' => 0,
               'balance' => 0
           ]
       ];
   }
   ```

2. **Invalid Parameters**
   ```php
   if (empty($_POST['mes']) || empty($_POST['anio'])) {
       return [
           'status' => 400,
           'message' => 'Parámetros de filtro inválidos',
           'row' => []
       ];
   }
   ```

3. **No Results Found**
   ```php
   if (empty($movimientos)) {
       return [
           'status' => 200,
           'message' => 'No se encontraron movimientos',
           'row' => [],
           'resumen' => [
               'total' => 0,
               'entradas' => 0,
               'salidas' => 0,
               'balance' => 0
           ]
       ];
   }
   ```

## Testing Strategy

### Unit Testing

**Frontend (JavaScript):**
- Test `filterBar()` genera filtros correctos con grupos
- Test `summaryCards()` calcula balance con colores dinámicos
- Test `lsMovimientos()` formatea datos para tabla con grupos

**Backend (PHP):**
- Test `init()` retorna lista de grupos válida
- Test `lsMovimientos()` con diferentes combinaciones de filtros
- Test `getResumenMovimientos()` calcula totales correctamente por grupo

### Property-Based Testing

**Framework:** PHPUnit con generadores de datos aleatorios

**Configuración:** Mínimo 100 iteraciones por propiedad

**Propiedades a testear:**

1. **Property 1: Filter consistency by group**
   ```php
   /**
    * Feature: movimientos, Property 1: Filter consistency by group
    * Validates: Requirements 2.1, 2.2, 2.3
    */
   public function testFilterConsistencyByGroup() {
       // Generate random month, year, group
       // Query movements with filters
       // Assert all results have products with matching id_categoria
   }
   ```

2. **Property 2: Balance calculation accuracy**
   ```php
   /**
    * Feature: movimientos, Property 2: Balance calculation accuracy
    * Validates: Requirements 3.4
    */
   public function testBalanceCalculation() {
       // Generate random set of movements
       // Calculate balance manually
       // Assert balance = sum(entry_units) - sum(exit_units)
   }
   ```

3. **Property 7: Dynamic balance color**
   ```php
   /**
    * Feature: movimientos, Property 7: Dynamic balance color
    * Validates: Requirements 8.1, 8.2
    */
   public function testDynamicBalanceColor() {
       // Generate random balance values (positive and negative)
       // Check color class assignment
       // Assert green for >= 0, red for < 0
   }
   ```

### Integration Testing

1. **Test filtros por grupo → backend → respuesta**
   - Seleccionar grupo en UI
   - Verificar petición AJAX con parámetro grupo
   - Verificar respuesta JSON válida con movimientos del grupo
   - Verificar actualización de tabla y tarjetas

2. **Test tarjetas resumen con balance dinámico**
   - Cargar movimientos con diferentes balances
   - Verificar cálculo de totales por grupo
   - Verificar colores de tarjetas (verde/rojo para balance)
   - Verificar formato de números con signos

3. **Test pre-selección de filtros**
   - Cargar módulo
   - Verificar mes actual pre-seleccionado
   - Verificar año actual pre-seleccionado
   - Verificar "Todos los grupos" pre-seleccionado

## Performance Considerations

### Database Optimization

1. **Índices estratégicos:**
   - `idx_fecha_tipo` en `mtto_inventar` para filtros combinados
   - `idx_movimiento` en `mtto_inventario_d` para JOINs rápidos
   - `idx_categoria` en `mtto_almacen` para filtros por grupo

2. **Consultas optimizadas:**
   - Usar `INNER JOIN` para relaciones obligatorias
   - Usar `LEFT JOIN` solo para datos opcionales (área, categoría)
   - Especificar columnas necesarias en SELECT
   - Usar `DISTINCT` solo cuando sea necesario

3. **Caché de filtros:**
   - Almacenar lista de grupos en variable global JS
   - Actualizar solo cuando cambien datos maestros

### Frontend Optimization

1. **Lazy Loading:**
   - Implementar paginación con DataTables
   - Configurar `pag: 5` para carga inicial

2. **Debouncing:**
   - No necesario (filtros son select, no input text)

3. **Actualización selectiva:**
   - Solo actualizar tarjetas resumen si cambian valores
   - Usar `removeClass().addClass()` para cambios de color

## Security Considerations

1. **Validación de entrada:**
   - Sanitizar todos los parámetros `$_POST`
   - Usar `$this->util->sql()` para prevenir SQL injection
   - Validar que grupo existe antes de consultar

2. **Autenticación:**
   - Verificar sesión activa en `index.php`
   - Validar cookie `IDU` antes de cargar módulo

3. **Autorización:**
   - Verificar que usuario tenga acceso al módulo
   - Registrar auditoría de consultas por grupo

## Deployment Notes

1. **Requisitos previos:**
   - Tabla `mtto_inventar` debe existir
   - Tabla `mtto_inventario_d` debe existir
   - Tabla `mtto_almacen` debe tener campo `id_categoria`
   - Tabla `usuarios` debe existir
   - Tabla `mtto_almacen_area` debe existir

2. **Migraciones necesarias:**
   - Agregar campo `user_id` a `mtto_inventar` si no existe
   - Crear índice en `mtto_almacen.id_categoria`

3. **Orden de instalación:**
   - Ejecutar scripts de migración SQL
   - Actualizar archivos PHP y JS
   - Configurar permisos de acceso

4. **Configuración:**
   - Ajustar `$this->bd` en modelo según nombre de base de datos
   - Configurar rutas en `index.php`

## Future Enhancements

1. **Exportación de datos:**
   - Exportar movimientos por grupo a Excel/PDF
   - Incluir gráficos de tendencias por categoría

2. **Filtros avanzados:**
   - Filtro por producto específico
   - Filtro por responsable
   - Filtro por rango de cantidades
   - Filtro por área

3. **Visualizaciones:**
   - Gráfico de barras: Entradas vs Salidas por grupo
   - Gráfico de líneas: Tendencia de balance por mes
   - Top 10 productos con más movimientos por grupo

4. **Notificaciones:**
   - Alertas de movimientos críticos por grupo
   - Notificaciones de stock bajo por categoría
   - Resumen diario de movimientos por email

5. **Dashboard:**
   - Panel de control con métricas por grupo
   - Comparativa entre grupos
   - Análisis de rotación de inventario por categoría
