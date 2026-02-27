# Design Document - Módulo de Movimientos de Inventario

## Overview

El módulo de Movimientos de Inventario es un sistema de consulta y visualización que permite a los usuarios del ERP CoffeeSoft monitorear el historial completo de entradas y salidas del inventario. El módulo proporciona filtros dinámicos, estadísticas en tiempo real, y un historial detallado con trazabilidad completa de operaciones.

**Características principales:**
- Consulta de movimientos con filtros por mes, año y almacén
- Tarjetas resumen con totales, entradas, salidas y balance
- Historial detallado con información de productos, cantidades y responsables
- Actualización dinámica sin recarga de página (AJAX)
- Validación de datos para mantener integridad del inventario
- Trazabilidad completa con timestamps y usuarios responsables

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
                    Base de Datos MySQL
                           ↓
                    JSON Response
                           ↓
              Actualización UI (jQuery + TailwindCSS)
```

## Components and Interfaces

### Frontend Components (movimientos.js)

#### Clase Principal: `App extends Templates`

**Métodos principales:**

1. **`render()`**
   - Inicializa el layout y componentes
   - Llama a `layout()`, `filterBar()`, `lsMovimientos()`

2. **`layout()`**
   - Usa `primaryLayout()` de CoffeeSoft
   - Crea contenedores: `filterBarMovimientos`, `containerMovimientos`

3. **`filterBar()`**
   - Usa `createfilterBar()` de CoffeeSoft
   - Filtros: Mes (select), Año (select), Almacén (select)
   - Evento `onchange` → `app.lsMovimientos()`

4. **`lsMovimientos()`**
   - Usa `createTable()` de CoffeeSoft
   - Consulta: `{ opc: 'lsMovimientos', mes, anio, almacen }`
   - Renderiza tabla con historial de movimientos

5. **`summaryCards()`**
   - Usa `infoCard()` de CoffeeSoft (componente personalizado)
   - Muestra: Total Movimientos, Entradas, Salidas, Balance
   - Colores: verde (entradas), rojo (salidas)

### Backend Components

#### Controlador (ctrl-movimientos.php)

**Clase:** `ctrl extends mdl`

**Métodos:**

1. **`init()`**
   ```php
   return [
       'almacenes' => $this->lsAlmacenes(),
       'meses' => $this->lsMeses(),
       'anios' => $this->lsAnios()
   ];
   ```

2. **`lsMovimientos()`**
   - Recibe: `$_POST['mes']`, `$_POST['anio']`, `$_POST['almacen']`
   - Llama: `$this->listMovimientos([$mes, $anio, $almacen])`
   - Retorna: Array con `row` (filas formateadas) y `resumen` (totales)

3. **`getResumen()`**
   - Calcula totales de entradas, salidas y balance
   - Retorna: `{ total, entradas, salidas, balance }`

#### Modelo (mdl-movimientos.php)

**Clase:** `mdl extends CRUD`

**Métodos:**

1. **`listMovimientos($array)`**
   - Consulta SQL con JOINs a `mtto_almacen`, `mtto_almacen_area`, `usuarios`
   - Filtros: mes, año, almacén
   - Orden: fecha DESC
   - Retorna: Array de movimientos

2. **`lsAlmacenes()`**
   - Consulta: Almacenes activos
   - Formato: `{ id, valor }`

3. **`getResumenMovimientos($array)`**
   - Consulta agregada: SUM, COUNT por tipo_movimiento
   - Retorna: Totales de entradas y salidas

## Data Models

### Tabla: `mtto_inventario_movimientos`

```sql
CREATE TABLE `mtto_inventario_movimientos` (
  `id_movimiento` INT(11) PRIMARY KEY AUTO_INCREMENT,
  `folio` VARCHAR(20) UNIQUE NOT NULL,
  `fecha` DATE NOT NULL,
  `tipo_movimiento` ENUM('Entrada', 'Salida') NOT NULL,
  `total_productos` INT(11) DEFAULT 0,
  `total_unidades` INT(11) DEFAULT 0,
  `estado` ENUM('Activa', 'Cancelada') DEFAULT 'Activa',
  `fecha_creacion` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_fecha` (`fecha`),
  INDEX `idx_tipo_movimiento` (`tipo_movimiento`),
  INDEX `idx_fecha_tipo` (`fecha`, `tipo_movimiento`)
);
```

### Tabla: `mtto_inventario_detalle`

```sql
CREATE TABLE `mtto_inventario_detalle` (
  `id_detalle` INT(11) PRIMARY KEY AUTO_INCREMENT,
  `id_movimiento` INT(11) NOT NULL,
  `id_producto` INT(11) NOT NULL,
  `cantidad` INT(11) NOT NULL CHECK (`cantidad` > 0),
  `stock_anterior` INT(11) NOT NULL,
  `stock_resultante` INT(11) NOT NULL,
  FOREIGN KEY (`id_movimiento`) REFERENCES `mtto_inventario_movimientos`(`id_movimiento`) ON DELETE CASCADE,
  FOREIGN KEY (`id_producto`) REFERENCES `mtto_almacen`(`idAlmacen`) ON DELETE RESTRICT,
  INDEX `idx_movimiento` (`id_movimiento`),
  INDEX `idx_producto` (`id_producto`)
);
```

### Relaciones

```
mtto_inventario_movimientos (1) ←→ (N) mtto_inventario_detalle
mtto_inventario_detalle (N) ←→ (1) mtto_almacen (productos)
mtto_inventario_movimientos (N) ←→ (1) mtto_almacen_area (almacenes)
mtto_inventario_movimientos (N) ←→ (1) usuarios (responsables)
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Filter consistency
*For any* combination of month, year, and warehouse filters, the displayed movements should only include records matching ALL selected criteria simultaneously.
**Validates: Requirements 2.1, 2.2, 2.3**

### Property 2: Balance calculation accuracy
*For any* filtered set of movements, the balance displayed should always equal the sum of entries minus the sum of exits.
**Validates: Requirements 3.4**

### Property 3: Movement type color coding
*For any* movement displayed in the history table, entries should be colored green and exits should be colored red consistently.
**Validates: Requirements 4.2**

### Property 4: Quantity sign consistency
*For any* movement displayed, entry quantities should be positive and exit quantities should be negative with their respective signs.
**Validates: Requirements 4.3**

### Property 5: Chronological ordering
*For any* set of movements displayed, they should be ordered in descending order by date (most recent first).
**Validates: Requirements 4.4**

### Property 6: Responsible user association
*For any* movement record, there should always be an associated responsible user, and if the user is inactive, the system should display an "inactive responsible" label.
**Validates: Requirements 5.1, 5.2, 5.3**

### Property 7: Dynamic update without reload
*For any* filter change, the summary cards and movement table should update dynamically without requiring a full page reload.
**Validates: Requirements 2.4**

### Property 8: Empty result message
*For any* filter combination that returns zero movements, the system should display a message indicating no results were found.
**Validates: Requirements 1.5, 2.5**

### Property 9: Initial load limit
*For any* initial page load, the system should display a maximum of 5 movements in the history table.
**Validates: Requirements 1.4**

### Property 10: Summary card update consistency
*For any* filter change, all four summary cards (Total Movements, Entries, Exits, Balance) should update simultaneously and reflect the same filtered dataset.
**Validates: Requirements 3.5**

## Error Handling

### Frontend Error Handling

1. **AJAX Request Failures**
   ```javascript
   useFetch({
       url: api,
       data: { opc: 'lsMovimientos' },
       success: (data) => { /* render */ },
       error: (error) => {
           alert({
               icon: 'error',
               title: 'Error de conexión',
               text: 'No se pudo cargar los movimientos'
           });
       }
   });
   ```

2. **Empty Results**
   - Mostrar mensaje: "No se encontraron movimientos para los filtros seleccionados"
   - Mantener filtros visibles para ajustar búsqueda

3. **Invalid Filter Combinations**
   - Validar que al menos un filtro esté seleccionado
   - Deshabilitar botón de búsqueda si no hay filtros válidos

### Backend Error Handling

1. **Database Connection Errors**
   ```php
   try {
       $movimientos = $this->listMovimientos($params);
   } catch (Exception $e) {
       return [
           'status' => 500,
           'message' => 'Error al consultar movimientos',
           'error' => $e->getMessage()
       ];
   }
   ```

2. **Invalid Parameters**
   ```php
   if (empty($_POST['mes']) || empty($_POST['anio'])) {
       return [
           'status' => 400,
           'message' => 'Parámetros de filtro inválidos'
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
- Test `filterBar()` genera los filtros correctos
- Test `summaryCards()` calcula balance correctamente
- Test `lsMovimientos()` formatea datos para tabla

**Backend (PHP):**
- Test `init()` retorna listas de filtros válidas
- Test `lsMovimientos()` con diferentes combinaciones de filtros
- Test `getResumen()` calcula totales correctamente

### Property-Based Testing

**Framework:** PHPUnit con generadores de datos aleatorios

**Configuración:** Mínimo 100 iteraciones por propiedad

**Propiedades a testear:**

1. **Property 1: Filter consistency**
   ```php
   /**
    * Feature: movimientos, Property 1: Filter consistency
    * Validates: Requirements 2.1, 2.2, 2.3
    */
   public function testFilterConsistency() {
       // Generate random month, year, warehouse
       // Query movements with filters
       // Assert all results match ALL filter criteria
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
       // Assert balance = sum(entries) - sum(exits)
   }
   ```

3. **Property 5: Chronological ordering**
   ```php
   /**
    * Feature: movimientos, Property 5: Chronological ordering
    * Validates: Requirements 4.4
    */
   public function testChronologicalOrdering() {
       // Generate random movements with different dates
       // Query movements
       // Assert dates are in descending order
   }
   ```

### Integration Testing

1. **Test filtros → backend → respuesta**
   - Seleccionar filtros en UI
   - Verificar petición AJAX correcta
   - Verificar respuesta JSON válida
   - Verificar actualización de tabla

2. **Test tarjetas resumen**
   - Cargar movimientos
   - Verificar cálculo de totales
   - Verificar colores de tarjetas
   - Verificar formato de números

3. **Test paginación**
   - Cargar más de 5 movimientos
   - Verificar límite inicial
   - Verificar carga de más registros

## Performance Considerations

### Database Optimization

1. **Índices estratégicos:**
   - `idx_fecha_tipo` para filtros combinados
   - `idx_movimiento` en detalle para JOINs rápidos

2. **Consultas optimizadas:**
   - Usar `LIMIT` para paginación
   - Evitar `SELECT *`, especificar columnas necesarias
   - Usar `LEFT JOIN` solo cuando sea necesario

3. **Caché de filtros:**
   - Almacenar listas de almacenes en sesión
   - Actualizar solo cuando cambien datos maestros

### Frontend Optimization

1. **Lazy Loading:**
   - Cargar solo 5 movimientos inicialmente
   - Implementar scroll infinito o paginación

2. **Debouncing:**
   - Aplicar debounce a filtros para evitar múltiples peticiones

3. **Caché de respuestas:**
   - Guardar últimas consultas en memoria
   - Evitar peticiones duplicadas

## Security Considerations

1. **Validación de entrada:**
   - Sanitizar todos los parámetros `$_POST`
   - Usar `$this->util->sql()` para prevenir SQL injection

2. **Autenticación:**
   - Verificar sesión activa en `index.php`
   - Validar permisos de usuario en controlador

3. **Autorización:**
   - Verificar que usuario tenga acceso al módulo
   - Registrar auditoría de consultas

## Deployment Notes

1. **Requisitos previos:**
   - Tabla `mtto_almacen` debe existir
   - Tabla `usuarios` debe existir
   - Tabla `mtto_almacen_area` debe existir

2. **Orden de instalación:**
   - Ejecutar script SQL de creación de tablas
   - Copiar archivos PHP y JS a directorios correspondientes
   - Configurar permisos de acceso en sistema

3. **Configuración:**
   - Ajustar `$this->bd` en modelo según nombre de base de datos
   - Configurar rutas en `index.php`

## Future Enhancements

1. **Exportación de datos:**
   - Exportar movimientos a Excel/PDF
   - Incluir gráficos de tendencias

2. **Filtros avanzados:**
   - Filtro por producto
   - Filtro por responsable
   - Filtro por rango de cantidades

3. **Notificaciones:**
   - Alertas de movimientos críticos
   - Notificaciones de stock bajo

4. **Dashboard:**
   - Gráficos de entradas vs salidas
   - Tendencias mensuales
   - Top productos con más movimientos
