# Componente tabLayout con Lucide Icons

## Descripción
Componente para crear pestañas de navegación con soporte para iconos de Lucide.

## Instalación

### 1. Agregar Lucide Icons al HTML
```html
<!-- Lucide Icons -->
<script src="https://unpkg.com/lucide@latest"></script>
```

### 2. Incluir el componente
```html
<script src="../../src/js/components/tabLayout.js"></script>
```

## Uso Básico

```javascript
tabLayout({
    parent: "container",
    id: "myTabs",
    theme: "dark",
    type: "button",
    json: [
        {
            id: "tab1",
            tab: "Categorías",
            icon: "folder-tree",
            active: true,
            onClick: () => console.log("Tab 1")
        },
        {
            id: "tab2",
            tab: "Áreas",
            icon: "map-pin",
            onClick: () => console.log("Tab 2")
        }
    ]
});
```

## Opciones

| Opción | Tipo | Default | Descripción |
|--------|------|---------|-------------|
| `parent` | string | "root" | ID del contenedor padre |
| `id` | string | "tabLayout" | ID del componente |
| `theme` | string | "light" | Tema: "light" o "dark" |
| `type` | string | "button" | Tipo de tabs |
| `renderContainer` | boolean | true | Renderizar contenedores automáticamente |
| `json` | array | [] | Array de configuración de tabs |

## Configuración de Tabs (json)

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | ID único del tab |
| `tab` | string | Texto del tab |
| `icon` | string | Nombre del icono de Lucide |
| `active` | boolean | Tab activo por defecto |
| `class` | string | Clases CSS adicionales |
| `onClick` | function | Función a ejecutar al hacer clic |

## Iconos Lucide Disponibles

### Navegación y UI
- `folder-tree` - Árbol de carpetas
- `map-pin` - Pin de ubicación
- `map` - Mapa
- `home` - Casa
- `settings` - Configuración
- `menu` - Menú
- `grid-3x3` - Grid

### Almacén y Logística
- `warehouse` - Almacén
- `box` - Caja
- `package` - Paquete
- `truck` - Camión
- `layers` - Capas

### Acciones
- `plus` - Agregar
- `edit` - Editar
- `trash` - Eliminar
- `search` - Buscar
- `filter` - Filtrar

Ver todos los iconos en: https://lucide.dev/icons/

## Temas

### Light Theme
- Fondo blanco
- Texto gris
- Tab activo azul

### Dark Theme
- Fondo oscuro (#1F2A37)
- Texto gris claro
- Tab activo gris oscuro (#374151)

## Ejemplo Completo

```javascript
class App extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "catalogo";
    }

    layout() {
        this.primaryLayout({
            parent: "root",
            id: this.PROJECT_NAME,
            card: {
                container: { id: `container${this.PROJECT_NAME}` }
            }
        });

        tabLayout({
            parent: `container${this.PROJECT_NAME}`,
            id: `tabs${this.PROJECT_NAME}`,
            theme: "dark",
            json: [
                {
                    id: "categorias",
                    tab: "Categorías",
                    icon: "folder-tree",
                    active: true,
                    onClick: () => category.lsCategory()
                },
                {
                    id: "areas",
                    tab: "Áreas",
                    icon: "map-pin",
                    onClick: () => area.lsArea()
                },
                {
                    id: "zonas",
                    tab: "Zonas",
                    icon: "map",
                    onClick: () => zone.lsZone()
                }
            ]
        });
    }
}
```

## Notas

- Los iconos se inicializan automáticamente con `lucide.createIcons()`
- Los contenedores se generan automáticamente con el patrón `container-{id}`
- El primer tab es activo por defecto si no se especifica `active: true`
- Compatible con TailwindCSS
