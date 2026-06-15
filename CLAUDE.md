# Huubie

## Layout canonico de modulos

Todos los modulos Huubie deben usar la misma configuracion de `primaryLayout` que define `App.layout()` en [alpha/pedidos/src/js/app.js](alpha/pedidos/src/js/app.js) (lineas 54-71). Es el patron de referencia para cualquier clase que extienda `Templates`.

```js
layout() {
    this.primaryLayout({
        parent: "root",
        id: this.PROJECT_NAME,
        class: 'flex mx-2 ',
        heightPreset: 'full',
        card: {
            filterBar: { class: 'w-full ', id: 'filterBar' },
            // El fondo del container depende del tema del modulo (ver regla de tema abajo).
            // En el ejemplo de alpha/pedidos el modulo es dark, por eso usa bg-[#1F2A37].
            container: { class: 'w-full my-2 bg-[#1F2A37] h-screen rounded p-3 overflow-auto', id: 'container' + this.PROJECT_NAME }
        }
    });

    // Filter bar wrapper.
    $('#filterBar').html(`
        <div id="filterBar${this.PROJECT_NAME}" class="w-full my-3 " ></div>
        <div id="containerHours"></div>
    `);
}
```

### Reglas

- `class` del wrapper: `'flex mx-2 '` (sin `p-2`).
- `heightPreset`: siempre `'full'`. Nunca `'auto'`.
- `card.filterBar.id`: literal `'filterBar'` (id generico, no `'filterBar' + PROJECT_NAME`).
- `card.container`: incluye `h-screen` + `overflow-auto` para scroll vertical interno.
- **Fondo del container segun tema (no es fijo):** el `bg-[#1F2A37]` del ejemplo aplica solo a modulos en **tema dark**. El fondo se elige por el tema del modulo, no se copia siempre:
  - **dark:** `bg-[#1F2A37]` (azul-gris oscuro). Usar cuando el modulo corre en dark y sus tabs/tablas/modales van con `theme: 'dark'`.
  - **light:** sin fondo (transparente, hereda el blanco de la pagina) o `bg-white border border-gray-200` si se quiere efecto tarjeta. Usar cuando el modulo va con `theme: 'light'` (filterBar, createTable, modales y badges en paleta clara).
  - Regla practica: el fondo del container debe coincidir con el `theme` que usan los componentes internos (`tabLayout`, `createTable`, `createModalForm`). Nunca mezclar container `#1F2A37` con contenido light, ni container claro con contenido dark.
- Dentro de `#filterBar` se inyecta el HTML con dos divs:
  - `#filterBar${PROJECT_NAME}` -> donde el modulo engancha `createfilterBar()` y demas selectores (`.advanced-filter`, `#subsidiaries_id`, etc.).
  - `#containerHours` -> reservado para mostrar fecha/hora del modulo si aplica.

Los selectores existentes (`#filterBar${PROJECT_NAME} .advanced-filter`, `#filterBar${PROJECT_NAME} #subsidiaries_id`) siguen funcionando porque ese div vive dentro del wrapper `#filterBar`.
