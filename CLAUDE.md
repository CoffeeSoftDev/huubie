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
- Dentro de `#filterBar` se inyecta el HTML con dos divs:
  - `#filterBar${PROJECT_NAME}` -> donde el modulo engancha `createfilterBar()` y demas selectores (`.advanced-filter`, `#subsidiaries_id`, etc.).
  - `#containerHours` -> reservado para mostrar fecha/hora del modulo si aplica.

Los selectores existentes (`#filterBar${PROJECT_NAME} .advanced-filter`, `#filterBar${PROJECT_NAME} #subsidiaries_id`) siguen funcionando porque ese div vive dentro del wrapper `#filterBar`.
