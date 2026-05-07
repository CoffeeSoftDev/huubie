
# Grimorio UI-Kit: CoffeeSoft Dark Theme (Huubie)

> **Uso:** Este grimorio es la referencia de diseno oficial para el agente **CoffeeMagic**. Todos los templates HTML, modales y utilidades generadas deben seguir estos tokens, colores, componentes y reglas de layout.

---

## 1. Filosofia del Sistema

- **Tema unico:** Oscuro (dark). No generar temas claros a menos que se solicite explicitamente.
- **Tecnologia:** HTML estatico con Tailwind CSS v3 via CDN + clases utilitarias CSS custom (prefijo `.cs-*`).
- **Fuente:** Inter (Google Fonts).
- **Iconografia:** SVG inline estilo Heroicons (stroke 1.5-2, 24x24) o Fontello (clases `icon-*`).

---

## 2. Tokens de Color

### Fondos (Backgrounds)

| Token | Hex | Uso |
|-------|-----|-----|
| `bg-body` | `#111928` | Fondo de pagina (body) |
| `bg-card` | `#1F2A37` | Cards, paneles, modales, tablas |
| `bg-input` | `#1a2332` | Inputs, selects, textareas, hover de filas |
| `bg-header` | `#141d2b` | Header de tabla, topbar |
| `bg-sidebar` | `#0f172a` | Sidebar lateral |
| `bg-alt` | `#283341` | Filas alternas en tabla (striped) |
| `bg-dashboard` | `#0E1521` | Fondo de dashboards |

### Acentos y Estados

| Token | Hex | Uso |
|-------|-----|-----|
| `primary` | `#1C64F2` | Botones primarios, tabs activos, enlaces |
| `primary-hover` | `#1a53d4` | Hover de primario |
| `secondary` | `#7152EC` | Hover de cards, focus de inputs |
| `accent-purple` | `#7C3AED` | Bordes hover, acentos destacados |
| `success` | `#3FC189` | Exito, activo, badges aprobado |
| `danger` | `#EA0234` | Error, eliminar, inactivo |
| `warning` | `#fbbf24` | Advertencia, pendiente, amber |
| `info` | `#76A9FA` | Informativo, callouts info |

### Texto

| Token | Hex | Uso |
|-------|-----|-----|
| `text-primary` | `#FFFFFF` | Titulos, texto principal |
| `text-secondary` | `#9CA3AF` | Subtitulos, labels, metadatos |
| `text-muted` | `#6B7280` | Placeholders, texto deshabilitado |

### Bordes

| Token | Valor | Uso |
|-------|-------|-----|
| `border` | `#374151` | Bordes generales de inputs, cards, tablas |
| `border-light` | `rgba(55,65,81,.6)` | Separadores sutiles |
| `border-focus` | `#7C3AED` | Borde de input en focus |

---

## 3. Tipografia

- **Fuente base:** Inter (cargar desde Google Fonts).
- **Tamanos tipicos:**
  - Titulo de pagina: `text-2xl` (24px), `font-bold`
  - Subtitulo/seccion: `text-lg` (18px), `font-semibold`
  - Cuerpo: `text-sm` (14px)
  - Tabla header: `text-xs` (12px), `uppercase`, `tracking-wider`, `text-gray-500`
  - Tabla celda: `text-sm` (14px)
  - Badge: `10px`, `font-bold`
  - Label input: `text-[11px]`, `uppercase`, `tracking-wider`, `text-gray-500`
  - Boton: `text-xs` / `text-sm`, `font-semibold`

---

## 4. Layout Canonico (primaryLayout)

Este es el patron OBLIGATORIO para cualquier modulo CoffeeSoft. Basado en `alpha/pedidos/src/js/app.js`:

```html
<!-- Shell de pagina -->
<div id="mainContainer" class="w-full min-h-screen flex flex-col text-white mt-12 p-3 overflow-x-hidden">
  <div id="root" class="w-full max-w-full overflow-x-auto" style="background-color:#111828;">

    <!-- Layout canonico -->
    <div id="{PROJECT_NAME}" class="flex mx-2 h-[calc(100vh-120px)]">
      <div class="w-full flex flex-col">

        <!-- Filter bar -->
        <div id="filterBar" class="w-full my-3">
          <div id="filterBar{PROJECT_NAME}" class="w-full my-3">
            <!-- Filtros, selects, inputs, boton nuevo -->
          </div>
          <div id="containerHours"></div>
        </div>

        <!-- Contenedor principal -->
        <div id="container{PROJECT_NAME}"
             class="w-full my-2 bg-[#1F2A37] h-screen rounded-lg p-3 overflow-auto">
          <!-- Tabla, cards, formulario o contenido del modulo -->
        </div>

      </div>
    </div>

  </div>
</div>
```

### Reglas del layout:
- `class` del wrapper: `'flex mx-2 '` (sin `p-2`).
- `heightPreset`: siempre `'full'` (via `h-[calc(100vh-120px)]`).
- `card.filterBar.id`: literal `'filterBar'` (id generico).
- `card.container`: incluye `h-screen` + `overflow-auto` para scroll vertical interno.
- Dentro de `#filterBar` se inyectan dos divs:
  - `#filterBar${PROJECT_NAME}` para filtros.
  - `#containerHours` para fecha/hora del modulo si aplica.

---

## 5. Componentes

### 5.1 Botones

Usar clases `.cs-btn` + variante. Siempre incluir icono SVG cuando tenga sentido.

| Variante | Clases | Uso |
|----------|--------|-----|
| Primary | `.cs-btn.cs-btn-primary` | Accion principal (guardar, crear, confirmar) |
| Secondary | `.cs-btn.cs-btn-secondary` | Accion secundaria destacada |
| Success | `.cs-btn.cs-btn-success` | Exito, activar, aprobar |
| Danger | `.cs-btn.cs-btn-danger` | Eliminar, desactivar, cancelar destructivo |
| Outline | `.cs-btn.cs-btn-outline` | Cancelar, accion secundaria no destructiva |
| Ghost | `.cs-btn.cs-btn-ghost` | Accion terciaria, ver, detalle |

### 5.2 Cards

**Card de modulo (grid inicial):**
```html
<div class="group h-[200px] bg-[#333D4C] rounded-lg shadow-lg overflow-hidden p-4
            flex flex-col justify-between cursor-pointer transition-all
            hover:shadow-xl hover:scale-105 hover:border hover:border-[#7C3AED]">
  <div class="w-14 h-14 bg-[#233876] rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
    <svg class="w-7 h-7 text-blue-400" ...></svg>
  </div>
  <div class="flex-grow flex flex-col justify-center">
    <h3 class="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">Titulo</h3>
    <p class="text-gray-400 text-sm">Descripcion</p>
  </div>
</div>
```

**KPI Card:**
```html
<div class="bg-[#1F2A37] text-white rounded-xl shadow p-4">
  <p class="text-sm text-gray-300">Ventas Totales</p>
  <p class="text-2xl font-bold text-pink-400">$128,450.00</p>
</div>
```

### 5.3 Tablas

**Tabla CoffeeSoft Dark:**
```html
<div class="overflow-x-auto rounded-lg border border-gray-700">
  <table class="cs-table">
    <thead>
      <tr>
        <th>Columna</th>
        <th class="text-right">Total</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Valor</td>
        <td class="text-right font-medium">$0.00</td>
      </tr>
    </tbody>
  </table>
</div>
```

Estilos aplicados por `.cs-table`:
- Header: `bg-[#141d2b]`, texto `text-gray-300`, `uppercase`, `text-xs`.
- Filas: `bg-[#1F2A37]`, hover `bg-[#1a2332]`.
- Filas alternas: `bg-[#283341]`.
- Bordes: `border-bottom: 1px solid #374151`.

### 5.4 Formularios

**Input oscuro:**
```html
<div>
  <label class="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1">Label</label>
  <input type="text" class="cs-input" placeholder="Placeholder...">
</div>
```

**Select:**
```html
<select class="cs-select">
  <option>Opcion</option>
</select>
```

**Textarea:**
```html
<textarea class="cs-textarea" placeholder="..."></textarea>
```

### 5.5 Badges

```html
<span class="cs-badge cs-badge-success">Activo</span>
<span class="cs-badge cs-badge-danger">Rechazado</span>
<span class="cs-badge cs-badge-warning">Pendiente</span>
<span class="cs-badge cs-badge-info">Info</span>
<span class="cs-badge cs-badge-purple">Admin</span>
```

### 5.6 Tabs

```html
<div class="cs-tabs">
  <button class="cs-tab active">Tab Activo</button>
  <button class="cs-tab">Tab Inactivo</button>
</div>
```

### 5.7 Modales

**Modal de formulario:**
```html
<div class="cs-modal-backdrop"></div>
<div class="cs-modal">
  <div class="cs-modal-header">
    <h3 class="cs-modal-title">Titulo</h3>
    <button><svg>...cerrar</svg></button>
  </div>
  <div class="cs-modal-body">
    <!-- Formulario -->
  </div>
  <div class="cs-modal-footer">
    <button class="cs-btn cs-btn-outline">Cancelar</button>
    <button class="cs-btn cs-btn-primary">Guardar</button>
  </div>
</div>
```

**Modal de confirmacion:**
```html
<div class="cs-modal" style="max-width: 420px;">
  <div class="cs-modal-body text-center py-8">
    <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/15 flex items-center justify-center">
      <svg class="w-8 h-8 text-red-400" ...></svg>
    </div>
    <h3 class="text-xl font-semibold mb-2">¿Eliminar?</h3>
    <p class="text-gray-400 text-sm mb-6">Mensaje de confirmacion.</p>
    <div class="flex justify-center gap-3">
      <button class="cs-btn cs-btn-outline">Cancelar</button>
      <button class="cs-btn cs-btn-danger">Eliminar</button>
    </div>
  </div>
</div>
```

### 5.8 Callouts / Alertas

```html
<div class="cs-callout cs-callout-info">
  <strong class="block text-sm mb-1">Informacion</strong>
  <p class="text-sm text-gray-400">Mensaje.</p>
</div>
```

Variantes: `cs-callout-info`, `cs-callout-success`, `cs-callout-warning`, `cs-callout-danger`.

### 5.9 Dropdown de Acciones

```html
<div class="relative inline-block">
  <button class="icon-dot-3 text-gray-400 hover:text-blue-400"></button>
  <ul class="cs-dropdown-menu">
    <li><a><svg>...</svg> Editar</a></li>
    <li><a><svg>...</svg> Eliminar</a></li>
  </ul>
</div>
```

---

## 6. Reglas para CoffeeMagic

1. **Siempre usar el tema oscuro.** Body: `bg-[#111928] text-white`.
2. **Usar Inter como fuente.** Cargar desde Google Fonts.
3. **Inputs, selects y textareas** deben usar `.cs-input`, `.cs-select`, `.cs-textarea` (definidos en `ui-kit.css`).
4. **Tablas** deben usar `.cs-table` y estar envueltas en `overflow-x-auto rounded-lg border border-gray-700`.
5. **Botones** deben usar `.cs-btn` + variante. No usar colores Tailwind sueltos para botones principales.
6. **Badges** deben usar `.cs-badge` + variante de estado.
7. **Modales** deben usar `.cs-modal`, `.cs-modal-backdrop`, `.cs-modal-header`, `.cs-modal-body`, `.cs-modal-footer`.
8. **Labels de formulario** deben ser `text-[11px] uppercase tracking-wider text-gray-500`.
9. **Iconos** preferir SVG inline de Heroicons (24x24, stroke-width 2).
10. **Cards de modulo** deben incluir hover con `hover:scale-105`, `hover:shadow-xl`, `hover:border-[#7C3AED]`.
11. **KPI cards** deben usar `bg-[#1F2A37] rounded-xl shadow p-4`.
12. **Layout canonico** debe seguir la estructura de `layout-primary.html`.

---

## 7. Archivos de Referencia

| Archivo | Descripcion |
|---------|-------------|
| `css/ui-kit.css` | Tokens CSS, variables, componentes `.cs-*` |
| `templates/layout-primary.html` | Layout canonico de modulo |
| `templates/component-buttons.html` | Variantes de botones |
| `templates/component-cards.html` | Cards de modulo, KPI, generica |
| `templates/component-tables.html` | Tablas dark, agrupadas, vacias |
| `templates/component-forms.html` | Formularios, inputs, chips |
| `templates/component-badges-tabs.html` | Badges, tabs, callouts |
| `modals/modal-form.html` | Modal de formulario |
| `modals/modal-confirm.html` | Modal de confirmacion |
| `modals/modal-dropdown-actions.html` | Dropdown de acciones en tabla |
| `index.html` | Pagina maestra con todos los componentes |

---

*Generado el 2026-05-07 a partir del analisis de `alpha/` y `coffee/admin/`.*
