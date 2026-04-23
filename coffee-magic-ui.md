# Coffee Magic UI — Incidencia Diario

Guia de referencia visual extraida de `rrhh-incidencia-diario.html`.
Usar como fuente de verdad para replicar la UI en cualquier otra vista de Huubie.

---

## 1. Foundations

### Tipografia
| Propiedad | Valor |
|-----------|-------|
| Font family | `'Inter', system-ui, sans-serif` |
| Weights usados | 300, 400, 500, 600, 700, 800 |
| CDN | `https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800` |

### Base reset
```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body { height: 100vh; overflow: hidden; }
```

---

## 2. Paleta de colores

### 2.1 Dark theme (default)

| Rol | HEX | Uso |
|-----|-----|-----|
| **Body / fondo global** | `#111928` | `<html>`, `<body>`, thead sticky |
| **Sidebar** | `#0f172a` | `<aside>` background |
| **Header / sub-header** | `#141d2b` | header, titulo, filtros bar, footer |
| **Input / controles** | `#1a2332` | inputs, selects, toggle container, theme switcher |
| **Hover fila tabla** | `#1a2332` | `hover:bg-[#1a2332]` |
| **Borde primario** | `gray-800` (~`#1f2937`) | separadores horizontales y verticales |
| **Borde secundario** | `gray-700` (~`#374151`) | bordes de inputs y controles |
| **Texto principal** | `#ffffff` | encabezados, nombres |
| **Texto secundario** | `gray-300` (~`#d1d5db`) | valores de hora, input text |
| **Texto terciario** | `gray-400` (~`#9ca3af`) | sidebar items, datos secundarios en tabla |
| **Texto muted** | `gray-500` (~`#6b7280`) | placeholders, subtitulos, iconos search |
| **Texto disabled** | `gray-600` (~`#4b5563`) | — |
| **Scrollbar thumb** | `#374151` | thin scrollbar custom |

### 2.2 Light theme (`data-theme="light"`)

| Elemento dark | Valor light | Nota |
|---------------|-------------|------|
| Body `#111928` | `#f3f4f6` | fondo global |
| Sidebar `#0f172a` | `#ffffff` | sidebar blanca |
| `#111928` containers | `#f9fafb` | thead, input bg |
| `#141d2b` | `#ffffff` | header, cards |
| `#1a2332` | `#f3f4f6` | inputs, hover |
| `#1F2A37` | `#ffffff` | contenedores |
| `border gray-800` | `#e5e7eb` | bordes principales |
| `border gray-700` | `#d1d5db` | bordes controles |
| `text-white` | `#111928` | texto principal |
| `text-gray-300` | `#374151` | texto secundario |
| `text-gray-400` | `#4b5563` | texto terciario |
| `text-gray-500` | `#6b7280` | texto muted |
| `text-gray-600` | `#9ca3af` | texto disabled |
| Sidebar item default | `#6b7280` | — |
| Sidebar item hover | `rgba(124,58,237,.08)` bg, `#111928` text | — |
| Sidebar item active | `#7c3aed` text, `rgba(124,58,237,.12)` bg | — |
| thead | `#f9fafb` | tabla header |
| divider | `#e5e7eb` | filas tabla |
| Input bg | `#f9fafb` | — |
| Input border | `#e5e7eb` | — |
| Input text | `#111928` | — |
| Placeholder | `#9ca3af` | — |

### 2.3 Theme switcher active state
```css
[data-theme-btn].theme-active {
  background: rgba(124,58,237,.8);
  color: #fff;
  border-radius: 4px;
}
```

---

## 3. Colores de acento

| Nombre | HEX | Uso |
|--------|-----|-----|
| **Purple principal** | `#7c3aed` | sidebar active border, toggle pill inactivo, tema accent |
| **Purple 600** | `purple-600` | logo badge sidebar |
| **Purple claro** | `#c4b5fd` | texto sidebar active dark, texto badge puesto |
| **Blue** | `#1c64f2` | toggle pill activo, badge puesto piso border |
| **Blue claro** | `#76a9fa` | texto badge puesto piso |
| **Green** | `#3fc189` | badge "ATiempo" texto y borde |
| **Red** | `#ea0234` | badge "Retardo" y "Falta" texto y borde |

---

## 4. Badge system

### 4.1 Badge base
```css
.badge-base {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 9999px;    /* pill */
  font-size: 10px;
  font-weight: 700;
  border: 1px solid;
}
```

### 4.2 Badge de estatus

| Badge | Background | Text color | Border color |
|-------|-----------|------------|--------------|
| **ATiempo** | `rgba(63,193,137,.15)` | `#3fc189` | `rgba(63,193,137,.3)` |
| **Retardo** | `rgba(234,2,52,.15)` | `#ea0234` | `rgba(234,2,52,.35)` |
| **Falta** | `rgba(234,2,52,.15)` | `#ea0234` | `rgba(234,2,52,.35)` |
| **Sin Estatus** | `rgba(156,163,175,.15)` | `#9ca3af` | `rgba(156,163,175,.3)` |

### 4.3 Badge de puesto

| Badge | Background | Text color | Border color |
|-------|-----------|------------|--------------|
| **Admin** | `rgba(124,58,237,.18)` | `#c4b5fd` | `rgba(124,58,237,.35)` |
| **Cocina** | `rgba(124,58,237,.18)` | `#c4b5fd` | `rgba(124,58,237,.35)` |
| **Piso** | `rgba(28,100,242,.18)` | `#76a9fa` | `rgba(28,100,242,.35)` |

---

## 5. Sidebar

| Propiedad | Valor |
|-----------|-------|
| Ancho | `w-56` (224px) |
| Background | `#0f172a` |
| Border right | `border-gray-800` |
| Logo badge | `w-8 h-8 rounded-lg bg-purple-600` con texto "hb" |

### Sidebar items
```css
.sidebar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  border-radius: 8px;
  font-size: 12px;
  color: #9ca3af;
  cursor: pointer;
}
.sidebar-item:hover {
  background: rgba(124,58,237,.08);
  color: #d1d5db;
}
.sidebar-item.active {
  color: #c4b5fd;
  background: rgba(124,58,237,.15);
}
```

### Sub-items
```css
.sidebar-sub {
  padding-left: 32px;
  font-size: 11px;
}
.sidebar-sub.active {
  color: #c4b5fd;
  background: rgba(124,58,237,.12);
  border-left: 2px solid #7c3aed;
}
```

Items deshabilitados usan `opacity-60`.

---

## 6. Header

| Zona | Background | Border |
|------|-----------|--------|
| Header principal | `#141d2b` | `border-b border-gray-800` |
| Titulo section | `#141d2b` | `border-b border-gray-800` |
| Filtros bar | `#141d2b` | `border-b border-gray-800` |

### Search input (header)
- Background: transparente
- Font size: `text-sm`
- Text color: `text-gray-300`
- Icono: `text-gray-500`, 16px

### Avatar
- `w-8 h-8 rounded-full`
- Gradient: `from-purple-500 to-pink-500`
- Iniciales: `text-[10px] font-bold`

---

## 7. Filtros bar

### Input base
```css
.input-base {
  background: #1a2332;
  border: 1px solid #374151;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  color: #d1d5db;
}
```

### Toggle pill (Diario / Personalizado)
```css
.toggle-pill {
  padding: 6px 18px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
}
.toggle-pill.active   { background: #1c64f2; color: #fff; }
.toggle-pill.inactive { background: #7c3aed; color: #fff; opacity: .7; }
```

Container: `bg-[#1a2332] border border-gray-700 rounded-lg p-1 gap-1`

---

## 8. Tabla

| Propiedad | Valor |
|-----------|-------|
| Ancho | `w-full` |
| thead sticky | `sticky top-0 bg-[#111928] z-10` |
| Header text | `text-[10px] text-gray-500 uppercase tracking-wider` |
| Header padding | `py-3 px-6` (primera y ultima col), `py-3 px-3` (middle) |
| Body divider | `divide-y divide-gray-800/50` |
| Row hover | `hover:bg-[#1a2332]` |
| Cell nombre | `text-xs font-medium` |
| Cell datos | `text-[11px] text-gray-400` |
| Cell hora | `text-[11px] text-gray-300` |
| Cell vacio | `text-[11px] text-gray-500` con `—` |

### Avatares de tabla
Circulos `w-8 h-8 rounded-full` con gradientes variados:

| Gradient | Desde | Hasta |
|----------|-------|-------|
| purple-pink | `purple-500` | `pink-500` |
| green-teal | `green-500` | `teal-500` |
| blue-purple | `blue-500` | `purple-500` |
| orange-red | `orange-500` | `red-500` |
| pink-purple | `pink-500` | `purple-500` |
| teal-blue | `teal-500` | `blue-500` |
| yellow-orange | `yellow-500` | `orange-500` |
| red-pink | `red-500` | `pink-500` |
| indigo-purple | `indigo-500` | `purple-500` |
| green-blue | `green-500` | `blue-500` |

Iniciales: `text-[10px] font-bold` blanco.

---

## 9. Footer

| Propiedad | Valor |
|-----------|-------|
| Background | `#141d2b` |
| Border | `border-t border-gray-800` |
| Padding | `px-6 py-2` |
| Text | `text-[10px] text-gray-500` |

---

## 10. Scrollbar custom

```css
.scrollbar-thin::-webkit-scrollbar       { width: 4px; height: 4px; }
.scrollbar-thin::-webkit-scrollbar-track  { background: transparent; }
.scrollbar-thin::-webkit-scrollbar-thumb  { background: #374151; border-radius: 4px; }
```

---

## 11. Theme switching (JS)

- Almacena en `localStorage` key: `huubie-theme`
- Default: `dark`
- Se aplica via `data-theme` attribute en `<body>`
- Light overrides usan selectores `body[data-theme="light"] .clase`
- Transicion de botones: `transition: .15s`

---

## 12. Resumen de decision de diseno

- **Framework CSS**: Tailwind via CDN (`cdn.tailwindcss.com`)
- **Filosofia**: Dark-first, light como override via `body[data-theme]`
- **Accent principal**: Purple `#7c3aed` / `#c4b5fd`
- **Accent secundario**: Blue `#1c64f2` / `#76a9fa`
- **Semantico positivo**: Green `#3fc189`
- **Semantico negativo**: Red `#ea0234`
- **Neutro**: Gray scale `#9ca3af`
- **Bordes**: Siempre sutiles, usando gray-700/gray-800 en dark
- **Border radius**: `8px` para controles, `9999px` para badges/pills, `rounded-full` para avatares
- **Layout**: Sidebar fija + main flex column con header sticky y tabla scrollable
- **No frameworks JS**: Vanilla JS puro para theme toggle

---

## 13. Modales

### 13.1 Estructura base modal
```html
<!-- Backdrop -->
<div class="fixed inset-0 bg-black/60"></div>

<!-- Modal card -->
<div class="relative z-10 w-[420px] bg-[#1F2A37] rounded-2xl p-6 border border-gray-700">
    
    <button class="absolute top-3 right-3 text-gray-400 hover:text-white">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" >
        </svg>
    
    </button>
 
 </div>
```

### 13.2 Tamanos de modal

| Tipo | Ancho | Uso |
|------|-------|-----|
| **Pequeno** | `w-[420px]` | Formularios simples (permiso, confirmacion) |
| **Mediano** | `w-[540px]` | Seleccion de items, upload |
| **Grande** | `w-[720px]` | Formularios complejos con 2 columnas (orden de compra) |

### 13.3 Modal card
```css
.modal-card {
  background: #1F2A37;
  border: 1px solid #374151;   /* border-gray-700 */
  border-radius: 16px;         /* rounded-2xl */
  padding: 24px;               /* p-6 */
}
```

### 13.4 Input dentro de modal
```css
.input-modal {
  background: #1a2332;
  border: 1px solid #374151;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  color: #d1d5db;
  width: 100%;
}
.input-modal:focus {
  outline: none;
  border-color: #7c3aed;
}
```

### 13.5 Select estilizado (sin arrow nativa)
```css
select.input-modal {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
}
```

### 13.6 Label de campo
```html
<label class="text-[11px] text-gray-500 block mb-1">Nombre del campo</label>
```

### 13.7 Textarea
```html
<textarea rows="3"
  class="w-full bg-[#1a2332] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-purple-500"
  placeholder="Descripcion..."></textarea>
```

---

## 14. Botones

### 14.1 Botones de accion principal

| Tipo | Background | Text | Border | Uso |
|------|-----------|------|--------|-----|
| **Primary (purple)** | `#7c3aed` | `#fff` | — | Enviar, Confirmar |
| **Primary (blue)** | `#1c64f2` | `#fff` | — | Subir, Enviar (finanzas) |
| **Danger** | `#ea0234` | `#fff` | — | Rechazar, Eliminar |
| **Secondary** | `gray-600` | `#fff` | — | Cancelar (inline) |
| **Ghost** | `transparent` | `gray-300` | `gray-500` | Cancelar (centrado) |
| **Icon-only** | `#1a2332` | `gray-400` | `gray-700` | Adjuntar, acciones extra |

### 14.2 Boton primary ejemplo
```html
<!-- Inline (flex row con otros botones) -->
<button class="flex-1 py-2 rounded-lg bg-[#7c3aed] text-white text-xs font-semibold">Enviar</button>

<!-- Centrado (modal grande) -->
<button class="px-8 py-2.5 rounded-lg bg-[#1c64f2] text-white text-sm font-semibold hover:bg-blue-600 transition">Enviar</button>
```

### 14.3 Boton cancelar ejemplo
```html
<!-- Inline -->
<button class="flex-1 py-2 rounded-lg bg-gray-600 text-white text-xs font-semibold">Cancelar</button>

<!-- Ghost -->
<button class="px-8 py-2.5 rounded-lg border border-gray-500 text-gray-300 text-sm font-semibold hover:bg-gray-700 transition">Cancelar</button>
```

### 14.4 Boton icon-only
```html
<button class="w-9 h-9 rounded-lg bg-[#1a2332] border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white">
    <svg class="w-4 h-4">...</svg>
</button>
```

### 14.5 Boton con icono + texto (action bar)
```html
<button class="px-4 py-2 rounded-lg bg-[#1c64f2] text-white text-xs font-semibold flex items-center gap-2 hover:bg-blue-500">
    Subir Ingreso
    <svg class="w-3.5 h-3.5">...</svg>
</button>
```

### 14.6 Toggle button group
```css
.toggle-btn {
  padding: 6px 16px;
  font-size: 11px;
  border-radius: 6px;
  cursor: pointer;
  transition: all .2s;
  border: 1px solid #374151;
}
.toggle-btn.active {
  background: #7c3aed;
  color: #fff;
  border-color: #7c3aed;
}
.toggle-btn:not(.active) {
  background: transparent;
  color: #9ca3af;
}
```

---

## 15. Cards

### 15.1 Card base
```css
.card-base {
  background: #1F2A37;
  border: 1px solid rgba(55,65,81,.6);
  border-radius: 12px;
}
```

### 15.2 Stat card (KPI)
```html
<div class="card-base p-4">
    <div class="flex items-start justify-between mb-1">
        <p class="text-3xl font-bold text-white">5</p>
        <div class="w-8 h-8 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center">
            <svg class="w-4 h-4">...</svg>
        </div>
    </div>
    <p class="text-xs font-semibold text-white">Altas</p>
    <p class="text-[10px] text-gray-500">del 15 al 30 agosto 2024</p>
</div>
```

Colores de icono para stat cards:

| Tipo | Background | Icon color |
|------|-----------|------------|
| Positivo / Altas | `bg-green-500/20` | `text-green-400` |
| Negativo / Bajas | `bg-red-500/20` | `text-red-400` |
| Info / Docs | `bg-blue-500/20` | `text-blue-400` |
| Accent / Vacantes | `bg-purple-500/20` | `text-purple-400` |
| Monetario / Propina | `bg-pink-500/20` | `text-pink-400` |

### 15.3 Stat card grande (detalle financiero)
```html
<div class="card-base p-5">
    <div class="flex items-start justify-between">
        <div>
            <p class="text-xs text-gray-400 mb-1">Venta Total Sin Impuestos</p>
            <p class="text-3xl font-bold">40,689</p>
        </div>
        <div class="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-green-400">...</svg>
        </div>
    </div>
    <div class="mt-3 space-y-0.5">
        <p class="text-[11px] text-gray-500">Venta Alimentos: <span class="text-gray-300">20,000</span></p>
        <p class="text-[11px] text-gray-500">Venta Bebidas: <span class="text-gray-300">10,000</span></p>
    </div>
</div>
```

### 15.4 Card placeholder (agregar)
```html
<button class="rounded-xl border-2 border-dashed border-purple-500/40 flex items-center justify-center text-purple-400 hover:bg-purple-500/5 transition">
    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
    </svg>
</button>
```

---

## 16. Tabs

### 16.1 Tab bar (dentro de card)
```html
<div class="flex gap-1 border-b border-gray-800 mb-4 text-[11px]">
    <button class="tab-btn active px-3 py-2 font-semibold">Alta</button>
    <button class="tab-btn px-3 py-2 text-gray-500 border-b-2 border-transparent">Bajas</button>
    <button class="tab-btn px-3 py-2 text-gray-500 border-b-2 border-transparent">Activos</button>
</div>
```

```css
.tab-btn.active {
  color: #7c3aed;
  border-bottom: 2px solid #7c3aed;
}
```

---

## 17. Filtros bar

### 17.1 Estructura completa de filtros
```html
<div class="flex items-center gap-3 px-6 py-3 bg-[#141d2b] border-b border-gray-800 flex-shrink-0">
    <!-- Icono filtro -->
    <div class="flex items-center gap-2 text-xs text-gray-400">
        <svg class="w-4 h-4"><!-- filter icon --></svg>
        <span class="font-semibold">Filter By</span>
    </div>
    <!-- Campos de filtro -->
    <select class="input-base"><option>Encargado</option></select>
    <input type="text" value="Juan" class="input-base w-36">
    <select class="input-base"><option>Status</option></select>
    <!-- Reset -->
    <button class="text-xs text-red-400 font-semibold hover:text-red-300 flex items-center gap-1">
        <svg class="w-3 h-3"><!-- refresh icon --></svg>
        Reset Filter
    </button>
    <!-- Spacer + Action -->
    <div class="flex-1"></div>
    <button class="px-4 py-2 rounded-lg bg-[#1c64f2] text-white text-xs font-semibold flex items-center gap-2">
        Subir Ingreso
    </button>
</div>
```

---

## 18. Upload / Drag zone

```html
<div class="border border-dashed border-gray-600 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 transition">
    <div class="w-12 h-12 rounded-lg bg-[#1a2332] border border-gray-700 flex items-center justify-center mb-3">
        <svg class="w-5 h-5 text-gray-400"><!-- upload icon --></svg>
    </div>
    <span class="text-xs text-gray-400 font-medium">Subir Cotizaciones</span>
</div>
```

---

## 19. Calendar inline (date picker)

```css
.calendar       { background:#1a2332; border:1px solid #374151; border-radius:8px; padding:12px; position:absolute; top:calc(100% + 4px); left:0; z-index:20; width:100%; }
.cal-header     { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; font-size:11px; color:#d1d5db; font-weight:600; }
.cal-nav        { width:20px; height:20px; border-radius:4px; background:#111928; display:flex; align-items:center; justify-content:center; color:#9ca3af; cursor:pointer; }
.cal-grid       { display:grid; grid-template-columns:repeat(7, 1fr); gap:2px; }
.cal-dow        { font-size:9px; color:#6b7280; text-align:center; padding:4px 0; }
.cal-day        { font-size:10px; color:#d1d5db; text-align:center; padding:5px 0; border-radius:4px; cursor:pointer; }
.cal-day:hover  { background:#374151; }
.cal-day.active { background:#7c3aed; color:#fff; font-weight:bold; }
.cal-day.other  { color:#4b5563; }
```

---

## 20. Badge fecha (pill de fecha en sub-header)

```html
<div class="badge-fecha">
    <svg class="w-4 h-4"><!-- calendar icon --></svg>
    Fecha
</div>
```
```css
.badge-fecha {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #7c3aed;
  color: #fff;
  padding: 6px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
}
```

---

## 21. Badges adicionales (permisos / tipos)

| Badge | Background | Text | Border |
|-------|-----------|------|--------|
| **Aprobado** | `rgba(63,193,137,.15)` | `#3fc189` | `rgba(63,193,137,.3)` |
| **Rechazado** | `rgba(234,2,52,.15)` | `#ea0234` | `rgba(234,2,52,.35)` |
| **Pendiente** | `rgba(251,191,36,.15)` | `#fbbf24` | `rgba(251,191,36,.3)` |
| **Incapacidad** | `rgba(244,114,182,.15)` | `#f472b6` | `rgba(244,114,182,.3)` |
| **Vacaciones** | `rgba(124,58,237,.18)` | `#c4b5fd` | `rgba(124,58,237,.35)` |
| **Permiso** | `rgba(249,115,22,.15)` | `#fb923c` | `rgba(249,115,22,.3)` |

---

## 22. Resumen de summary totals (dentro de modal)

```html
<div class="border border-gray-700 rounded-lg p-4 space-y-2">
    <div class="flex items-center justify-between">
        <span class="text-sm text-gray-300">SubTotal</span>
        <input type="number" step="0.01" value="0.00" class="input-modal w-28 text-right">
    </div>
    <div class="flex items-center justify-between">
        <span class="text-sm text-gray-300">Impuestos</span>
        <input type="number" step="0.01" value="0.00" class="input-modal w-28 text-right">
    </div>
    <div class="flex items-center justify-between border-t border-gray-700 pt-2">
        <span class="text-sm text-white font-semibold">Total</span>
        <input type="number" step="0.01" value="0.00" class="input-modal w-28 text-right font-semibold">
    </div>
</div>
```

---

## 23. Detalle header (vista de detalle)

Patron de 3 columnas para mostrar info de contexto:
```html
<div class="grid grid-cols-3 gap-6 mb-6">
    <div>
        <p class="text-[11px] text-gray-500 mb-1">Reporta:</p>
        <p class="text-sm font-bold">Virginia Walker</p>
        <p class="text-[11px] text-gray-400">Cajera Turno Matutino</p>
    </div>
    <div>
        <p class="text-[11px] text-gray-500 mb-1">Corte y tipo de archivo:</p>
        <p class="text-sm">Corte X o Corte Z</p>
    </div>
    <div class="text-right">
        <p class="text-sm">Fecha del Corte : 30 Ene 2024</p>
        <p class="text-[11px] text-gray-400 mt-1">Hora: 11:50 pm</p>
    </div>
</div>
```

---

## 24. Grid de stat cards

| Layout | Clase | Uso |
|--------|-------|-----|
| **5 columnas** | `grid grid-cols-5 gap-4` | Dashboard resumen (KPIs pequenos) |
| **3 columnas** | `grid grid-cols-3 gap-4` | Detalle financiero (cards mas grandes) |
| **2 columnas** | `grid grid-cols-2 gap-6` | Modal de formulario doble columna |

---

## 25. Graficos (Chart.js)

- CDN: `https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js`
- Se renderizan dentro de `<canvas>` en un contenedor de altura fija: `h-[260px]`
- Leyenda custom debajo del canvas:
```html
<div class="flex items-center gap-4 mt-3 text-[10px] text-gray-400">
    <div class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-[#7c3aed]"></span>Sucursal 1
    </div>
    <div class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-[#06b6d4]"></span>Sucursal 2
    </div>
</div>
```

---

## 26. Light theme overrides (bloque copy-paste)

Este bloque CSS se repite en cada template de pagina completa:
```css
body[data-theme="light"] { background:#f3f4f6; color:#111928; }
body[data-theme="light"] aside.bg-\[\#0f172a\] { background:#ffffff !important; }
body[data-theme="light"] .bg-\[\#111928\] { background:#f9fafb !important; }
body[data-theme="light"] .bg-\[\#141d2b\] { background:#ffffff !important; }
body[data-theme="light"] .bg-\[\#1a2332\] { background:#f3f4f6 !important; }
body[data-theme="light"] .bg-\[\#1F2A37\] { background:#ffffff !important; }
body[data-theme="light"] .border-gray-800 { border-color:#e5e7eb !important; }
body[data-theme="light"] .border-gray-700 { border-color:#d1d5db !important; }
body[data-theme="light"] .text-white { color:#111928 !important; }
body[data-theme="light"] .text-gray-300 { color:#374151 !important; }
body[data-theme="light"] .text-gray-400 { color:#4b5563 !important; }
body[data-theme="light"] .text-gray-500 { color:#6b7280 !important; }
body[data-theme="light"] .text-gray-600 { color:#9ca3af !important; }
body[data-theme="light"] .sidebar-item { color:#6b7280 !important; }
body[data-theme="light"] .sidebar-item:hover { background:rgba(124,58,237,.08) !important; color:#111928 !important; }
body[data-theme="light"] .sidebar-item.active { color:#7c3aed !important; background:rgba(124,58,237,.12) !important; }
body[data-theme="light"] .hover\:bg-\[\#1a2332\]:hover { background:#f3f4f6 !important; }
body[data-theme="light"] thead { background:#f9fafb !important; }
body[data-theme="light"] .divide-gray-800\/50 > * + * { border-color:#e5e7eb !important; }
body[data-theme="light"] .card-base { background:#ffffff !important; border-color:#e5e7eb !important; }
body[data-theme="light"] .input-base { background:#f9fafb !important; border-color:#e5e7eb !important; color:#111928 !important; }
body[data-theme="light"] input::placeholder { color:#9ca3af !important; }
[data-theme-btn] { transition:.15s; }
[data-theme-btn].theme-active { background:rgba(124,58,237,.8); color:#fff !important; border-radius:4px; }
```
