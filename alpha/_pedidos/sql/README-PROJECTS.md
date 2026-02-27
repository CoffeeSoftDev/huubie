# 📋 Tabla Projects - Base de Datos

## 📊 Estructura de la Tabla

### Campos:

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `id` | INT(11) | ID único del proyecto | 1, 2, 3... |
| `name` | VARCHAR(255) | Nombre del proyecto (con emojis) | "Proyecto Alpha 🚀" |
| `size` | VARCHAR(100) | Tamaño del proyecto (con emojis) | "📏 Pequeño", "📦 Mediano", "🏢 Grande" |
| `status` | TINYINT(1) | Estado del proyecto | 1=Activo, 0=Inactivo, 2=En Progreso, 3=Completado, 4=Cancelado |
| `date_creation` | DATETIME | Fecha de creación | 2025-01-10 14:30:00 |
| `date_updated` | DATETIME | Fecha de última actualización | 2025-01-11 10:15:00 |
| `subsidiaries_id` | INT(11) | ID de la sucursal | 1, 2, 3... |

## 🚀 Instalación

### 1. Ejecutar el Script SQL

```sql
-- Opción A: Desde MySQL Workbench o phpMyAdmin
-- Copia y pega el contenido de create_projects_table.sql

-- Opción B: Desde línea de comandos
mysql -u usuario -p nombre_base_datos < create_projects_table.sql
```

### 2. Verificar la Tabla

```sql
DESCRIBE projects;
```

Deberías ver la estructura de la tabla con todos los campos.

### 3. Verificar Datos de Ejemplo

```sql
SELECT * FROM projects;
```

Deberías ver 6 proyectos de ejemplo con emojis.

## 🎨 Tamaños Disponibles (con Emojis)

- 📏 **Pequeño** - Proyectos pequeños o individuales
- 📦 **Mediano** - Proyectos de tamaño medio
- 🏢 **Grande** - Proyectos empresariales o complejos

## 📌 Estados Disponibles

| ID | Estado | Emoji | Descripción |
|----|--------|-------|-------------|
| 1 | Activo | ✅ | Proyecto activo y en funcionamiento |
| 0 | Inactivo | ❌ | Proyecto pausado o inactivo |
| 2 | En Progreso | 🔄 | Proyecto en desarrollo |
| 3 | Completado | ✔️ | Proyecto finalizado |
| 4 | Cancelado | 🚫 | Proyecto cancelado |

## 💡 Consultas Útiles

### Ver todos los proyectos activos
```sql
SELECT * FROM projects WHERE status = 1;
```

### Ver proyectos por tamaño
```sql
SELECT * FROM projects WHERE size LIKE '%Pequeño%';
```

### Ver proyectos en progreso
```sql
SELECT * FROM projects WHERE status = 2;
```

### Contar proyectos por estado
```sql
SELECT 
    status,
    CASE 
        WHEN status = 1 THEN '✅ Activo'
        WHEN status = 0 THEN '❌ Inactivo'
        WHEN status = 2 THEN '🔄 En Progreso'
        WHEN status = 3 THEN '✔️ Completado'
        WHEN status = 4 THEN '🚫 Cancelado'
    END as estado_nombre,
    COUNT(*) as total
FROM projects 
GROUP BY status;
```

### Buscar proyectos por nombre (con emojis)
```sql
SELECT * FROM projects WHERE name LIKE '%🚀%';
```

## 🔧 Archivos del Sistema

### Backend (PHP)

1. **`mdl/mdl-projects.php`** - Modelo con métodos CRUD
   - `listProjects()` - Listar proyectos
   - `getProjectById()` - Obtener proyecto por ID
   - `createProject()` - Crear nuevo proyecto
   - `updateProject()` - Actualizar proyecto
   - `deleteProject()` - Eliminar proyecto
   - `getProjectsByStatus()` - Filtrar por estado
   - `getProjectsBySize()` - Filtrar por tamaño
   - `countProjectsByStatus()` - Contar por estado

2. **`ctrl/ctrl-projects.php`** - Controlador con endpoints
   - `init` - Inicializar (obtener tamaños y estados)
   - `listProjects` - Listar proyectos
   - `getProject` - Obtener un proyecto
   - `addProject` - Agregar proyecto
   - `editProject` - Editar proyecto
   - `deleteProject` - Eliminar proyecto
   - `changeStatus` - Cambiar estado

## 🎯 Ejemplos de Uso

### Crear un Proyecto con Emojis

```sql
INSERT INTO projects (name, size, status, subsidiaries_id) 
VALUES ('Mi Proyecto 🎨', '📦 Mediano', 2, 1);
```

### Actualizar el Estado de un Proyecto

```sql
UPDATE projects 
SET status = 3, date_updated = NOW() 
WHERE id = 1;
```

### Buscar Proyectos Grandes

```sql
SELECT * FROM projects 
WHERE size = '🏢 Grande' 
AND status IN (1, 2);
```

## ⚠️ Importante: Soporte para Emojis

La tabla usa **`utf8mb4_unicode_ci`** para soportar emojis. Asegúrate de que:

1. **Tu base de datos** use `utf8mb4`:
```sql
ALTER DATABASE nombre_bd CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. **Tu conexión PHP** use `utf8mb4`:
```php
$conn->set_charset("utf8mb4");
```

3. **Tus archivos PHP** estén guardados en **UTF-8 sin BOM**

## 🐛 Troubleshooting

### Los emojis se ven como "????"

**Solución:**
```sql
ALTER TABLE projects CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Error al insertar emojis

**Solución:** Verifica que la conexión use `utf8mb4`:
```php
mysqli_set_charset($conn, "utf8mb4");
```

## 📚 Recursos Adicionales

- [Documentación MySQL utf8mb4](https://dev.mysql.com/doc/refman/8.0/en/charset-unicode-utf8mb4.html)
- [Lista de Emojis](https://emojipedia.org/)
- [CoffeeSoft Framework](https://github.com/coffeesoft)

---

**Desarrollado con CoffeeSoft ☕**
