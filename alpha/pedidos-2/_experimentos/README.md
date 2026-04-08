# Archivos experimentales / Prototipos

Este directorio contiene archivos JavaScript que se encontraron en el módulo original `alpha/pedidos/src/js/` pero que **no son referenciados desde ningún archivo PHP activo** (`index.php`, `admin.php`, etc.). Son prototipos o código experimental sin uso en producción.

## Archivos

### `coffee.js`
Prototipo de una clase `App extends Templates` con `PROJECT_NAME = "Orders"` que define un modal `showOrderDetails(orderId)` usando `bootbox.dialog`. Apunta a un endpoint remoto `http://www.coffeehuubie.com/dev/pedidos/ctrl/ctrl-pedidos.php`.

### `coffee-mod.js`
Variante muy similar a `coffee.js`: define otra `class App extends Templates` con un método `showOrder(orderId)` que usa el mismo modal `bootbox.dialog`. Probable versión alternativa del mismo prototipo.

## Decisión

Se conservan aquí por posibles referencias futuras, pero **no se cargan en `index.php` ni `admin.php`** del módulo `pedidos-2`. Si en el futuro se necesita esa funcionalidad, la lógica está disponible para revisión.

Si después de revisar el contenido se confirma que no aportan valor, pueden eliminarse.
