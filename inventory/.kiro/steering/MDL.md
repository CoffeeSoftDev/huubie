**Objetivo General**
Crear un archivo modelo PHP que extienda la clase `CRUD`, conforme a los estándares de desarrollo de CoffeeSoft. Este modelo debe incluir configuración base, estructura ordenada por módulos y funciones orientadas a la consulta de datos (incluyendo filtros tipo `<select>`).

**Reglas y Requisitos Técnicos**

### 1.Estructura Base del Modelo
Debe respetarse el formato de CoffeeSoft
- Nombre del archivo bajo la convención:
  `mdl-[nombre].php`

- Todos los modelos deben extender la clase `CRUD` y el modelo debe llamarse mdl:
  ```php
  class mdl extends CRUD {}
  ```
- Carga obligatoria de archivos de configuración:

  ```php
    require_once '../conf/_CRUD.php';
    require_once '../conf/_Utileria.php';

  ```

  **Nota sobre rutas relativas:**
  - Los `../` indican que debes subir un nivel desde la ubicación actual del archivo
  - Si tu archivo modelo está en `proyecto/mdl/mdl-proyecto.php`, los `../` te llevan a la raíz del proyecto
  - La estructura típica es:
    ```
    ├── ERP
    ├── conf/
    │   ├── _CRUD.php
    │   └── _Utileria.php
    
   proyecto/
    ├── mdl/
    │   └── mdl-proyecto.php  ← Desde aquí, ../ sube a proyecto/
    ├── ctrl/
    │   └── ctrl-proyecto.php
    └── js/
        └── proyecto.js
    ```
  - Ajusta el número de `../` según la profundidad de tu archivo:
    - Archivo en `mdl/`: usa `../conf/`
    - Archivo en `modulo/mdl/`: usa `../../conf/`
    - Archivo en `modulo/submodulo/mdl/`: usa `../../../conf/`

- Propiedades comunes a declarar en la clase:
  ```php
  public $util;
  public $bd;
  ```

- **Configuración de Base de Datos**
  - Si el usuario especifica el nombre de la base de datos, usar:
    ```php
    $this->bd = "rfwsmqex_[nombre_bd_especificado].";
    ```
  - Si NO se especifica la base de datos, usar el nombre del proyecto:
    ```php
    $this->bd = "rfwsmqex_[nombre_proyecto].";
    ```
  - Ejemplos:
    - Proyecto "contabilidad" → `$this->bd = "rfwsmqex_contabilidad.";`
    - Proyecto "ventas" → `$this->bd = "rfwsmqex_ventas.";`
    - BD especificada "erp" → `$this->bd = "rfwsmqex_erp.";`

- **Nomenclatura de campos**
  - Todos los nombres de columna deben estar en inglés.
  - La clave primaria siempre se llamará `id`.
  - Las claves foráneas seguirán el patrón `{tabla}_id` (ej. `user_id`, `order_id`).
  - Usar snake_case para nombres compuestos (ej. `created_at`, `first_name`).

  ### 2.Organización de Métodos por Módulo
-  Separar lógicamente las funciones según el módulo al que pertenecen, con comentarios ( Solo aplica si es diferente modulo):

```php
  // Finanzas:
  public function getFinanzasList() { ... }

  // Eventos:
  public function getEventList() { ... }
  ```

- Los nombres de las funciones deben:
  - Estar en inglés.
  - Usar notación `camelCase`.
  - **CRÍTICO:** NO pueden ser iguales a las funciones del controlador (ctrl)

### Nomenclatura Permitida para Modelos (MDL)

**✅ Nombres PERMITIDOS para funciones del modelo:**
- `list[Entidad]()` - Para listar registros
- `create[Entidad]()` - Para crear registros  
- `update[Entidad]()` - Para actualizar registros
- `get[Entidad]ById()` - Para obtener un registro por ID
- `delete[Entidad]ById()` - Para eliminar registros
- `ls[Entidad]()` - Para consultas de filtros/selects
- `exists[Entidad]ByName()` - Para validar existencia
- `getMax[Entidad]Id()` - Para obtener último ID

**❌ Nombres PROHIBIDOS (reservados para controlador):**
- `ls()`, `add()`, `edit()`, `get()`, `init()`, `status[Entidad]()`


### 3. Uso de Métodos CRUD Heredados

- Utiliza los métodos de la clase base `CRUD` (CRUD.md) según el tipo de operación:
  _Select : Consultas estructuradas tipo array
  _Delete : Eliminar un registro
  _Update : Actualizaciones
  _Read   : SQL personalizados (raw queries)

**IMPORTANTE:** consulta siempre CRUD.md para entender el funcionamiento de los metodos de consulta.

  <_Insert>
  ```php
    function create($array){
      return $this->_Insert([
        'table' =>  "{$this->bd}table_name",
        'values' => $array['values'],
        'data' => $array['data']
      ]);
    }
  ```

  <_Update>

```php
  function update($array){
    return $this->_Update([
      'table'  => "{$this->bd}table_name",
      'values' => $array['values'],
      'where'  => $array['where'],
      'data'   => $array['data'],
    ]);
  }
```

<_Delete>

```php
  function delete[Entidad]($array) {
    return $this->_Delete([
      'table' => "{$this->bd}table_name",
      'where' => $array['where'],
      'data'  => $array['data']
    ]);
  }
```

**Notas sobre _Delete:**
- El parámetro de la función es `$array` (o el identificador necesario)
- Internamente usa `$array['where']` para la cláusula WHERE
- Internamente usa `$array['data']` para los valores del placeholder
- Esta estructura permite flexibilidad en las condiciones de eliminación
- Ejemplo: 

```php
 function deleteMaterialById($id) { 
  return $this->_Delete([
    'table' => "{$this->bd}mtto_almacen", 
    'where' => $array['where'], 
    'data' => $array['data']]);
 }
```

### 4. Estructura para Consultas tipo `<select>`

**CRÍTICO:** Todos los selects DEBEN usar el formato `_Read` con consultas SQL directas.

#### Formato Obligatorio para Selects (_Read)

Para todas las consultas de tipo select (filtros, dropdowns, listas), usar SIEMPRE `_Read`:

```php
public function lsCategory($array) {
    $query = "
        SELECT id, classification AS valor, description
        FROM {$this->bd}table_name
        WHERE active = ?
        ORDER BY id DESC
    ";
    return $this->_Read($query, $array);
}
```

#### Ejemplos de Consultas Select con _Read

**Select simple:**
```php
public function lsStatus() {
    $query = "
        SELECT id, name AS valor
        FROM {$this->bd}status
        WHERE active = 1
        ORDER BY name ASC
    ";
    return $this->_Read($query, []);
}
```

**Select con parámetros:**
```php
public function lsProductsByCategory($array) {
    $query = "
        SELECT id, name AS valor, price
        FROM {$this->bd}products
        WHERE category_id = ? AND active = 1
        ORDER BY name ASC
    ";
    return $this->_Read($query, $array);
}
```

**Select con JOIN:**
```php
public function lsOrdersWithClient($array) {
    $query = "
        SELECT 
            o.id,
            o.folio AS valor,
            c.name AS client_name,
            o.total
        FROM {$this->bd}orders o
        LEFT JOIN {$this->bd}clients c ON o.client_id = c.id
        WHERE o.status = ?
        ORDER BY o.created_at DESC
    ";
    return $this->_Read($query, $array);
}
```

#### Otras Consultas (_Read)

Para consultas complejas o personalizadas que no sean selects:

```php
public function getTableByID($array) {
    $query = "
        SELECT *
        FROM {$this->bd}table_name
        WHERE id = ?
    ";
    return $this->_Read($query, $array);
}
```

**IMPORTANTE:** 
- NO usar `_Select` para consultas de tipo select/filtros
- SIEMPRE usar `_Read` con SQL directo para mayor control y claridad
- Usar alias `AS valor` para campos que se mostrarán en selects del frontend

**Consideraciones Finales**
- Este prompt puede ser reutilizado para todos los módulos que requieran interacción con datos tipo filtro `<mdl>`.
- Se puede integrar fácilmente en controladores PHP que inicialicen datos para vistas en JS.
- Puedes usar de referencias los <pivotes>


