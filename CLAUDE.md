# Huubie

## Reglas del framework CoffeeSoft: donde viven

La fuente unica de las convenciones (JS, ctrl, mdl) es **`~/.claude/steering/`**
(`%USERPROFILE%\.claude\steering\`). Antes de aplicar cualquier regla de estilo o
generar codigo CoffeeSoft, leer de ahi.

- Indice con `offset`/`limit` por seccion: el **embebido al final de `~/.claude/agents/CoffeeIA.md`**
  (23 archivos / 553 secciones, incluye `steering/grimorios/` y `steering/pivotes/`). Leer solo
  la seccion necesaria con `Read(file, offset, limit)`, no el archivo completo. Se regenera con
  `python ~/.claude/steering/regenerar_indice.py` tras editar cualquier steering file.
  (El viejo `steering/INDICE-STEERING.md` era un huerfano sin mantenimiento y fue eliminado.)
- Frontend JS -> `steering/FRONT-JS.md` (incluye nomenclatura, ciclo de vida
  `init/render/layout/filterBar/ls[Entidad]`, el formato de comentarios separadores `// -- Nombre --`,
  el render perezoso de tabs y la regla de theme de `tabLayout`).
- Controlador -> `steering/CTRL.md` · Modelo -> `steering/MDL.md`
- Que se puede comentar -> `steering/CoffeeIA.md` seccion "Reglas de Comentarios".
- Patrones probados de modulo -> `steering/pivotes/INDEX-PIVOTES.md` (consultar ANTES de generar
  un modulo con `tabLayout`; define los tokens de theme `light`/`dark` a aplicar).

**No usar `~/.claude/agents/*.md` como fuente de reglas:** son definiciones de
subagentes, y sus copias de FRONT-JS/CTRL/MDL quedaron desactualizadas y recortadas
frente al steering. Hoy son stubs que remiten aqui.

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
    this.createLayout({
        parent: 'filterBar',
        design: false,
        data: {
            id:    'filterBarWrap',
            class: 'w-full',
            container: [
                {
                    type:  'div',
                    id:    `filterBar${this.PROJECT_NAME}`,
                    class: 'w-full my-3'
                },
                {
                    type: 'div',
                    id:   'containerHours'
                }
            ]
        }
    });
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
- Dentro de `#filterBar` se montan dos huecos con **`createLayout`**, nunca con `.html()`:
  - `#filterBar${PROJECT_NAME}` -> donde el modulo engancha `createfilterBar()` y demas selectores (`.advanced-filter`, `#subsidiaries_id`, etc.).
  - `#containerHours` -> reservado para mostrar fecha/hora del modulo si aplica.

  > Versiones anteriores de este documento pintaban esos dos divs con un template
  > literal (`$('#filterBar').html(\`...\`)`). Eso contradice `steering/FRONT-JS.md`
  > seccion "PROHIBIDO: HTML crudo en metodos JS": la excepcion de wrappers simples
  > solo admite `.html()` con **maximo 2 elementos vacios y en una sola linea**, no
  > un literal multilinea. Si el layout necesita mas de eso -> `createLayout`.

- **Nunca dejar bandas vacias:** si una vista del modulo no usa filterBar (o la fila
  de KPIs), no se incluye esa banda en el layout — de lo contrario queda una franja
  con padding y borde sin contenido. Regla equivalente en `FRONT-JS.md`: *"NUNCA crear
  un filterBar vacio"*. Cuando el modulo alterna vistas, armar los `children` del
  layout de forma condicional (ver `App.layout()` en [app/facture/src/js/catalogos.js](app/facture/src/js/catalogos.js)).

Los selectores existentes (`#filterBar${PROJECT_NAME} .advanced-filter`, `#filterBar${PROJECT_NAME} #subsidiaries_id`) siguen funcionando porque ese div vive dentro del wrapper `#filterBar`.
