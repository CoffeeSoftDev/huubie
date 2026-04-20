# Objetivo

Quiero que generes un **Controlador PHP** siguiendo esta estructura:

### Instrucciones Generales:

1. **SIEMPRE** Respeta la estructura de los metodos para crear el ctrl.
2. **SIEMPRE** Usa los ejemplos para crear los metodos.
3. **CRÍTICO - Variables POST:** NO usar operador de fusión de null (`??`) ni `isset()` para variables de `$_POST`. Usar directamente: `$variable = $_POST['variable'];`
4. **CRÍTICO - Funciones de coffeSoft.php:** Las funciones `formatSpanishDate()`, `formatSpanishDay()` y `evaluar()` ya están incluidas en `coffeSoft.php`. **NO** deben crearse ni redefinirse en el controlador.
5. **CRÍTICO - NO usar `htmlspecialchars()`:** Esta función **NO** debe usarse en controladores. Los datos se envían como JSON y el frontend se encarga del escape/sanitización al renderizar.

### Workflow:

- El archivo debe iniciar la sesión PHP (`session_start();`). Solo el controlador lleva `session_start()`.
- Validar que `$_POST['opc']` esté definido o salir (`if (empty($_POST['opc'])) exit(0);`).
- Requerir el modelo correcto (`require_once '../mdl/mdl-[name-project].php';`).
- Requerir coffeSoft (`require_once '../../conf/coffeSoft.php';`). Ver tabla de rutas al final.
- Crear una clase `ctrl` que extienda la clase del modelo.
- No agreges comentarios si no son necesarios.
- extiende de `mdl` (nombre base de la clase modelo).
- Respeta las reglas establecidas

**IMPORTANTE - Variables de Sesión:**
- Usar `$_POST['udn']` para identificar la unidad de negocio en lugar de variables de sesión
- Solo usar variables de sesión cuando el contexto del proyecto lo requiera explícitamente
- En pivotes específicos, seguir el patrón establecido con `$_POST['udn']`

### Template Base Completo

```php
<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-[nombre].php';
require_once '../../conf/coffeSoft.php';

class ctrl extends mdl {

    function init() {
        $lsUDN    = $this->lsUDN();
        $lsStatus = $this->lsStatus();

        return [
            'udn'    => $lsUDN,
            'status' => $lsStatus
        ];
    }

    function lsEntidad() {
        $__row = [];
        $ls = $this->listEntidad([$_POST['udn']]);

        foreach ($ls as $item) {
            $__row[] = [
                'id'     => $item['id'],
                'nombre' => $item['nombre'],
                'total'  => evaluar($item['total']),
                'status' => status($item['status']),
                'fecha'  => formatSpanishDate($item['fecha']),
                'a'      => actionButtons($item['id'])
            ];
        }

        return ['row' => $__row, 'thead' => ''];
    }

    function showEntidad() {
        $fi  = $_POST['fi'];
        $ff  = $_POST['ff'];
        $udn = $_POST['udn'];

        $counts = $this->getEntidadCounts([
            'fi'  => $fi,
            'ff'  => $ff,
            'udn' => $udn
        ]);

        return [
            'status' => 200,
            'counts' => $counts
        ];
    }

    function getEntidad() {
        $status = 500;
        $message = 'Error al obtener los datos';
        $getData = $this->getEntidadById([$_POST['id']]);

        if ($getData) {
            $status = 200;
            $message = 'Datos obtenidos correctamente.';
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $getData
        ];
    }

    function addEntidad() {
        $status = 500;
        $message = 'No se pudo agregar el registro';
        $_POST['date_creation'] = date('Y-m-d H:i:s');

        $create = $this->createEntidad($this->util->sql($_POST));

        if ($create) {
            $status = 200;
            $message = 'Registro agregado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function editEntidad() {
        $id      = $_POST['id'];
        $status  = 500;
        $message = 'Error al editar registro';
        $edit    = $this->updateEntidad($this->util->sql($_POST, 1));

        if ($edit) {
            $status  = 200;
            $message = 'Registro editado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function statusEntidad() {
        $status = 500;
        $message = 'No se pudo actualizar el estado';
        $update = $this->updateEntidad($this->util->sql($_POST, 1));

        if ($update) {
            $status = 200;
            $message = 'Estado actualizado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function deleteEntidad() {
        $status  = 500;
        $message = 'Error al eliminar registro';

        $values = $this->util->sql(['id' => $_POST['id']], 1);
        $delete = $this->deleteEntidadById($values);

        if ($delete) {
            $status  = 200;
            $message = 'Registro eliminado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }
}

// Complements (ver seccion 10 para detalle de actionButtons, status, dropdown)

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
```

### Nomenclatura y Mapeo CTRL → MDL

Los nombres de CTRL **NO** pueden coincidir con los del modelo. Nombres PROHIBIDOS en ctrl: `list[Entidad]()`, `create[Entidad]()`, `update[Entidad]()`, `get[Entidad]ById()`.

| CTRL (permitido) | MDL (llama a) | Proposito |
|---|---|---|
| `init()` | `ls[Filtro]()` | Inicializar filtros |
| `ls[Entidad]()` | `list[Entidad]()` | Listar registros |
| `show[Entidad]()` | `get[Entidad]Counts()` | Datos agregados/dashboard |
| `get[Entidad]()` | `get[Entidad]ById()` | Obtener un registro |
| `add[Entidad]()` | `create[Entidad]()` | Crear registro |
| `edit[Entidad]()` | `update[Entidad]()` | Editar registro |
| `status[Entidad]()` | `update[Entidad]()` | Cambiar estado |
| `cancel[Entidad]()` | `update[Entidad]()` | Cancelar registro |
| `delete[Entidad]()` | `delete[Entidad]ById()` | Eliminar registro |

## Notas Adicionales de Métodos

### init()
- Solo se crea si el frontend usa filtros dinamicos (`select`, `radio`, etc.)

### ls[Entidad]()
- Recibe filtros via `$_POST` (si hay calendario: `fi`, `ff`)
- Construye `$__row[]` con funciones auxiliares: `formatSpanishDate()`, `evaluar()`, `status()`
- Retorna: `['row' => $__row, 'thead' => '']`

### Acciones en filas: `'a'` vs `'opc'`

No se pueden mezclar en la misma tabla. Una tabla usa `'a'` O usa `'opc'`, nunca ambos.

**`'a'`** — Tabla con botones de accion:
- `'a' => actionButtons($id)` — fila con botones
- `'a' => []` — fila sin botones (arreglo vacio)

**`'opc'`** — Tabla sin botones (reportes, consolidados):
- `'opc' => 0` — fila normal
- `'opc' => 1` — fila grupo (con acciones de dropdown si aplica)
- `'opc' => 2` — fila de totales

### Tabla Consolidada con Columnas Dinámicas

Reporte con columnas dinámicas por fecha, grupos con subgrupos (subtotal/impuesto) y total general.
Usa operador `+` para mergear fechas y `$row['opc']` al final.

```php
function lsConsolidated() {
    $fi  = $_POST['fi'];
    $ff  = $_POST['ff'];
    $udn = $_POST['udn'];

    // Inicializar reporte
    $rows             = [];
    $dateColumns      = $this->getDateRange($fi, $ff);
    $dateColumnTotals = array_fill_keys($dateColumns, 0);
    $reportTotal      = 0;
    $groups           = $this->listEntidadConsolidated([$udn, $fi, $ff]);

    // -- Recorrer grupos (cuentas principales) --
    foreach ($groups as $group) {
        $groupTotal = 0;
        $groupDates = [];

        // Montos del grupo por fecha
        foreach ($dateColumns as $date) {
            $amount = floatval($this->getEntidadAmount([$group['id'], $date]));
            $groupTotal              += $amount;
            $dateColumnTotals[$date] += $amount;

            $groupDates[$this->formatDateColumn($date)] = [
                'html'  => evaluar($amount),
                'class' => 'text-end'
            ];
        }

        // Fila GRUPO
        $row = [
            'id'       => $group['id'],
            'Concepto' => ['html' => $group['name'],      'class' => 'font-bold'],
            'Total'    => ['html' => evaluar($groupTotal), 'class' => 'text-end font-bold'],
        ] + $groupDates;
        $row['opc'] = 1;
        $rows[]     = $row;

        $reportTotal += $groupTotal;
        $subgroups    = $this->listSubEntidadByGroup([$group['id'], $fi, $ff]);

        // -- Recorrer subgrupos --
        foreach ($subgroups as $sub) {
            $subTotal = $subtotalSum = $taxSum = 0;
            $subDates = $stDates = $txDates = [];

            // Montos del subgrupo por fecha
            foreach ($dateColumns as $date) {
                $amount   = floatval($this->getSubEntidadAmount([$sub['id'], $date]));
                $subtotal = floatval($this->getSubEntidadSubtotal([$sub['id'], $date]));
                $tax      = floatval($this->getSubEntidadTax([$sub['id'], $date]));

                $subTotal    += $amount;
                $subtotalSum += $subtotal;
                $taxSum      += $tax;

                $df = $this->formatDateColumn($date);

                $subDates[$df] = [
                    'html'  => evaluar($amount),
                    'class' => 'text-end bg-[#E8F5E9] font-semibold'
                ];
                $stDates[$df] = [
                    'html'  => evaluar($subtotal),
                    'class' => 'text-end'
                ];
                $txDates[$df] = [
                    'html'  => evaluar($tax),
                    'class' => 'text-end'
                ];
            }

            // Fila SUBGRUPO
            $row = [
                'id'       => $sub['id'],
                'Concepto' => ['html' => $sub['name'],      'class' => 'bg-[#E8F5E9] font-semibold'],
                'Total'    => ['html' => evaluar($subTotal), 'class' => 'text-end bg-[#E8F5E9] font-semibold'],
            ] + $subDates;
            $row['opc'] = 0;
            $rows[]     = $row;

            // Fila Subtotal
            $row = [
                'id'       => $sub['id'] . '_st',
                'Concepto' => ['html' => 'Subtotal',            'class' => 'pl-6'],
                'Total'    => ['html' => evaluar($subtotalSum), 'class' => 'text-end'],
            ] + $stDates;
            $row['opc'] = 0;
            $rows[]     = $row;

            // Fila Impuesto
            $row = [
                'id'       => $sub['id'] . '_tx',
                'Concepto' => ['html' => 'Impuesto',       'class' => 'pl-6'],
                'Total'    => ['html' => evaluar($taxSum), 'class' => 'text-end'],
            ] + $txDates;
            $row['opc'] = 0;
            $rows[]     = $row;
        }
    }

    // -- Total General --
    $totalDates = [];
    foreach ($dateColumns as $date) {
        $totalDates[$this->formatDateColumn($date)] = [
            'html'  => evaluar($dateColumnTotals[$date]),
            'class' => 'text-end bg-gray-200 font-bold'
        ];
    }

    $row = [
        'id'       => 'total',
        'Concepto' => ['html' => 'TOTAL GENERAL',      'class' => 'bg-gray-200 font-bold'],
        'Total'    => ['html' => evaluar($reportTotal), 'class' => 'text-end bg-gray-200 font-bold'],
    ] + $totalDates;
    $row['opc'] = 2;
    $rows[]     = $row;

    return ['thead' => '', 'row' => $rows];
}
```

**Reglas de consolidado:**

| | Grupo | Subgrupo | Subtotal/Impuesto | Total General |
|---|---|---|---|---|
| **id** | `$id` | `$sub['id']` | `$id . '_st'` / `$id . '_tx'` | `'total'` |
| **class** | `font-bold` | `bg-[#E8F5E9] font-semibold` | `pl-6` | `bg-gray-200 font-bold` |
| **opc** | `1` | `0` | `0` | `2` |

**Patrones clave:**
- Operador `+` para mergear columnas dinámicas: `$row = [...] + $dates;`
- `$row['opc']` siempre al final, después del merge
- `evaluar()` ya maneja valores en 0, no validar antes
- Arrays al modelo siempre indexados: `[$udn, $fi, $ff]`
- Celda con formato: `['html' => valor, 'class' => 'clases']`

### add[Entidad]()
- Si el campo tiene unicidad logica, validar con `exists[Entidad]()` antes de crear. Si existe: `status: 409`.

### util->sql()
- `$this->util->sql($_POST)` — prepara datos para INSERT
- `$this->util->sql($_POST, 1)` — prepara datos para UPDATE/WHERE (el `1` indica formato WHERE)
- En `delete[Entidad]()` se pasa un array manual `['id' => $_POST['id']]` en vez de `$_POST` directo, para enviar solo el id al WHERE

## 9. **uploadFile()**

Método para subir múltiples archivos al servidor con validación, registro en base de datos y manejo de errores.

**Características:**
- Soporta múltiples archivos en una sola petición
- Validación individual por archivo
- Creación automática de directorio si no existe
- Nombres únicos con `uniqid()` para evitar conflictos
- Registro en base de datos con metadata completa
- Rollback automático (elimina archivo físico si falla el registro)
- Respuesta detallada con contadores y errores

**Estructura del método:**

```php
function uploadFile() {
    $status   = 500;
    $message  = 'Error al subir archivos';
    $uploaded = 0;
    $errors   = [];

    $user_id   = $_COOKIE['IDU'];
    $uploadDir = $_SERVER['DOCUMENT_ROOT'] . '/DEV/uploads/[modulo]/';

    if (!file_exists($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }

    $files = $_FILES['files'];
    $total = count($files['name']);

    foreach ($files['name'] as $i => $fileName) {
        if ($files['error'][$i] !== UPLOAD_ERR_OK) {
            $errors[] = "Error al subir {$fileName}";
            continue;
        }

        $fileExtension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        $newFileName   = '[modulo]_' . uniqid() . '.' . $fileExtension;
        $destino       = $uploadDir . $newFileName;

        if (!move_uploaded_file($files['tmp_name'][$i], $destino)) {
            $errors[] = "Error al mover {$fileName}";
            continue;
        }

        $fileData = [
            'file_name'  => $fileName,
            'size_bytes' => $files['size'][$i],
            'path'       => 'uploads/[modulo]/' . $newFileName,
            'extension'  => $fileExtension,
            'created_at' => date('Y-m-d H:i:s'),
            'user_id'    => $user_id
        ];

        $create = $this->createFile($this->util->sql($fileData));

        if ($create) {
            $uploaded++;
        } else {
            $errors[] = "Error al registrar {$fileName}";
            unlink($destino);
        }
    }

    if ($uploaded > 0) {
        $status  = 200;
        $message = $uploaded === $total
            ? "Archivos subidos ({$uploaded}/{$total})"
            : "Subidos {$uploaded} de {$total}";
    }

    return [
        'status'   => $status,
        'message'  => $message,
        'uploaded' => $uploaded,
        'total'    => $total,
        'errors'   => $errors
    ];
}
```

## 9.1 **uploadSingleFile()** — Archivo único

Variante de `uploadFile()` para subir un unico archivo. Misma ruta y estructura pero sin foreach ni rollback.

```php
function uploadSingleFile() {
    $status = 500;
    $message = 'Error al subir el archivo';

    $uploadDir = $_SERVER['DOCUMENT_ROOT'] . '/DEV/uploads/[modulo]/';

    if (!file_exists($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }

    if ($_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        return [
            'status'  => 400,
            'message' => 'No se recibio ningun archivo valido'
        ];
    }

    $file = $_FILES['file'];
    $fileExtension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $newFileName = '[modulo]_' . uniqid() . '_' . time() . '.' . $fileExtension;
    $destino = $uploadDir . $newFileName;

    if (move_uploaded_file($file['tmp_name'], $destino)) {
        $status = 200;
        $message = 'Archivo subido correctamente';

        $this->createFile($this->util->sql([
            'file_name'  => $file['name'],
            'size_bytes' => $file['size'],
            'path'       => 'uploads/[modulo]/' . $newFileName,
            'extension'  => $fileExtension,
            'created_at' => date('Y-m-d H:i:s'),
            'user_id'    => $_COOKIE['IDU']
        ]));
    }

    return [
        'status'  => $status,
        'message' => $message,
        'path'    => 'uploads/[modulo]/' . $newFileName
    ];
}
```

| | `uploadFile()` (multi) | `uploadSingleFile()` (unico) |
|---|---|---|
| `$_FILES` | `$_FILES['files']` con foreach | `$_FILES['file']` directo |
| Nombre | `[modulo]_` + `uniqid()` | `[modulo]_` + `uniqid()` + `_` + `time()` |
| Rollback | Si (`unlink` si falla BD) | No |
| Retorna | `uploaded`, `total`, `errors` | `path` del archivo |

## 10. **Funciones Auxiliares (Complements)**

Si necesitas funciones auxiliares, créalas después de la clase principal con el comentario `// Complements`:

**Reglas para funciones auxiliares:**

- Crear solo las funciones que realmente necesites
- Usar nombres descriptivos en inglés con `camelCase`
- Colocar siempre después de la clase principal
- Iniciar la sección con el comentario `// Complements`
- **Nomenclatura según cantidad de entidades en el controlador:**
  - Si el controlador maneja **1 sola entidad**: usar nombre genérico → `status()`, `dropdown()`, `actionButtons()`
  - Si el controlador maneja **múltiples entidades**: usar prefijo de entidad → `statusCompra()`, `dropdownVenta()`, `actionButtonsDevolucion()`

### `actionButtons($id)` - Botones de acción directos

Cuando las acciones son pocas (editar, eliminar), se usa `'a'` en el row:

```php
function actionButtons($id) {
    return [
        [
            'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-blue-100 hover:bg-blue-200 text-blue-700 me-1',
            'html'    => '<i class="icon-pencil"></i>',
            'onclick' => "app.editEntidad($id)"
        ],
        [
            'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-red-100 hover:bg-red-200 text-red-700',
            'html'    => '<i class="icon-trash"></i>',
            'onclick' => "app.deleteEntidad($id)"
        ]
    ];
}
```

**Regla:** El framework renderiza `'a'` con `$("<a>", atributos)` de jQuery, soporta cualquier atributo HTML: `onclick`, `href`, `target`, `download`, etc.

### `actionButtons($ruta)` - Botones de enlace (ver/descargar archivos)

Cuando los botones son links para ver o descargar archivos, se usa `href` en lugar de `onclick`:

```php
function actionButtons($ruta) {
    $t = time();
    return [
        [
            'class'  => 'inline-flex items-center px-2 py-1 text-sm rounded bg-blue-100 hover:bg-blue-200 text-blue-700 me-1',
            'html'   => '<i class="icon-eye"></i>',
            'href'   => $ruta . '?t=' . $t,
            'target' => '_blank'
        ],
        [
            'class'    => 'inline-flex items-center px-2 py-1 text-sm rounded bg-green-100 hover:bg-green-200 text-green-700',
            'html'     => '<i class="icon-download"></i>',
            'href'     => $ruta . '?t=' . $t,
            'download' => true
        ]
    ];
}
```

**Colores del proyecto (Tailwind) - Dark theme:**
- Azul: `bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30`
- Verde: `bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/30`
- Rojo: `bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30`
- Amarillo: `bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-400 border border-yellow-500/30`
- Gris: `bg-gray-500/15 hover:bg-gray-500/25 text-gray-400 border border-gray-500/30`

### `status($statusId)` - Badge de estado

```php
function status($statusId) {
    $statuses = [
        1 => ['bg' => 'bg-green-100',  'text' => 'text-green-700',  'label' => 'Activo'],
        2 => ['bg' => 'bg-red-100',    'text' => 'text-red-700',    'label' => 'Inactivo'],
        3 => ['bg' => 'bg-yellow-100', 'text' => 'text-yellow-700', 'label' => 'Pendiente']
    ];

    $style = $statuses[$statusId] ?? ['bg' => 'bg-gray-100', 'text' => 'text-gray-700', 'label' => 'Desconocido'];

    return '<span class="px-2 py-1 rounded text-xs font-bold ' . $style['bg'] . ' ' . $style['text'] . '">' . $style['label'] . '</span>';
}
```

### `userBadge($fullname, $subtitle)` - Badge de usuario con avatar

Genera un badge visual con iniciales en círculo degradado, nombre y subtítulo. Ideal para columnas de usuario en tablas.

```php
function userBadge($fullname, $subtitle) {
    $colors = [
        'bg-gradient-to-br from-blue-400 to-blue-600',
        'bg-gradient-to-br from-emerald-400 to-emerald-600',
        'bg-gradient-to-br from-purple-400 to-purple-600',
        'bg-gradient-to-br from-rose-400 to-rose-600',
        'bg-gradient-to-br from-amber-400 to-amber-600',
        'bg-gradient-to-br from-cyan-400 to-cyan-600',
        'bg-gradient-to-br from-indigo-400 to-indigo-600',
        'bg-gradient-to-br from-teal-400 to-teal-600'
    ];

    $parts = explode(' ', trim($fullname));
    $initials = strtoupper(substr($parts[0], 0, 1));
    if (count($parts) > 1) {
        $initials .= strtoupper(substr(end($parts), 0, 1));
    }

    $colorIndex = crc32($fullname) % count($colors);
    $bgColor = $colors[abs($colorIndex)];

    return '<div class="flex items-center gap-3">'
         . '<div class="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold ' . $bgColor . '">'
         . $initials
         . '</div>'
         . '<div>'
         . '<div class="text-sm font-semibold text-white">' . $fullname . '</div>'
         . '<div class="text-xs text-gray-400">' . $subtitle . '</div>'
         . '</div>'
         . '</div>';
}
```

**Uso en row:**
```php
'Nombre' => [
    'html'  => userBadge($item['fullname'], $item['sucursal']),
    'class' => ''
],
```

### `rolBadge($rol)` - Badge de rol/categoría

Genera un badge pill con color semitransparente según un mapa de valores. Usar para roles, categorías o cualquier campo con valores finitos conocidos.

```php
function rolBadge($rol) {
    $map = [
        'Administrador' => 'bg-purple-500/15 text-purple-400',
        'Cajero'        => 'bg-blue-500/15 text-blue-400',
        'Operaciones'   => 'bg-orange-500/15 text-orange-400',
        'Vendedor'      => 'bg-yellow-500/15 text-yellow-500',
    ];

    $colors = $map[$rol] ?? 'bg-gray-500/15 text-gray-400';

    return '<span class="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ' . $colors . '">'
         . $rol
         . '</span>';
}
```

**Uso en row:**
```php
'Rol' => [
    'html'  => rolBadge($item['rols']),
    'class' => ''
],
```

**Paleta de colores disponible para badges (dark theme):**
- Morado: `bg-purple-500/15 text-purple-400`
- Azul: `bg-blue-500/15 text-blue-400`
- Naranja: `bg-orange-500/15 text-orange-400`
- Rosa: `bg-pink-500/15 text-pink-400`
- Amarillo: `bg-yellow-500/15 text-yellow-500`
- Verde: `bg-emerald-500/15 text-emerald-400`
- Gris (fallback): `bg-gray-500/15 text-gray-400`

### `dropdown($id)` - Menú de acciones

Cuando hay muchas acciones disponibles, usar dropdown en lugar de botones:

```php
function dropdown($id, $status = null) {
    $options = [
        ['icon' => 'icon-edit', 'text' => 'Editar', 'onclick' => "app.editEntidad($id)"],
        ['icon' => 'icon-trash', 'text' => 'Eliminar', 'onclick' => "app.deleteEntidad($id)"]
    ];
    return $options;
}
```

## Variables en foreach

**CRÍTICO:** En los bucles `foreach`, NUNCA usar variables abreviadas de una sola letra (`$c`, `$r`, `$k`, `$v`). Siempre usar nombres descriptivos completos que reflejen el contenido del array.

```php
// ❌ PROHIBIDO
foreach ($cuentas as $c) {
    $total = $c['total'];
}

// ✅ CORRECTO
foreach ($cuentas as $venta) {
    $total = $venta['total'];
}

foreach ($registros as $registro) {
    $nombre = $registro['nombre'];
}
```

**Excepción:** La variable `$key` en `foreach ($array as $key => $value)` es aceptable cuando se necesita el índice.

## Multiline Arrays

**CRÍTICO:** Los arreglos asociativos con celdas de formato rico (`['html' => ..., 'class' => ...]`) DEBEN escribirse en **multiline** (una propiedad por línea). NUNCA comprimir un arreglo rico en una sola línea.

```php
// ❌ PROHIBIDO - todo en una línea
$fila = [
    'Producto' => $nombre,
    $lblComp => ['html' => '<span class="text-blue-500">' . number_format($val, 2) . '</span>', 'class' => 'text-end font-semibold'],
];

// ✅ CORRECTO - multiline arrays
$fila = [
    'Producto' => $nombre,
    $lblComp   => [
        'html'  => '<span class="text-blue-500">' . number_format($val, 2) . '</span>',
        'class' => 'text-end font-semibold'
    ],
];
```

## Ruta de coffeSoft.php según profundidad

La ruta del `require_once` de `coffeSoft.php` se calcula automáticamente según la profundidad del controlador respecto a la carpeta `conf/`:

| Ubicación del ctrl | Ruta a coffeSoft.php |
|---|---|
| `DEV/modulo/ctrl/` | `../../conf/coffeSoft.php` |
| `DEV/modulo/sub/ctrl/` | `../../../conf/coffeSoft.php` |
| `DEV/modulo/sub/sub2/ctrl/` | `../../../../conf/coffeSoft.php` |
