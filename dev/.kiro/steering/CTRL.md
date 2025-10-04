# Objetivo

Quiero que generes un **Controlador PHP** siguiendo esta estructura:

### Instrucciones Generales:

1. **SIEMPRE** Respeta la estructura de los metodos para crear el ctrl.
2. **SIEMPRE** Usa los ejemplos para crear los metodos.

### Workflow:

- El archivo debe iniciar la sesión PHP (`session_start();`).
- Validar que `$_POST['opc']` esté definido o salir (`if (empty($_POST['opc'])) exit(0);`).
- Requerir el modelo correcto (`require_once '../mdl/mdl-[name-project].php';`).
- Crear una clase `ctrl` que extienda la clase del modelo.
- No agreges comentarios si no son necesarios.
- extiende de `mdl` (nombre base de la clase modelo).
- Respeta las reglas establecidas

```PHP
 class ctrl extends mdl {}
```

Implementar los métodos siguientes dentro de la clase `ctrl`:

## 1. **init()**

- Este método solo se crea si el frontend[JS] utiliza filtros dinámicos (como `select`, `radio`, etc.).

```PHP
function init() {
        return [
            'udn' => $this->lsUDN(),
            'status'  => $this->lsStatus()
        ];
    }
```

- Cada lista se debe obtener mediante métodos del modelo, como `lsUDN()`, `lsStatus()`, `lsTipos()`, etc.

- El resultado debe retornarse como un arreglo asociativo, listo para ser consumido por JavaScript.

```PHP
    public function init() {
        $lsUDN    = $this->lsUDN();
        $lsStatus = $this->lsStatus();

        return [
            'udn'    => $lsUDN,
            'status' => $lsStatus
        ];
    }
```

## 2. **ls[Entidad]()**

Este método debe implementarse siempre que el frontend tenga una tabla con barra de filtros (`filterBar`) y posiblemente un calendario.

- Usa ls() como nombre del método del controlador.

- **Entrada esperada:**

  - Si la barra de filtros incluye un calendario, el método debe recibir las fechas `fi` (fecha inicial) y `ff` (fecha final) desde `$_POST`.

- **Flujo del método:**

  1. Llama al método del modelo `list['Entidad']()`, pasando como parámetros las fechas `fi` y `ff`.
  2. Itera sobre los resultados obtenidos.
  3. Para cada elemento, construye una fila (`$__row[]`) como arreglo asociativo:
     - Incluir campos relevantes como: `id`, fechas, totales, estado, etc.
     - Usar funciones auxiliares como `formatSpanishDate()` para fechas y `evaluar()` para montos si es necesario.
  4. Agrega un campo `dropdown` en cada fila con las opciones de acción disponibles, como `editar`, `eliminar`, etc.
  5. Si las únicas acciones disponibles son `editar` y `eliminar`, no uses dropdown y añade una columna adicional (`a`) en la última celda con botones para estas acciones.
     6.- Si no se especifica acciones usa `'opc' => 0`

- **Salida esperada:**

  - El método debe retornar un arreglo con al menos la clave `row`, que contenga el arreglo de filas (`$__row[]`).

  - Ejemplos:

```php
    function ls[Entidad](){

            $__row = [];

            $ls = $this->list['Entidad']([$_POST['id']]);

            foreach ($ls as $key) {
                $__row[] = [

                    'id'    => $key['id'],
                    'valor' => $key['valor'],
                    'price' => evaluar($key['price']) ,
                    'cant ' => $key['cant'] ,
                    'date'  => formatSpanishDate($key['date']),
                    'opc'   => 0
                ];
            }

            return ['row'=> $__row ,'thead' => ''];
    }


  function ls[Entidad]() {
            $__row = [];

            $fi = $_POST['fi'];
            $ff = $_POST['ff'];

            $ls = $this->list['Entidad']([
                'fi' => $fi,
                'ff' => $ff,

            ]);

            foreach ($ls as $key) {
                $__row[] = [
                    'id'              => $key['id'],
                    'Creación'        => $key['date'],
                    'Fecha de evento' => formatSpanishDate($key['date_start'], 'normal'),
                    'Horario'         => $key['hours_start'],
                    'Total'           => [
                        "html"  => evaluar($key['total']),
                        "class" => "text-end bg-[#283341]"
                    ],
                    'Estado'   => status($key['estado']),
                    'dropdown' => dropdown($key['id'], $key['estado'])
                ];
            }

            return [
                "row" => $__row,
                'ls'  => $ls,
            ];
        }


```

## 3. **get['Entidad']()**

    Este método recupera los datos de un solo registro de la entidad correspondiente, a partir de un `id` recibido vía POST.

    1. Recibe el `id`.
    2. Llama al método `get[Entidad]ById()` del modelo.
    3. Si los datos son encontrados, retorna `status: 200` y un mensaje de éxito.
    4. Si ocurre un error o no se encuentran datos, retorna `status: 500`.

Ejemplo de uso:

```php
      function getEvent(){
         $status = 500;
         $message = 'Error al obtener los datos';
         $getEvent = $this->getEventById([$_POST['id']]);


         if ($getEvent) {
             $status = 200;
             $message = 'Datos obtenidos correctamente.';
         }

         return [
             'status'  => $status,
             'message' => $message,
             'data'    => $getEvent,
         ];
     }
```

## 4. **add['Entidad']()**

Crea un nuevo registro en la base de datos. Si el campo tiene unicidad lógica, se debe validar previamente.

- Recibe datos por POST.
- Ejecuta `create[Entidad]()`.
- Retorna `status` y `message` de inserción.
- Puede existir el caso en que debas validar si un registro ya existe en la base de datos antes de crearlo. Esta validación es obligatoria cuando el campo tiene unicidad lógica
  1. Obtener los datos del `$_POST` usando `$this->util->sql($_POST)` o forma estructurada.
  2. Si existe, retornar `status: 400` con mensaje explicativo.
  3. Si no existe, proceder con `_Insert`.
  4. Devolver respuesta estandarizada `status: 200` o `500`.

Ejemplos:

```php

   function addProducto() {
           $status = 500;
           $message = 'No se pudo agregar el producto';
           $_POST['date_creation'] = date('Y-m-d H:i:s');
           $_POST['subsidiaries_id'] = $_SESSION['SUB'];

           $exists = $this->exists['Entidad']ByName([$_POST['name']]);

           if ($exists === 0) {
               $create = $this->createProducto($this->util->sql($_POST));
               if ($create) {
                   $status = 200;
                   $message = 'Producto agregado correctamente';
               }
           } else {
               $status = 409;
               $message = 'Ya existe un producto con ese nombre.';
           }

           return [
               'status' => $status,
               'message' => $message,
           ];
       }

```

5.  **edit[Entidad]()**

- Recibe datos por POST.
- Ejecuta `update[Entidad]()`.
- Retorna `status` y `message` de actualización.


    Ejemplo:

```php

     function editProducto() {
         $id      = $_POST['id'];
         $status  = 500;
         $message = 'Error al editar producto';
         $edit    = $this->updateProducto($this->util->sql($_POST, 1));

         if ($edit) {
             $status  = 200;
             $message = 'Producto editado correctamente';
         }

         return [
             'status'  => $status,
             'message' => $message
         ];
     }

```

6. **cancel() / status['entidad']()**

   - Cambia estatus de registros con `update()`.

   ```php
   function statusProducto() {
            $status = 500;
            $message = 'No se pudo actualizar el estado del producto';

            $update = $this->updateProducto($this->util->sql($_POST, 1));

            if ($update) {
                $status = 200;
                $message = 'El estado del producto se actualizó correctamente';
            }

            return [
                'status' => $status,
                'message' => $message,
                'update' => $update

            ];
        }
   ```

   Funciones extra:

   - **dropdown($id)**: Construye opciones de acciones disponibles según el estado del registro.
   - **getEstatus($idStatus)**: Devuelve el texto correspondiente al estado (opcional).
   - **a**: arreglo dentro de row para crear botones

## 7. **Funciones Auxiliares**

Si necesitas funciones auxiliares (como `dropdown()`, `status()`, `formatSpanishDate()`, etc.), créalas después de la clase principal con el comentario `// Complements`:

```php
class ctrl extends mdl {
    // Métodos del controlador aquí
}

// Complements
function dropdown($id, $status = null) {
    $options = [
        ['icon' => 'icon-edit', 'text' => 'Editar', 'onclick' => "app.editProducto($id)"],
        ['icon' => 'icon-trash', 'text' => 'Eliminar', 'onclick' => "app.deleteProducto($id)"]
    ];

    return $options;
}

function status($statusId) {
    $statuses = [
        1 => '<span class="badge bg-success">Activo</span>',
        2 => '<span class="badge bg-danger">Inactivo</span>',
        3 => '<span class="badge bg-warning">Pendiente</span>'
    ];

    return $statuses[$statusId] ?? '<span class="badge bg-secondary">Desconocido</span>';
}
```

**Reglas para funciones auxiliares:**

- Crear solo las funciones que realmente necesites
- Usar nombres descriptivos en inglés con `camelCase`
- Colocar siempre después de la clase principal
- Iniciar la sección con el comentario `// Complements`

## Formato de salida:

    - Al final instanciar `$obj = new ctrl();`
    - Llamar a la función dinámica:

```php
  $fn = $_POST['opc'];
  $encode = $obj->$fn();
  echo json_encode($encode);
```
