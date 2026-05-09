
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

### 5.10 Toggle / Switch

Componente custom para activar/desactivar estados.

```html
<div class="cs-toggle" onclick="this.querySelector('.cs-toggle-track').classList.toggle('active')">
  <div class="cs-toggle-track">
    <div class="cs-toggle-knob"></div>
  </div>
  <span class="text-sm text-gray-300">Activo</span>
</div>
```

| Estado | Clase del track |
|--------|-----------------|
| Inactivo | `.cs-toggle-track` (bg `#374151`) |
| Activo | `.cs-toggle-track.active` (bg `#7C3AED`) |

### 5.11 Toast / Notificacion

Alertas temporales flotantes. 4 variantes de color.

```html
<div class="cs-toast cs-toast-success">
  <svg class="w-5 h-5 text-green-400 shrink-0" ...></svg>
  <div>
    <p class="text-sm font-medium text-white">Operacion exitosa</p>
    <p class="text-xs text-gray-400 mt-0.5">El registro se guardo correctamente.</p>
  </div>
</div>
```

| Variante | Clase | Color de borde |
|----------|-------|----------------|
| Exito | `.cs-toast-success` | `rgba(63,193,137,0.3)` |
| Advertencia | `.cs-toast-warning` | `rgba(251,191,36,0.3)` |
| Error | `.cs-toast-danger` | `rgba(234,2,52,0.3)` |
| Info | `.cs-toast-info` | `rgba(28,100,242,0.3)` |

### 5.12 Input Groups

Input con icono lateral, moneda, o boton de accion.

```html
<!-- Input con icono izquierdo -->
<div class="relative">
  <span class="cs-input-group-icon">
    <svg class="w-4 h-4" ...></svg>
  </span>
  <input type="text" class="cs-input pl-10" placeholder="Buscar...">
</div>

<!-- Input moneda (alineacion derecha) -->
<div>
  <label class="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1">Monto</label>
  <input type="number" step="0.01" value="0.00" class="cs-input w-28 text-right font-semibold">
</div>
```

### 5.13 Radio & Checkbox

Estilizados con Tailwind. Siempre usar `accent-color` o clases de borde/fondo custom.

```html
<!-- Checkbox -->
<div class="flex items-center gap-2">
  <input type="checkbox" id="chk1" class="w-4 h-4 rounded border-gray-600 bg-[#1a2332] text-blue-600 focus:ring-blue-500">
  <label for="chk1" class="text-sm text-gray-300">Opcion activa</label>
</div>

<!-- Radio -->
<div class="flex items-center gap-2">
  <input type="radio" name="radio-demo" class="w-4 h-4 border-gray-600 bg-[#1a2332] text-blue-600 focus:ring-blue-500">
  <label class="text-sm text-gray-300">Opcion A</label>
</div>
```

### 5.14 Button Groups

Grupo de botones unidos horizontalmente.

```html
<div class="cs-btn-group">
  <button class="cs-btn cs-btn-primary active">Todos</button>
  <button class="cs-btn cs-btn-ghost">Activos</button>
  <button class="cs-btn cs-btn-ghost">Inactivos</button>
</div>
```

### 5.15 Avatar

Iniciales, imagen o placeholder.

```html
<div class="cs-avatar cs-avatar-sm">JD</div>
<div class="cs-avatar cs-avatar-md">JD</div>
<div class="cs-avatar cs-avatar-lg">JD</div>
<div class="cs-avatar cs-avatar-xl">
  <img src="avatar.jpg" alt="Usuario">
</div>
```

| Tamano | Clase | Dimension | Font-size |
|--------|-------|-----------|-----------|
| Small | `.cs-avatar-sm` | 24x24 | 10px |
| Medium | `.cs-avatar-md` | 36x36 | 14px |
| Large | `.cs-avatar-lg` | 48x48 | 18px |
| Extra | `.cs-avatar-xl` | 80x80 | 24px |

### 5.16 Paginacion

Controles de paginacion con conteo "Showing X-Y of Z".

```html
<div class="flex items-center justify-between mt-4">
  <p class="text-xs text-gray-500">Showing 1-10 of 47</p>
  <div class="cs-pagination">
    <button disabled><svg class="w-4 h-4" ...></svg></button>
    <button class="active-page">1</button>
    <button>2</button>
    <button>3</button>
    <button><svg class="w-4 h-4" ...></svg></button>
  </div>
</div>
```

### 5.17 Empty State

Estado vacio con icono y CTA.

```html
<div class="cs-empty-state">
  <svg class="w-12 h-12 text-gray-600 mb-4" ...></svg>
  <p class="text-gray-400 text-sm">No se encontraron registros</p>
  <button class="cs-btn cs-btn-primary cs-btn-sm mt-3">Crear nuevo</button>
</div>
```

### 5.18 Progress / Loading

Barras de progreso y spinners.

```html
<!-- Barra de progreso -->
<div class="cs-progress">
  <div class="cs-progress-bar" style="width: 65%"></div>
</div>

<!-- Spinner -->
<div class="cs-spinner"></div>
```

| Variante de barra | Clase adicional |
|-------------------|-----------------|
| Primario | (default) |
| Exito | `.success` |
| Advertencia | `.warning` |
| Peligro | `.danger` |

### 5.19 Navbar

Barra superior fija. Extraida de `alpha/layout/navbar.php`.

```html
<nav class="cs-navbar">
  <div class="flex items-center gap-4">
    <!-- Logo -->
    <span class="text-xl font-bold tracking-wide text-white">
      hb<span class="text-[#1C64F2]">&#9679;</span>
    </span>
    <button class="text-white text-2xl">&#9776;</button>
  </div>
  <div class="flex-1"></div>
  <div class="flex items-center gap-4">
    <!-- Grid icon -->
    <button class="text-gray-400 hover:text-white transition">
      <svg class="w-5 h-5" ...></svg>
    </button>
    <!-- Usuario -->
    <button class="flex items-center gap-3">
      <div class="cs-avatar cs-avatar-md">U</div>
      <div class="hidden md:flex flex-col items-start leading-tight">
        <span class="text-sm font-medium text-white">Admin Usuario</span>
        <span class="text-xs text-green-400">EN LINEA</span>
      </div>
    </button>
  </div>
</nav>
```

**Dropdown de usuario:**
```html
<div class="absolute right-0 top-full mt-2 w-64 p-4 rounded-2xl shadow-lg
            bg-[#1F2A37] border border-gray-700 text-white
            opacity-0 scale-95 invisible transition-all duration-300">
  <div class="flex flex-col items-center pb-2">
    <div class="cs-avatar cs-avatar-xl mb-2">LU</div>
    <h2 class="text-lg font-medium">Luis Garcia Valera</h2>
  </div>
  <div class="w-full text-center space-y-2 mt-4">
    <p class="text-gray-300 font-bold text-sm">Configuracion</p>
    <p class="text-gray-400 hover:text-white cursor-pointer text-sm">Mi Perfil</p>
    <p class="text-gray-400 hover:text-white cursor-pointer text-sm">Cerrar Sesion</p>
  </div>
</div>
```

### 5.20 Sidebar

Menu lateral con submenus expandibles. Extraido de `alpha/layout/sidebar.php`.

```html
<aside class="cs-sidebar">
  <nav class="space-y-1 p-4">
    <a href="#" class="cs-nav-link active">
      <svg class="w-5 h-5" ...></svg>
      Resumen
    </a>
    <div class="submenu">
      <button class="cs-nav-link w-full justify-between" onclick="toggleSubmenu(this)">
        <span class="flex items-center gap-3">
          <svg class="w-5 h-5" ...></svg>
          Acceso
        </span>
        <svg class="w-4 h-4 transition-transform" ...></svg>
      </button>
      <ul class="mt-1 pl-4 space-y-1 max-h-0 overflow-hidden transition-all duration-300">
        <li><a href="#" class="cs-nav-link">Eventos</a></li>
        <li><a href="#" class="cs-nav-link">Pedidos</a></li>
      </ul>
    </div>
  </nav>
</aside>
```

**Reglas del sidebar:**
- Ancho fijo: `224px` (`w-56`)
- Fondo: `#0f172a`
- Submenus: animacion de `max-height` (`0px` a `scrollHeight`)
- Flecha de submenu: rotacion `180deg` al abrir
- Solo un submenu abierto a la vez

---

## 6. Reglas para CoffeeMagic

1. **Siempre usar el tema oscuro.** Body: `bg-[#111928] text-white`.
2. **Usar Inter como fuente.** Cargar desde Google Fonts.
3. **Inputs, selects y textareas** deben usar `.cs-input`, `.cs-select`, `.cs-textarea`.
4. **Tablas** deben usar `.cs-table` y estar envueltas en `overflow-x-auto rounded-lg border border-gray-700`.
5. **Botones** deben usar `.cs-btn` + variante. No usar colores Tailwind sueltos para botones principales.
6. **Badges** deben usar `.cs-badge` + variante de estado.
7. **Modales** deben usar `.cs-modal`, `.cs-modal-backdrop`, `.cs-modal-header`, `.cs-modal-body`, `.cs-modal-footer`.
8. **Labels de formulario** deben ser `text-[11px] uppercase tracking-wider text-gray-500`.
9. **Iconos** preferir SVG inline de Heroicons (24x24, stroke-width 2).
10. **Cards de modulo** deben incluir hover con `hover:scale-105`, `hover:shadow-xl`, `hover:border-[#7C3AED]`.
11. **KPI cards** deben usar `bg-[#1F2A37] rounded-xl shadow p-4`.
12. **Layout canonico** debe seguir la estructura de `layout-primary.html`.
13. **Navbar** fija: `cs-navbar` con logo, toggle sidebar, grid icon, avatar usuario.
14. **Sidebar** fijo: `cs-sidebar` (`w-56`, `bg-[#0f172a]`) con `.cs-nav-link` y submenus expandibles.
15. **Toggle/Switch** siempre usar `.cs-toggle-track` + `.cs-toggle-knob` con clase `.active`.
16. **Toast/Notificaciones** usar `.cs-toast` + variante de color (`.cs-toast-success`, etc.).
17. **Avatares** usar `.cs-avatar` + tamano (`.cs-avatar-sm`, `.cs-avatar-md`, `.cs-avatar-lg`, `.cs-avatar-xl`).
18. **Paginacion** usar `.cs-pagination` con `.active-page` para la pagina actual.
19. **Progress** usar `.cs-progress` + `.cs-progress-bar` con clase `.success`/`.warning`/`.danger` si aplica.
20. **Button groups** usar `.cs-btn-group` para agrupar botones relacionados.
21. **Empty state** usar `.cs-empty-state` para tablas/listas sin registros.

---

## 7. Clases CSS `.cs-*` Completas

| Clase | Descripcion |
|-------|-------------|
| `.cs-bg-body` / `.cs-bg-card` / `.cs-bg-input` / `.cs-bg-hover` / `.cs-bg-header` / `.cs-bg-sidebar` / `.cs-bg-alt` / `.cs-bg-dash` | Utilidades de fondo |
| `.cs-text-primary` / `.cs-text-secondary` / `.cs-text-muted` / `.cs-text-primary-accent` / `.cs-text-success` / `.cs-text-danger` / `.cs-text-warning` / `.cs-text-info` / `.cs-text-purple` | Utilidades de texto |
| `.cs-card` / `.cs-card-hover` | Card contenedor |
| `.cs-input` / `.cs-select` / `.cs-textarea` | Inputs de formulario |
| `.cs-input-group` / `.cs-input-group-icon` | Input con icono |
| `.cs-btn` / `.cs-btn-primary` / `.cs-btn-secondary` / `.cs-btn-success` / `.cs-btn-danger` / `.cs-btn-outline` / `.cs-btn-ghost` / `.cs-btn-sm` / `.cs-btn-lg` | Botones |
| `.cs-btn-group` | Grupo de botones |
| `.cs-badge` / `.cs-badge-success` / `.cs-badge-danger` / `.cs-badge-warning` / `.cs-badge-info` / `.cs-badge-purple` | Badges |
| `.cs-table` | Tabla dark |
| `.cs-tabs` / `.cs-tab` | Tabs |
| `.cs-modal` / `.cs-modal-backdrop` / `.cs-modal-header` / `.cs-modal-body` / `.cs-modal-footer` / `.cs-modal-title` | Modales |
| `.cs-dropdown-menu` | Dropdown de acciones |
| `.cs-callout` / `.cs-callout-info` / `.cs-callout-success` / `.cs-callout-warning` / `.cs-callout-danger` | Callouts/Alertas |
| `.cs-kpi-card` / `.cs-kpi-label` / `.cs-kpi-value` | Cards de KPI |
| `.cs-scroll` | Scrollbar custom |
| `.cs-toggle` / `.cs-toggle-track` / `.cs-toggle-knob` | Toggle/Switch |
| `.cs-toast` / `.cs-toast-success` / `.cs-toast-warning` / `.cs-toast-danger` / `.cs-toast-info` | Toasts |
| `.cs-avatar` / `.cs-avatar-sm` / `.cs-avatar-md` / `.cs-avatar-lg` / `.cs-avatar-xl` | Avatares |
| `.cs-pagination` | Paginacion |
| `.cs-progress` / `.cs-progress-bar` / `.cs-spinner` | Progress y loading |
| `.cs-empty-state` | Estado vacio |
| `.cs-navbar` | Barra superior |
| `.cs-sidebar` / `.cs-nav-link` | Sidebar y links de navegacion |

---

## 8. Archivos de Referencia

| Archivo | Descripcion |
|---------|-------------|
| `css/ui-kit.css` | Tokens CSS, variables, componentes `.cs-*` |
| `templates/layout-primary.html` | Layout canonico de modulo |
| `templates/component-buttons.html` | Variantes de botones |
| `templates/component-cards.html` | Cards de modulo, KPI, generica |
| `templates/component-tables.html` | Tablas dark, agrupadas, vacias |
| `templates/component-forms.html` | Formularios, inputs, chips |
| `templates/component-badges-tabs.html` | Badges, tabs, callouts |
| `templates/component-navbar.html` | Navbar con dropdown de usuario |
| `templates/component-sidebar.html` | Sidebar con submenus |
| `templates/component-toast.html` | Toasts/Notificaciones |
| `modals/modal-form.html` | Modal de formulario |
| `modals/modal-confirm.html` | Modal de confirmacion |
| `modals/modal-dropdown-actions.html` | Dropdown de acciones en tabla |
| `index.html` | Pagina maestra con todos los componentes |

---

*Generado el 2026-05-07 a partir del analisis de `alpha/` y `coffee/admin/`.*
