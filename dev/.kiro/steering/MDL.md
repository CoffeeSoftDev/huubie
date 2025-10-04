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

- Propiedades comunes a declarar en la clase:
  ```php
  public $util;
  public $bd;
  ```

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
  function update($array){

    return $this->_Delete([
      'table' => "{$this->bd}table_name",
      'where' => $array['where'],
      'data'  => $array['data'],
    ]);
  }
```

### 4. Estructura para Consultas tipo `<select>`

  ####  Nivel 1: Consulta directa (_Read)

  Para consultas SQL manuales sin estructura:

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
  #### Nivel 2: Consulta estructurada (_Select)

  Para obtener valores usando estructura predefinida:

  ```php
    public function getMaxSeasonId() {
      return $this->_Select([
      'table'     => "{$this->bd}table_name",
      'values'    => 'id,name',
      'where'     => 'id',
      'order'     => ['ASC'=>'Nombres'],
      'data'      => $array
      ]);

    }
  ```

**Consideraciones Finales**
- Este prompt puede ser reutilizado para todos los módulos que requieran interacción con datos tipo filtro `<mdl>`.
- Se puede integrar fácilmente en controladores PHP que inicialicen datos para vistas en JS.
- Puedes usar de referencias los <pivotes>


