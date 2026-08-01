# Paleta oficial Huubie — CoffeeSoft Dark Theme

> Fuente autoritativa: [app/ui/css/ui-kit.css](../../ui/css/ui-kit.css) (tokens `--cs-*`) +
> [app/ui/docs/grimorio-ui-kit.md](../../ui/docs/grimorio-ui-kit.md) (grimorio de CoffeeMagic).
> Verificada contra los hex reales más usados en el código del proyecto.
>
> ⚠️ **No confundir** con la paleta "Arcilla Invernal" (terracota) de `coffee/app/visor/PALETTE.md`:
> esa es **solo** del Visor de Agentes de CoffeeIA, **no** del producto Huubie.

**Tema único:** oscuro (dark). **Fuente:** Inter. **Stack:** Tailwind v3 + clases utilitarias `.cs-*`.

---

## 1) Fondos (capas de profundidad)

| Token | Hex | Uso |
|---|---|---|
| `--cs-bg-sidebar` | `#0f172a` | Sidebar lateral |
| `--cs-bg-dashboard` | `#0E1521` | Fondo de dashboards |
| `--cs-bg-body` | `#111928` | Fondo de página (body) |
| `--cs-bg-header` | `#141d2b` | Header de tabla, topbar |
| `--cs-bg-input` / `--cs-bg-hover` | `#1a2332` | Inputs, selects, hover de filas |
| `--cs-bg-card` | `#1F2A37` | Cards, paneles, modales, tablas |
| `--cs-bg-alt` | `#283341` | Filas alternas (striped) |

```
█#0f172a  █#0E1521  █#111928  █#141d2b  █#1a2332  █#1F2A37  █#283341
 sidebar   dash      body      header    input     card      alt
```

---

## 2) Acentos y estados

| Token | Hex | Uso |
|---|---|---|
| `--cs-primary` | `#1C64F2` | Botones primarios, tabs activos, links |
| `--cs-primary-hover` | `#1a53d4` | Hover de primario |
| `--cs-secondary` | `#7152EC` | Hover de cards, focus |
| `--cs-accent-purple` | `#7C3AED` | Borde hover de cards, borde focus de input |
| `--cs-success` | `#3FC189` | Éxito, activo, aprobado |
| `--cs-danger` | `#EA0234` | Error, eliminar, inactivo |
| `--cs-warning` | `#fbbf24` | Advertencia, pendiente |
| `--cs-info` | `#76A9FA` | Informativo, callouts |

```
█#1C64F2  █#7152EC  █#7C3AED  █#3FC189  █#EA0234  █#fbbf24  █#76A9FA
 primary   second.   purple    success   danger    warning   info
```

---

## 3) Texto

| Token | Hex | Uso |
|---|---|---|
| `--cs-text-primary` | `#FFFFFF` | Títulos, texto principal |
| `--cs-text-secondary` | `#9CA3AF` | Subtítulos, labels, metadatos |
| `--cs-text-muted` | `#6B7280` | Placeholders, deshabilitado |

---

## 4) Bordes

| Token | Valor | Uso |
|---|---|---|
| `--cs-border` | `#374151` | Bordes de inputs, cards, tablas (hex más usado del proyecto) |
| `--cs-border-light` | `rgba(55,65,81,0.6)` | Separadores sutiles |
| `--cs-border-focus` | `#7C3AED` | Borde de input en focus |

---

## 5) Radios y sombras

| Token | Valor |
|---|---|
| `--cs-radius-sm` | `4px` |
| `--cs-radius-md` | `8px` |
| `--cs-radius-lg` | `12px` |
| `--cs-radius-xl` | `16px` |
| `--cs-radius-full` | `9999px` |
| `--cs-shadow-sm` | `0 1px 2px rgba(0,0,0,0.3)` |
| `--cs-shadow-md` | `0 4px 6px rgba(0,0,0,0.4)` |
| `--cs-shadow-lg` | `0 10px 15px rgba(0,0,0,0.5)` |
| `--cs-shadow-card` | `0 4px 6px rgba(0,0,0,0.3)` |

---

## 6) Capas que conviven (estado real, no unificado)

El proyecto tiene **3 capas de color** que no están unificadas. Esta es la verdad de runtime:

| Capa | Qué carga | Paleta | Estado |
|---|---|---|---|
| Templates / módulos `.cs-*` | [ui-kit.css](../../ui/css/ui-kit.css) | **Grimorio oficial** (este doc) | ✅ canónico |
| Chrome global | [colors.css](../../src/css/colors.css) vía [head.php](../../layout/head.php) | Legacy Bootstrap (morado `#3D2474`, warning `#E74041`) | ⚠️ diverge |
| Formularios JS | inline en `CF_CSS` de [coffeeSoft.js](../../src/js/coffeeSoft.js) | navy `#003360` (no existe en el grimorio) | ⚠️ inconsistente |

**Dirección recomendada:** usar siempre los tokens `--cs-*` de esta tabla; migrar `colors.css` y los `#003360` de `CF_CSS` hacia `#1C64F2` (primary) cuando se toquen.

---

## 7) Snippet de uso

```css
.mi-card {
    background: var(--cs-bg-card);
    color: var(--cs-text-primary);
    border: 1px solid var(--cs-border);
    border-radius: var(--cs-radius-md);
    box-shadow: var(--cs-shadow-card);
}
.mi-card .meta { color: var(--cs-text-secondary); }

.mi-btn {
    background: var(--cs-primary);
    color: #fff;
    border: none;
    border-radius: var(--cs-radius-md);
}
.mi-btn:hover { background: var(--cs-primary-hover); }
```

---

*Documento generado a partir del análisis de `app/ui/` (grimorio CoffeeMagic) y verificado contra los hex reales del código del proyecto.*
