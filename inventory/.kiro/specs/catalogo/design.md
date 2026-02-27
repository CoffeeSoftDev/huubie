# Design Document - Módulo Catálogo

## Overview

El módulo de Catálogo es una aplicación web desarrollada con CoffeeSoft Framework que permite administrar la estructura organizacional del almacén mediante tres entidades principales: Categorías, Áreas y Zonas. El diseño sigue una arquitectura MVC con separación clara de responsabilidades entre frontend (JavaScript), controlador (PHP) y modelo (PHP).

La interfaz utiliza un sistema de pestañas navegables que permite gestionar cada entidad de forma independiente sin recargar la página completa. Cada pestaña incluye un formulario de captura y una tabla de listado con operaciones CRUD completas.

## Architecture

### Patrón Arquitectónico

El módulo implementa el patrón **MVC (Model-View-Controller)** siguiendo las convenciones de CoffeeSoft Framework:

- **Model (mdl-catalogo.php)**: Gestiona el acceso a datos mediante la clase CRUD, ejecuta consultas SQL y valida la integridad de datos
- **Controller (ctrl-catalogo.php)**: Procesa las peticiones del frontend, coordina las operaciones del modelo y retorna respuestas JSON
- **View (catalogo.js)**: Renderiza la interfaz usando componentes de CoffeeSoft, maneja eventos del usuario y realiza peticiones AJAX

### Flujo de Datos

```
Usuario → Interfaz (catalogo.js) → useFetch() → Controlador (ctrl-catalogo.php) → Modelo (mdl-catalogo.php) → Base de Datos
                                                                                                                    ↓
Usuario ← Actualización UI ← Respuesta JSON ← Procesamiento ← Resultado Query ← ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
```

### Tecnologías

- **Frontend**: JavaScript ES6+, jQuery 3.x, CoffeeSoft Framework, TailwindCSS
- **Backend**: PHP 7.4+, Clase CRUD personalizada
- **Base de Datos**: MySQL 5.7+
- **Comunicación**: AJAX con Fetch API (useFetch)

## Components and Interfaces

### Frontend Components (catalogo.js)

#### Clase Principal: App

```javascript
class App extends Templates {
    constructor(link, div_modulo)
    PROJECT_NAME: "catalogo"
    
    // Métodos principales
    render()           // Inicializa el módulo
    layout()           // Crea la estructura de pestañas
}
```

#### Clase: Category

```javascript
class Category extends Templates {
    constructor(link, div_modulo)
    PROJECT_NAME: "category"
    
    // Métodos CRUD
    lsCategory()       // Lista categorías en tabla
    addCategory()      // Muestra modal para agregar
    editCategory(id)   // Muestra modal para editar
    deleteCategory(id) // Elimina con confirmación
    
    // Métodos auxiliares
    filterBarCategory() // Renderiza barra de filtros
    jsonCategory()      // Define estructura del formulario
}
```

#### Clase: Area

```javascript
class Area extends Templates {
    constructor(link, div_modulo)
    PROJECT_NAME: "area"
    
    // Métodos CRUD
    lsArea()           // Lista áreas en tabla
    addArea()          // Muestra modal para agregar
    editArea(id)       // Muestra modal para editar
    deleteArea(id)     // Elimina con confirmación
    
    // Métodos auxiliares
    filterBarArea()    // Renderiza barra de filtros
    jsonArea()         // Define estructura del formulario
}
```

#### Clase: Zone

```javascript
class Zone extends Templates {
    constructor(link, div_modulo)
    PROJECT_NAME: "zone"
    
    // Métodos CRUD
    lsZone()           // Lista zonas en tabla
    addZone()          // Muestra modal para agregar
    editZone(id)       // Muestra modal para editar
    deleteZone(id)     // Elimina con confirmación
    
    // Métodos auxiliares
    filterBarZone()    // Renderiza barra de filtros
    jsonZone()         // Define estructura del formulario
}
```

### Backend Components

#### Controlador (ctrl-catalogo.php)

```php
class ctrl extends mdl {
    
    // Inicialización
    init()                    // Retorna datos para filtros
    
    // Categorías
    lsCategory()              // Lista categorías para tabla
    getCategory()             // Obtiene una categoría por ID
    addCategory()             // Crea nueva categoría
    editCategory()            // Actualiza categoría existente
    deleteCategory()          // Elimina categoría
    
    // Áreas
    lsArea()                  // Lista áreas para tabla
    getArea()                 // Obtiene un área por ID
    addArea()                 // Crea nueva área
    editArea()                // Actualiza área existente
    deleteArea()              // Elimina área
    
    // Zonas
    lsZone()                  // Lista zonas para tabla
    getZone()                 // Obtiene una zona por ID
    addZone()                 // Crea nueva zona
    editZone()                // Actualiza zona existente
    deleteZone()              // Elimina zona
}
```

#### Modelo (mdl-catalogo.php)

```php
class mdl extends CRUD {
    
    // Propiedades
    $bd: string               // Prefijo de base de datos
    $util: Utileria          // Utilidades para sanitización
    
    // Categorías
    listCategory($array)              // Consulta categorías
    getCategoryById($array)           // Obtiene categoría por ID
    createCategory($array)            // Inserta nueva categoría
    updateCategory($array)            // Actualiza categoría
    deleteCategoryById($array)        // Elimina categoría
    existsCategoryByName($array)      // Valida duplicados
    
    // Áreas
    listArea($array)                  // Consulta áreas
    getAreaById($array)               // Obtiene área por ID
    createArea($array)                // Inserta nueva área
    updateArea($array)                // Actualiza área
    deleteAreaById($array)            // Elimina área
    existsAreaByName($array)          // Valida duplicados
    
    // Zonas
    listZone($array)                  // Consulta zonas
    getZoneById($array)               // Obtiene zona por ID
    createZone($array)                // Inserta nueva zona
    updateZone($array)                // Actualiza zona
    deleteZoneById($array)            // Elimina zona
    existsZoneByName($array)          // Valida duplicados
}
```

### Interfaces de Comunicación

#### Peticiones Frontend → Backend

Todas las peticiones usan el método `useFetch()` con el siguiente formato:

```javascript
useFetch({
    url: 'ctrl/ctrl-catalogo.php',
    data: {
        opc: 'nombreOperacion',
        // parámetros adicionales
    },
    success: (response) => {
        // manejo de respuesta
    }
})
```

#### Respuestas Backend → Frontend

Formato estándar de respuesta JSON:

```json
{
    "status": 200,           // 200: éxito, 500: error, 409: conflicto
    "message": "Mensaje descriptivo",
    "data": {},              // Datos opcionales
    "row": []                // Filas para tablas
}
```

## Data Models

### Tabla: mtto_categoria

```sql
CREATE TABLE mtto_categoria (
    idcategoria INT PRIMARY KEY AUTO_INCREMENT,
    nombreCategoria VARCHAR(255) NOT NULL,
    active TINYINT(1) DEFAULT 1,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Campos:**
- `idcategoria`: Identificador único de la categoría
- `nombreCategoria`: Nombre descriptivo de la categoría
- `active`: Estado del registro (1: activo, 0: inactivo)
- `date_creation`: Fecha de creación del registro

**Índices:**
- PRIMARY KEY: `idcategoria`
- INDEX: `nombreCategoria` (para búsquedas)

### Tabla: mtto_almacen_area

```sql
CREATE TABLE mtto_almacen_area (
    idArea INT PRIMARY KEY AUTO_INCREMENT,
    Nombre_Area VARCHAR(255) NOT NULL,
    active TINYINT(1) DEFAULT 1,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Campos:**
- `idArea`: Identificador único del área
- `Nombre_Area`: Nombre descriptivo del área física
- `active`: Estado del registro (1: activo, 0: inactivo)
- `date_creation`: Fecha de creación del registro

**Índices:**
- PRIMARY KEY: `idArea`
- UNIQUE INDEX: `Nombre_Area` (prevenir duplicados)

### Tabla: mtto_almacen_zona

```sql
CREATE TABLE mtto_almacen_zona (
    id_zona INT PRIMARY KEY AUTO_INCREMENT,
    nombre_zona VARCHAR(255) NOT NULL,
    active TINYINT(1) DEFAULT 1,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Campos:**
- `id_zona`: Identificador único de la zona
- `nombre_zona`: Nombre descriptivo de la zona
- `active`: Estado del registro (1: activo, 0: inactivo)
- `date_creation`: Fecha de creación del registro

**Índices:**
- PRIMARY KEY: `id_zona`
- INDEX: `nombre_zona` (para búsquedas)

### Relaciones

Actualmente las tablas no tienen relaciones de clave foránea explícitas. En futuras versiones se podría implementar:

```sql
-- Relación Zona → Área (futuro)
ALTER TABLE mtto_almacen_zona 
ADD COLUMN area_id INT,
ADD FOREIGN KEY (area_id) REFERENCES mtto_almacen_area(idArea);
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Validación de campos vacíos

*For any* formulario de categoría, área o zona, cuando se intenta agregar un registro con el campo nombre vacío, el sistema debe rechazar la operación y mostrar un mensaje de error sin realizar cambios en la base de datos.

**Validates: Requirements 1.2, 2.2, 3.2**

### Property 2: Prevención de duplicados en áreas

*For any* nombre de área, si ya existe un registro activo con ese nombre en la tabla mtto_almacen_area, el sistema debe rechazar la creación de un nuevo registro y retornar status 409 con mensaje descriptivo.

**Validates: Requirements 2.4**

### Property 3: Asignación de ID único

*For any* operación de creación exitosa en categorías, áreas o zonas, el sistema debe asignar automáticamente un ID único incremental y retornar el registro completo con su ID asignado.

**Validates: Requirements 1.3, 2.3, 3.3**

### Property 4: Confirmación antes de eliminar

*For any* operación de eliminación en categorías, áreas o zonas, el sistema debe mostrar un diálogo de confirmación usando swalQuestion antes de ejecutar la eliminación en la base de datos.

**Validates: Requirements 1.4, 3.4, 6.3**

### Property 5: Actualización automática de listados

*For any* operación CRUD exitosa (agregar, editar, eliminar), el sistema debe actualizar automáticamente el listado correspondiente sin recargar la página completa, reflejando los cambios inmediatamente.

**Validates: Requirements 1.5, 3.5**

### Property 6: Navegación sin recarga

*For any* cambio de pestaña en el módulo, el sistema debe cambiar la vista activa sin recargar toda la página, manteniendo el estado de la aplicación y mostrando el contenido correspondiente.

**Validates: Requirements 4.2**

### Property 7: Respuestas estandarizadas

*For any* operación del controlador, el sistema debe retornar una respuesta JSON con estructura estandarizada que incluya status (200/500/409), message descriptivo y data opcional.

**Validates: Requirements 6.4, 6.5**

### Property 8: Validación en backend

*For any* petición de creación recibida en el controlador, el sistema debe validar la existencia de duplicados antes de ejecutar la inserción en la base de datos, independientemente de la validación del frontend.

**Validates: Requirements 6.2**

### Property 9: Sanitización de datos

*For any* dato recibido del frontend, el controlador debe sanitizar los valores usando $this->util->sql() antes de pasarlos al modelo para prevenir inyección SQL.

**Validates: Requirements 6.1, 6.2**

### Property 10: Consistencia visual

*For any* componente renderizado en el módulo, el sistema debe utilizar el theme 'light' de CoffeeSoft y mantener consistencia con los estilos corporativos definidos en los pivotes.

**Validates: Requirements 4.3**

## Error Handling

### Estrategia General

El módulo implementa un manejo de errores en tres capas:

1. **Validación Frontend**: Prevención de errores antes de enviar peticiones
2. **Validación Backend**: Verificación de datos y lógica de negocio
3. **Manejo de Excepciones**: Captura de errores de base de datos

### Códigos de Estado

| Código | Significado | Uso |
|--------|-------------|-----|
| 200 | Éxito | Operación completada correctamente |
| 409 | Conflicto | Registro duplicado o violación de regla de negocio |
| 500 | Error del servidor | Error en base de datos o lógica del servidor |

### Validaciones Frontend

```javascript
// Validación de campos vacíos
if (!nombre || nombre.trim() === '') {
    alert({ 
        icon: "warning", 
        text: "El nombre no puede estar vacío" 
    });
    return;
}

// Validación de longitud
if (nombre.length > 255) {
    alert({ 
        icon: "warning", 
        text: "El nombre no puede exceder 255 caracteres" 
    });
    return;
}
```

### Validaciones Backend

```php
// Validación de duplicados
$exists = $this->existsCategoryByName([$_POST['nombreCategoria']]);
if ($exists > 0) {
    return [
        'status' => 409,
        'message' => 'Ya existe una categoría con ese nombre'
    ];
}

// Validación de campos requeridos
if (empty($_POST['nombreCategoria'])) {
    return [
        'status' => 500,
        'message' => 'El nombre de la categoría es requerido'
    ];
}
```

### Manejo de Errores de Base de Datos

```php
try {
    $result = $this->createCategory($data);
    if ($result) {
        return [
            'status' => 200,
            'message' => 'Categoría creada exitosamente'
        ];
    }
} catch (Exception $e) {
    return [
        'status' => 500,
        'message' => 'Error al crear la categoría: ' . $e->getMessage()
    ];
}
```

### Mensajes de Usuario

Todos los mensajes deben ser descriptivos y en español:

- ✅ "Categoría creada exitosamente"
- ✅ "Ya existe una categoría con ese nombre"
- ✅ "Error al eliminar el área"
- ❌ "Error 500"
- ❌ "Database error"

## Testing Strategy

### Enfoque de Pruebas

El módulo implementa una estrategia de pruebas dual que combina:

1. **Unit Tests**: Verifican funcionalidad específica de métodos individuales
2. **Property-Based Tests**: Validan propiedades universales del sistema

### Framework de Property-Based Testing

**Librería seleccionada**: No se implementará property-based testing en esta versión inicial debido a la simplicidad del módulo. Se priorizarán unit tests y pruebas manuales.

### Unit Tests

#### Frontend Tests (catalogo.test.js)

```javascript
describe('Category Module', () => {
    
    test('should validate empty category name', () => {
        const result = validateCategoryName('');
        expect(result).toBe(false);
    });
    
    test('should validate category name length', () => {
        const longName = 'a'.repeat(256);
        const result = validateCategoryName(longName);
        expect(result).toBe(false);
    });
    
    test('should accept valid category name', () => {
        const result = validateCategoryName('Herramientas');
        expect(result).toBe(true);
    });
});
```

#### Backend Tests (CtrlCatalogoTest.php)

```php
class CtrlCatalogoTest extends PHPUnit\Framework\TestCase {
    
    public function testAddCategoryWithValidData() {
        $_POST = [
            'opc' => 'addCategory',
            'nombreCategoria' => 'Test Category'
        ];
        
        $ctrl = new ctrl();
        $result = $ctrl->addCategory();
        
        $this->assertEquals(200, $result['status']);
    }
    
    public function testAddCategoryWithDuplicateName() {
        // Crear categoría inicial
        $this->createTestCategory('Duplicate');
        
        // Intentar crear duplicado
        $_POST = [
            'opc' => 'addCategory',
            'nombreCategoria' => 'Duplicate'
        ];
        
        $ctrl = new ctrl();
        $result = $ctrl->addCategory();
        
        $this->assertEquals(409, $result['status']);
    }
}
```

#### Model Tests (MdlCatalogoTest.php)

```php
class MdlCatalogoTest extends PHPUnit\Framework\TestCase {
    
    public function testListCategoryReturnsArray() {
        $mdl = new mdl();
        $result = $mdl->listCategory([1]);
        
        $this->assertIsArray($result);
    }
    
    public function testCreateCategoryReturnsTrue() {
        $mdl = new mdl();
        $data = [
            'values' => 'nombreCategoria, active, date_creation',
            'data' => ['Test', 1, date('Y-m-d H:i:s')]
        ];
        
        $result = $mdl->createCategory($data);
        $this->assertTrue($result);
    }
}
```

### Integration Tests

```javascript
describe('Category CRUD Integration', () => {
    
    test('should create, read, update and delete category', async () => {
        // Create
        const createResponse = await useFetch({
            url: api,
            data: { opc: 'addCategory', nombreCategoria: 'Integration Test' }
        });
        expect(createResponse.status).toBe(200);
        
        // Read
        const listResponse = await useFetch({
            url: api,
            data: { opc: 'lsCategory', active: 1 }
        });
        expect(listResponse.row.length).toBeGreaterThan(0);
        
        // Update
        const updateResponse = await useFetch({
            url: api,
            data: { 
                opc: 'editCategory', 
                id: createResponse.data.id,
                nombreCategoria: 'Updated Test'
            }
        });
        expect(updateResponse.status).toBe(200);
        
        // Delete
        const deleteResponse = await useFetch({
            url: api,
            data: { opc: 'deleteCategory', id: createResponse.data.id }
        });
        expect(deleteResponse.status).toBe(200);
    });
});
```

### Manual Testing Checklist

- [ ] Crear categoría con nombre válido
- [ ] Intentar crear categoría con nombre vacío
- [ ] Intentar crear categoría duplicada
- [ ] Editar categoría existente
- [ ] Eliminar categoría sin confirmación (debe mostrar diálogo)
- [ ] Eliminar categoría con confirmación
- [ ] Navegar entre pestañas sin perder datos
- [ ] Verificar actualización automática de listados
- [ ] Probar con nombres de 255 caracteres
- [ ] Probar con caracteres especiales
- [ ] Verificar responsividad en móvil
- [ ] Verificar consistencia visual con template

### Test Coverage Goals

- **Frontend**: 80% de cobertura en métodos CRUD
- **Backend Controller**: 90% de cobertura en métodos públicos
- **Backend Model**: 95% de cobertura en métodos de base de datos

### Continuous Testing

- Ejecutar unit tests antes de cada commit
- Ejecutar integration tests antes de cada merge a main
- Realizar pruebas manuales antes de cada release
