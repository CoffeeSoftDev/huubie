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
