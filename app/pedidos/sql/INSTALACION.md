# 🚀 Guía de Instalación - Base de Datos Projects

## 📋 Opción 1: Crear Nueva Base de Datos

### Paso 1: Ejecutar el Script Completo

**Desde MySQL Workbench / phpMyAdmin:**
1. Abre el archivo `create_database_complete.sql`
2. Copia todo el contenido
3. Pégalo en la consola SQL
4. Haz clic en "Ejecutar" o presiona `Ctrl + Enter`

**Desde Línea de Comandos:**
```bash
mysql -u root -p < create_database_complete.sql
```

### Paso 2: Verificar la Instalación

```sql
USE projects_db;
SELECT * FROM projects;
```

Deberías ver 6 proyectos con emojis.

---

## 🔄 Opción 2: Usar Base de Datos Existente

### Paso 1: Editar el Script

Abre `convert_to_utf8mb4.sql` y reemplaza:
```sql
ALTER DATABASE `tu_base_datos`  -- ⚠️ Cambia esto
```

Por el nombre real de tu base de datos:
```sql
ALTER DATABASE `fayxzvov_coffee`  -- Ejemplo
```

### Paso 2: Ejecutar la Conversión

```bash
mysql -u root -p tu_base_datos < convert_to_utf8mb4.sql
```

### Paso 3: Crear la Tabla

```bash
mysql -u root -p tu_base_datos < create_projects_table.sql
```

---

## ⚙️ Configuración de PHP

Para que PHP maneje correctamente los emojis, agrega esto en tu conexión:

### Usando MySQLi:
```php
$conn = new mysqli($host, $user, $pass, $db);
$conn->set_charset("utf8mb4");
```

### Usando PDO:
```php
$pdo = new PDO(
    "mysql:host=$host;dbname=$db;charset=utf8mb4",
    $user,
    $pass
);
```

### En tu archivo _CRUD.php:
Asegúrate de tener:
```php
$this->conn->set_charset("utf8mb4");
```

---

## ✅ Verificar que Funciona

### Test 1: Verificar Character Set

```sql
-- Ver configuración de la base de datos
SHOW VARIABLES LIKE 'character_set%';

-- Debe mostrar utf8mb4 en:
-- character_set_client
-- character_set_connection
-- character_set_database
-- character_set_results
```

### Test 2: Insertar Emoji

```sql
INSERT INTO projects (name, size, status, subsidiaries_id) 
VALUES ('Test Emoji 🎉', '📏 Pequeño', 1, 1);

SELECT * FROM projects WHERE name LIKE '%🎉%';
```

Si ves el emoji correctamente, ¡funciona! ✅

### Test 3: Desde PHP

```php
<?php
$conn = new mysqli("localhost", "user", "pass", "projects_db");
$conn->set_charset("utf8mb4");

$result = $conn->query("SELECT * FROM projects WHERE name LIKE '%🚀%'");
while ($row = $result->fetch_assoc()) {
    echo $row['name'] . "<br>";  // Debe mostrar: Proyecto Alpha 🚀
}
?>
```

---

## 🐛 Solución de Problemas

### Problema: Los emojis se ven como "????"

**Causa:** Character set incorrecto

**Solución:**
```sql
ALTER DATABASE tu_base_datos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE projects CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Problema: Error al insertar emojis

**Causa:** Conexión PHP no usa utf8mb4

**Solución:**
```php
$conn->set_charset("utf8mb4");  // Agregar después de conectar
```

### Problema: Emojis se guardan pero no se muestran

**Causa:** HTML no especifica UTF-8

**Solución:**
```html
<meta charset="UTF-8">
```

Y en PHP:
```php
header('Content-Type: text/html; charset=utf-8');
```

---

## 📊 Resumen de Configuración

| Componente | Configuración Requerida |
|------------|------------------------|
| **Base de Datos** | `CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` |
| **Tabla** | `DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` |
| **Campos** | `CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` |
| **Conexión PHP** | `$conn->set_charset("utf8mb4");` |
| **HTML** | `<meta charset="UTF-8">` |

---

## 🎯 Siguiente Paso

Una vez instalada la base de datos, puedes usar:

- **Modelo:** `mdl/mdl-projects.php`
- **Controlador:** `ctrl/ctrl-projects.php`

Para gestionar los proyectos desde tu aplicación.

---

**¿Necesitas ayuda?** Revisa `README-PROJECTS.md` para más información. ☕
