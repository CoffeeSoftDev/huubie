# PIVOTE INDEX - Estructura Estándar para Archivos index.php

## Descripción
Este pivote define la estructura estándar para todos los archivos `index.php` del sistema ERP. Proporciona una base consistente con validación de sesión, integración de layouts, y carga de módulos siguiendo las mejores prácticas del framework CoffeeSoft.

## Objetivo
Establecer un patrón uniforme para los puntos de entrada de todos los módulos del sistema, asegurando:
- Validación de sesión consistente
- Carga ordenada de recursos
- Integración con el sistema de navegación
- Estructura HTML semántica
- Compatibilidad con CoffeeSoft Framework

## Estructura Base

```php
<?php
session_start();

// Validar sesión de usuario
if (empty($_COOKIE["IDU"])) {
    require_once('../../acceso/ctrl/ctrl-logout.php');
    exit();
}

require_once('layout/head.php');
require_once('layout/core-libraries.php');
?>

<!-- CoffeeSoft Framework -->
<script src="../../src/js/coffeeSoft.js"></script>
<script src="https://rawcdn.githack.com/SomxS/Grupo-Varoch/refs/heads/main/src/js/plugins.js"></script>
<script src="https://www.plugins.erp-varoch.com/ERP/JS/complementos.js"></script>

<body>
    <?php require_once('../../layout/navbar.php'); ?>

    <main>
        <section id="sidebar"></section>

        <div id="main__content">
            <!-- Breadcrumb Navigation -->
            <nav aria-label="breadcrumb">
                <ol class="breadcrumb">
                    <li class="breadcrumb-item text-uppercase text-muted">[MÓDULO_PADRE]</li>
                    <li class="breadcrumb-item fw-bold active">[MÓDULO_ACTUAL]</li>
                </ol>
            </nav>

            <!-- Main Container -->
            <div class="main-container" id="root"></div>

            <!-- Módulo Scripts -->
            <script src="js/[nombre-modulo].js?t=<?php echo time(); ?>"></script>
        </div>
    </main>
</body>
</html>
```

## Componentes del Pivote

### 1. Validación de Sesión
```php
session_start();

// Validar sesión de usuario
if (empty($_COOKIE["IDU"])) {
    require_once('../../acceso/ctrl/ctrl-logout.php');
    exit();
}
```

**Reglas:**
- SIEMPRE iniciar con `session_start()`
- Validar cookie `IDU` para verificar sesión activa
- Redirigir a logout si no hay sesión válida
- Usar `exit()` después de la redirección

### 2. Carga de Layouts
```php
require_once('layout/head.php');
require_once('layout/core-libraries.php');
```

**Reglas:**
- Cargar `head.php` primero (contiene meta tags, CSS, estilos)
- Cargar `core-libraries.php` segundo (contiene jQuery, Bootstrap, plugins)
- Usar rutas relativas al módulo actual

### 3. CoffeeSoft Framework
```php
<!-- CoffeeSoft Framework -->
<script src="../../src/js/coffeeSoft.js"></script>
<script src="https://rawcdn.githack.com/SomxS/Grupo-Varoch/refs/heads/main/src/js/plugins.js"></script>
<script src="https://www.plugins.erp-varoch.com/ERP/JS/complementos.js"></script>
```

**Reglas:**
- SIEMPRE cargar en este orden: coffeeSoft.js → plugins.js → complementos.js
- Usar comentario descriptivo `<!-- CoffeeSoft Framework -->`
- Mantener las rutas exactas del pivote

### 4. Estructura HTML
```php
<body>
    <?php require_once('../../layout/navbar.php'); ?>

    <main>
        <section id="sidebar"></section>

        <div id="main__content">
            <!-- Breadcrumb Navigation -->
            <nav aria-label="breadcrumb">
                <ol class="breadcrumb">
                    <li class="breadcrumb-item text-uppercase text-muted">[MÓDULO_PADRE]</li>
                    <li class="breadcrumb-item fw-bold active">[MÓDULO_ACTUAL]</li>
                </ol>
            </nav>

            <!-- Main Container -->
            <div class="main-container" id="root"></div>

            <!-- Módulo Scripts -->
            <script src="js/[nombre-modulo].js?t=<?php echo time(); ?>"></script>
        </div>
    </main>
</body>
```

**Reglas:**
- Incluir navbar del sistema
- Mantener estructura: `<main>` → `<section id="sidebar">` → `<div id="main__content">`
- Breadcrumb con comentario descriptivo
- Container principal con `id="root"`
- Scripts del módulo al final con cache busting `?t=<?php echo time(); ?>`

## Ejemplos de Uso

### Ejemplo 1: Módulo de Almacén
```php
<?php
session_start();

if (empty($_COOKIE["IDU"])) {
    require_once('../../acceso/ctrl/ctrl-logout.php');
    exit();
}

require_once('layout/head.php');
require_once('layout/core-libraries.php');
?>

<!-- CoffeeSoft Framework -->
<script src="../../src/js/coffeeSoft.js"></script>
<script src="https://rawcdn.githack.com/SomxS/Grupo-Varoch/refs/heads/main/src/js/plugins.js"></script>
<script src="https://www.plugins.erp-varoch.com/ERP/JS/complementos.js"></script>

<body>
    <?php require_once('../../layout/navbar.php'); ?>

    <main>
        <section id="sidebar"></section>

        <div id="main__content">
            <!-- Breadcrumb Navigation -->
            <nav aria-label="breadcrumb">
                <ol class="breadcrumb">
                    <li class="breadcrumb-item text-uppercase text-muted">Operación</li>
                    <li class="breadcrumb-item fw-bold active">Almacén</li>
                </ol>
            </nav>

            <!-- Main Container -->
            <div class="main-container" id="root"></div>

            <!-- Módulo de Almacén -->
            <script src="js/almacen.js?t=<?php echo time(); ?>"></script>
        </div>
    </main>
</body>
</html>
```

### Ejemplo 2: Módulo de Finanzas
```php
<?php
session_start();

if (empty($_COOKIE["IDU"])) {
    require_once('../../acceso/ctrl/ctrl-logout.php');
    exit();
}

require_once('layout/head.php');
require_once('layout/core-libraries.php');
?>

<!-- CoffeeSoft Framework -->
<script src="../../src/js/coffeeSoft.js"></script>
<script src="https://rawcdn.githack.com/SomxS/Grupo-Varoch/refs/heads/main/src/js/plugins.js"></script>
<script src="https://www.plugins.erp-varoch.com/ERP/JS/complementos.js"></script>

<body>
    <?php require_once('../../layout/navbar.php'); ?>

    <main>
        <section id="sidebar"></section>

        <div id="main__content">
            <!-- Breadcrumb Navigation -->
            <nav aria-label="breadcrumb">
                <ol class="breadcrumb">
                    <li class="breadcrumb-item text-uppercase text-muted">Contabilidad</li>
                    <li class="breadcrumb-item fw-bold active">Administrador</li>
                </ol>
            </nav>

            <!-- Main Container -->
            <div class="main-container" id="root"></div>

            <!-- Módulos del Sistema -->
            <script src="js/admin.js?t=<?php echo time(); ?>"></script>
            <script src="js/cuenta-venta.js?t=<?php echo time(); ?>"></script>
            <script src="js/efectivo.js?t=<?php echo time(); ?>"></script>
        </div>
    </main>
</body>
</html>
```

### Ejemplo 3: Módulo Simple (Sin Submódulos)
```php
<?php
session_start();

if (empty($_COOKIE["IDU"])) {
    require_once('../../acceso/ctrl/ctrl-logout.php');
    exit();
}

require_once('layout/head.php');
require_once('layout/core-libraries.php');
?>

<!-- CoffeeSoft Framework -->
<script src="../../src/js/coffeeSoft.js"></script>
<script src="https://rawcdn.githack.com/SomxS/Grupo-Varoch/refs/heads/main/src/js/plugins.js"></script>
<script src="https://www.plugins.erp-varoch.com/ERP/JS/complementos.js"></script>

<body>
    <?php require_once('../../layout/navbar.php'); ?>

    <main>
        <section id="sidebar"></section>

        <div id="main__content">
            <!-- Breadcrumb Navigation -->
            <nav aria-label="breadcrumb">
                <ol class="breadcrumb">
                    <li class="breadcrumb-item text-uppercase text-muted">Reportes</li>
                    <li class="breadcrumb-item fw-bold active">Dashboard</li>
                </ol>
            </nav>

            <!-- Main Container -->
            <div class="main-container" id="root"></div>

            <!-- Módulo de Dashboard -->
            <script src="js/dashboard.js?t=<?php echo time(); ?>"></script>
        </div>
    </main>
</body>
</html>
```

## Reglas de Implementación

### ✅ OBLIGATORIO

1. **Validación de Sesión:**
   - SIEMPRE validar cookie `IDU`
   - SIEMPRE redirigir a logout si no hay sesión
   - SIEMPRE usar `exit()` después de redirección

2. **Orden de Carga:**
   - session_start() → validación → layouts → CoffeeSoft → body

3. **Estructura HTML:**
   - Mantener jerarquía: main → sidebar → main__content
   - SIEMPRE incluir breadcrumb con comentario
   - SIEMPRE usar `id="root"` en el container principal

4. **Scripts:**
   - SIEMPRE agregar cache busting `?t=<?php echo time(); ?>`
   - Cargar scripts del módulo al final del main__content

### ❌ PROHIBIDO

1. **NO** omitir la validación de sesión
2. **NO** cambiar el orden de carga de CoffeeSoft
3. **NO** modificar los IDs estándar (sidebar, main__content, root)
4. **NO** cargar scripts antes del body
5. **NO** usar rutas absolutas para recursos internos

## Variaciones Permitidas

### Múltiples Scripts
Si el módulo tiene varios submódulos, cargar todos los scripts necesarios:

```php
<!-- Módulos del Sistema -->
<script src="js/modulo1.js?t=<?php echo time(); ?>"></script>
<script src="js/modulo2.js?t=<?php echo time(); ?>"></script>
<script src="js/modulo3.js?t=<?php echo time(); ?>"></script>
```

### Breadcrumb con Más Niveles
Para módulos con jerarquía profunda:

```php
<nav aria-label="breadcrumb">
    <ol class="breadcrumb">
        <li class="breadcrumb-item text-uppercase text-muted">Nivel 1</li>
        <li class="breadcrumb-item text-uppercase text-muted">Nivel 2</li>
        <li class="breadcrumb-item fw-bold active">Nivel 3</li>
    </ol>
</nav>
```

### Sin Validación de Sesión (Solo para páginas públicas)
**USAR CON PRECAUCIÓN - Solo para login, registro, etc.**

```php
<?php
session_start();
// Sin validación de cookie para páginas públicas
require_once('layout/head.php');
require_once('layout/core-libraries.php');
?>
```

## Archivos de Layout Requeridos

### layout/head.php
Debe contener:
- DOCTYPE y meta tags
- Favicon
- CSS: Fontello, Bootstrap, SweetAlert, DataTables, Select2
- TailwindCSS CDN
- Estilos personalizados

### layout/core-libraries.php
Debe contener:
- jQuery
- Bootstrap JS
- Select2, Bootbox, SweetAlert2
- Moment.js, DateRangePicker
- DataTables
- Chart.js
- Navbar y Sidebar scripts

## Integración con CoffeeSoft

El pivote está diseñado para trabajar perfectamente con:
- **Templates**: Layouts predefinidos (primaryLayout, splitLayout, etc.)
- **Components**: Tablas, formularios, filtros, modales
- **Complements**: Utilidades y helpers

## Notas Importantes

1. **Rutas Relativas:** Ajustar según la profundidad del módulo
   - Módulo raíz: `../src/js/coffeeSoft.js`
   - Submódulo: `../../src/js/coffeeSoft.js`

2. **Cache Busting:** El `?t=<?php echo time(); ?>` previene problemas de caché en desarrollo

3. **Comentarios:** Mantener comentarios descriptivos para claridad

4. **Consistencia:** Seguir EXACTAMENTE este pivote para todos los módulos nuevos

## Checklist de Implementación

Antes de considerar completo un index.php, verificar:

- [ ] ✅ session_start() al inicio
- [ ] ✅ Validación de cookie IDU
- [ ] ✅ Redirección a logout si no hay sesión
- [ ] ✅ Carga de layout/head.php
- [ ] ✅ Carga de layout/core-libraries.php
- [ ] ✅ CoffeeSoft Framework en orden correcto
- [ ] ✅ Navbar incluido
- [ ] ✅ Estructura main → sidebar → main__content
- [ ] ✅ Breadcrumb con comentario
- [ ] ✅ Container con id="root"
- [ ] ✅ Scripts con cache busting
- [ ] ✅ Comentarios descriptivos
- [ ] ✅ HTML válido y bien formateado

## Mantenimiento

Este pivote es **INMUTABLE**. Cualquier cambio debe:
1. Ser discutido con el equipo
2. Actualizarse en TODOS los módulos existentes
3. Documentarse en este archivo

---

**Versión:** 1.0  
**Última actualización:** 2025-01-23  
**Autor:** CoffeeIA ☕  
**Estado:** Aprobado para producción
