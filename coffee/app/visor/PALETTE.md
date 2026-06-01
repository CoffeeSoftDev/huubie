# Paleta de colores — Visor de Agentes

Sistema de tokens basado en la paleta **Arcilla Invernal** (acentos cálidos terracota / salmón / crema) sobre la base navy del Visor. Todos los componentes consumen estos tokens vía CSS variables, así que cambiar el acento o el fondo se propaga al instante.

---

## 1) Paleta base "Arcilla Invernal"

| Token | Hex | Rol |
|---|---|---|
| Terracota | `#C05A40` | Acento principal — botones primarios, focus, links |
| Salmón | `#E8A68F` | Acento suave — hover, gradientes, highlights |
| Crema | `#F7F0EB` | Fondo del light theme, badges sobre tints |
| Azul acero | `#8FA3B7` | Muted, accent secundario, file icons |
| Navy oscuro | `#1E2730` | Texto principal en light, acentos profundos |

```
█ #C05A40   █ #E8A68F   █ #F7F0EB   █ #8FA3B7   █ #1E2730
  Terracota   Salmón      Crema       Acero       Navy
```

---

## 2) Tema DARK (default)

### Fondos
| Token | Hex | Uso |
|---|---|---|
| `--vsr-bg-base` | `#111928` | Cuerpo del visor (body) |
| `--vsr-bg-chrome` | `#141d2b` | Header, sidebar, footer |
| `--vsr-bg-card` | `#1F2A37` | Cards (frontmatter, TOC, propuestas) |
| `--vsr-bg-input` | `#1F2A37` | Inputs, selects, textareas |
| `--vsr-bg-hover` | `#1a2332` | Hover de items de sidebar / botones |

### Texto
| Token | Hex | Uso |
|---|---|---|
| `--vsr-text` | `#ffffff` | Títulos H1/H2, énfasis máximo |
| `--vsr-text-soft` | `#E5E7EB` | Texto de párrafo |
| `--vsr-text-mid` | `#D1D5DB` | Subtítulos, labels |
| `--vsr-text-muted` | `#9CA3AF` | Hints, meta, captions |
| `--vsr-text-mute2` | `#6B7280` | Placeholders, footer info |

### Bordes y divisores
| Token | Valor | Uso |
|---|---|---|
| `--vsr-border` | `rgba(55,65,81,.6)` | Bordes de cards, separadores |
| `--vsr-border-soft` | `rgba(55,65,81,.4)` | Bordes suaves dentro de cards |
| `--vsr-border-input` | `rgba(55,65,81,.6)` | Bordes de inputs |
| `--vsr-divider` | `rgba(192,90,64,0.22)` | Línea bajo el header (acento terracota) |

### Acentos
| Token | Hex / Valor | Uso |
|---|---|---|
| `--vsr-accent` | `#C05A40` | Botones primarios, focus, links |
| `--vsr-accent-soft` | `#E8A68F` | Hover del acento, iconos secundarios |
| `--vsr-accent-tint` | `rgba(192,90,64,0.18)` | Fondos de chips/badges, focus ring |

### Sombras y scrollbar
| Token | Valor |
|---|---|
| `--vsr-shadow-chrome` | `0 4px 8px rgba(0,0,0,0.3)` |
| `--vsr-scrollbar` | `#374151` |
| `--vsr-scrollbar-hov` | `#4B5563` |

---

## 3) Tema LIGHT (grises neutros + acento terracota)

### Fondos
| Token | Hex | Uso |
|---|---|---|
| `--vsr-bg-base` | `#F3F4F6` | Cuerpo del visor (gris muy claro) |
| `--vsr-bg-chrome` | `#FFFFFF` | Header, sidebar, footer |
| `--vsr-bg-card` | `#FFFFFF` | Cards |
| `--vsr-bg-input` | `#FFFFFF` | Inputs |
| `--vsr-bg-hover` | `#F3F4F6` | Hover (mismo gris del base) |

### Texto
| Token | Hex | Uso |
|---|---|---|
| `--vsr-text` | `#111827` | Títulos, énfasis |
| `--vsr-text-soft` | `#1F2937` | Párrafos |
| `--vsr-text-mid` | `#374151` | Subtítulos |
| `--vsr-text-muted` | `#6B7280` | Meta, captions |
| `--vsr-text-mute2` | `#9CA3AF` | Placeholders |

### Bordes y divisores
| Token | Hex / Valor |
|---|---|
| `--vsr-border` | `#E5E7EB` |
| `--vsr-border-soft` | `#E5E7EB` |
| `--vsr-border-input` | `#E5E7EB` |
| `--vsr-divider` | `rgba(192,90,64,0.22)` |

### Acentos
| Token | Hex / Valor |
|---|---|
| `--vsr-accent` | `#C05A40` |
| `--vsr-accent-soft` | `#A84A33` (terracota más oscuro para mejor contraste) |
| `--vsr-accent-tint` | `rgba(192,90,64,0.10)` |

### Sombras y scrollbar
| Token | Valor |
|---|---|
| `--vsr-shadow-chrome` | `0 1px 4px rgba(17,24,39,0.06)` |
| `--vsr-scrollbar` | `#D1D5DB` |
| `--vsr-scrollbar-hov` | `#9CA3AF` |

---

## 4) Reglas de uso

1. **Nunca hardcodees colores** en CSS de componentes: usa siempre la variable. Si necesitas algo que no existe, agrega un token nuevo en ambos temas.
2. **Acento sobre acento NO**: no apliques `--vsr-accent` sobre `--vsr-accent-tint` (terracota sobre fondo terracota tenue). Usa texto blanco/crema (`--vsr-text`) sobre acento, y `--vsr-accent` solo sobre fondos neutros.
3. **Iconos de archivos** (sidebar): no usan tokens del tema, tienen su propio set semántico (md, png, sql, etc.) definido en `.sidebar-item .file-icon.fmt-*`.
4. **md-rendered (papel sepia)**: el documento renderizado mantiene su look de papel (`#FAF7F2`) en ambos temas — es intencional, simula impresión.

---

## 5) Snippet de uso

```css
.mi-card {
    background: var(--vsr-bg-card);
    color: var(--vsr-text-soft);
    border: 1px solid var(--vsr-border);
    border-radius: 8px;
    padding: 12px;
}

.mi-card .titulo { color: var(--vsr-text); }
.mi-card .meta   { color: var(--vsr-text-muted); font-size: 11px; }

.mi-card button {
    background: var(--vsr-accent);
    color: #fff;
    border: none;
}
.mi-card button:hover { background: var(--vsr-accent-soft); }
```

---

**Archivo fuente de los tokens**: [src/css/visor.css](src/css/visor.css) (líneas 11–67).
