# CoffeeSoft Framework - Documentación Completa

## Descripción General
CoffeeSoft es un framework JavaScript basado en jQuery que proporciona componentes reutilizables, utilidades y patrones para el desarrollo de aplicaciones web empresariales.

## Arquitectura de Clases

### Jerarquía de Herencia
```
Complements
    └── Components
            └── Templates
```

---

## Clase: Complements

Clase base que proporciona utilidades fundamentales.

### Constructor
```javascript
constructor(link, div_modulo) {
    this._link = link;
    this._div_modulo = div_modulo;
}
```

### Métodos Principales

#### `ObjectMerge(target, source)`
Combina dos objetos recursivamente.
```javascript
this.ObjectMerge(defaults, options);
```

#### `closedModal(data)`
Cierra un modal de bootbox si la operación fue exitosa.

#### `dropdown(options)`
Genera un menú dropdown HTML.
```javascript
dropdown([
    { icon: "icon-pencil", text: "Editar", onClick: "edit()" },
    { icon: "icon-trash", text: "Eliminar", onClick: "delete()" }
])
```

#### `useFetch(options)`
Realiza peticiones AJAX usando Fetch API.
```javascript
this.useFetch({
    url: api,
    data: { opc: 'ls' },
    success: (data) => console.log(data)
});
```

---

## Clase: Components

Extiende `Complements` y proporciona componentes visuales reutilizables.

### Componentes de Visualización

#### `detailCard(options)`
Muestra información en formato de tarjeta con campos clave-valor.
```javascript
this.detailCard({
    parent: "container",
    title: "Detalles",
    class: "cols-2",
    data: [
        { text: "Nombre", value: "Juan", icon: "icon-user" },
        { type: "status", text: "Estado", value: "Activo", color: "bg-green-500" },
        { type: "observacion", text: "Notas", value: "Comentarios..." }
    ]
});
```

#### `createItemCard(options)`
Crea tarjetas de navegación tipo grid.
```javascript
this.createItemCard({
    parent: 'cardGrid',
    title: 'Módulos',
    json: [
        {
            titulo: "Ventas",
            descripcion: "Gestión de ventas",
            imagen: "/img/ventas.svg",
            enlace: "/ventas/",
            onClick: () => {}
        }
    ]
});
```

### Componentes de Formularios

#### `createForm(options)`
Genera formularios dinámicos con validación automática.
```javascript
this.createForm({
    parent: 'formContainer',
    id: 'myForm',
    data: { opc: 'add' },
    autofill: { name: "Juan", email: "juan@mail.com" },
    json: [
        { opc: "input", id: "name", lbl: "Nombre", class: "col-12" },
        { opc: "select", id: "category", lbl: "Categoría", data: categories },
        { opc: "btn-submit", text: "Guardar", class: "col-12" }
    ],
    success: (response) => {
        if (response.status === 200) {
            alert({ icon: "success", text: response.message });
        }
    }
});
```

#### `createModalForm(options)`
Crea un formulario dentro de un modal de bootbox.
```javascript
this.createModalForm({
    id: 'formModal',
    bootbox: {
        title: 'Agregar Registro',
        closeButton: true
    },
    data: { opc: 'add' },
    autofill: false,
    json: [
        { opc: "input", id: "name", lbl: "Nombre", class: "col-12" },
        { opc: "textarea", id: "description", lbl: "Descripción", class: "col-12" }
    ],
    success: (response) => {
        console.log(response);
    }
});
```

#### `form(options)`
Genera formularios sin contenedor automático.
```javascript
this.form({
    parent: "container",
    id: "myForm",
    class: "row",
    json: [
        { opc: "input", id: "name", lbl: "Nombre", class: "col-6" },
        { opc: "select", id: "type", lbl: "Tipo", data: types, class: "col-6" }
    ]
});
```

### Componentes de Tablas

#### `createTable(options)`
Genera tablas dinámicas con datos del backend.
```javascript
this.createTable({
    parent: 'tableContainer',
    idFilterBar: 'filterBar',
    data: { opc: 'ls', fi: '2024-01-01', ff: '2024-12-31' },
    coffeesoft: true,
    conf: { datatable: true, pag: 15 },
    attr: {
        id: 'tbProducts',
        theme: 'corporativo',
        title: 'Lista de Productos',
        subtitle: 'Productos registrados',
        center: [1, 2],
        right: [4]
    },
    success: (data) => console.log(data)
});
```

#### `createCoffeTable(options)`
Tabla estilizada con TailwindCSS.
```javascript
this.createCoffeTable({
    parent: "container",
    id: "myTable",
    theme: 'dark', // 'light' | 'dark' | 'corporativo' | 'shadcdn'
    title: "Lista de Registros",
    subtitle: "Registros del sistema",
    data: {
        thead: ["ID", "Nombre", "Estado", "Acciones"],
        row: [
            {
                id: 1,
                Nombre: "Juan",
                Estado: "Activo",
                dropdown: [
                    { icon: "icon-pencil", text: "Editar", onclick: "edit(1)" },
                    { icon: "icon-trash", text: "Eliminar", onclick: "delete(1)" }
                ]
            }
        ]
    },
    center: [0, 2],
    right: [3]
});
```

### Componentes de Navegación

#### `tabLayout(options)`
Crea pestañas de navegación.
```javascript
this.tabLayout({
    parent: "container",
    id: "myTabs",
    type: "short", // 'short' | 'large'
    theme: "light", // 'light' | 'dark'
    renderContainer: true,
    json: [
        {
            id: "tab1",
            tab: "Dashboard",
            icon: "icon-home",
            active: true,
            onClick: () => console.log("Tab 1")
        },
        {
            id: "tab2",
            tab: "Reportes",
            icon: "icon-chart",
            onClick: () => console.log("Tab 2")
        }
    ]
});
```

#### `navBar(options)`
Barra de navegación superior.
```javascript
this.navBar({
    theme: "dark", // 'light' | 'dark'
    logoFull: "/img/logo.png",
    logoMini: "/img/icon.png",
    user: {
        name: "Usuario",
        photo: "/img/user.png",
        onProfile: () => redireccion('perfil/'),
        onLogout: () => cerrar_sesion()
    },
    apps: [
        { icon: "icon-cart", name: "Ventas", color: "text-green-600" }
    ]
});
```

#### `sideBar(options)`
Menú lateral colapsable.
```javascript
this.sideBar({
    parent: "body",
    id: "sidebar",
    theme: "light",
    groups: [
        {
            name: "Administración",
            icon: "icon-cog",
            items: [
                { name: "Usuarios", icon: "icon-user", onClick: () => {} }
            ]
        }
    ]
});
```

### Componentes de Interacción

#### `swalQuestion(options)`
Muestra un diálogo de confirmación con SweetAlert2.
```javascript
this.swalQuestion({
    opts: {
        title: "¿Confirmar acción?",
        text: "Esta acción no se puede deshacer",
        icon: "warning"
    },
    data: { opc: "delete", id: 123 },
    methods: {
        send: (response) => {
            if (response.status === 200) {
                alert({ icon: "success", text: "Eliminado" });
            }
        }
    }
});
```

#### `createfilterBar(options)`
Barra de filtros para búsquedas.
```javascript
this.createfilterBar({
    parent: 'filterBar',
    data: [
        {
            opc: "select",
            id: "category",
            lbl: "Categoría",
            class: "col-3",
            data: categories,
            onchange: "app.search()"
        },
        {
            opc: "input-calendar",
            id: "dateRange",
            lbl: "Fecha",
            class: "col-4"
        },
        {
            opc: "btn",
            text: "Buscar",
            fn: "app.search()",
            class: "col-2"
        }
    ]
});
```

### Componentes Especializados

#### `createTableForm(options)`
Tabla con formulario lateral integrado.
```javascript
this.createTableForm({
    parent: 'container',
    id: 'tableForm',
    title: 'Gestión de Productos',
    table: {
        data: { opc: "ls" },
        conf: { datatable: true, pag: 10 }
    },
    form: {
        json: [
            { opc: "input", id: "name", lbl: "Nombre", class: "col-12" }
        ],
        success: (data) => console.log(data)
    }
});
```

---

## Clase: Templates

Extiende `Components` y proporciona layouts predefinidos.

### Layouts Disponibles

#### `primaryLayout(options)`
Layout principal con filterBar y container.
```javascript
this.primaryLayout({
    parent: 'root',
    id: 'mainLayout',
    class: 'flex p-2',
    card: {
        filterBar: { class: 'w-full mb-3', id: 'filterBar' },
        container: { class: 'w-full h-full', id: 'container' }
    }
});
```

#### `splitLayout(options)`
Layout dividido en dos columnas.
```javascript
this.splitLayout({
    parent: 'root',
    id: 'split',
    container: {
        children: [
            { class: 'w-1/2', id: 'left' },
            { class: 'w-1/2', id: 'right' }
        ]
    }
});
```

#### `verticalLinearLayout(options)`
Layout vertical con filterBar, container y footer.
```javascript
this.verticalLinearLayout({
    parent: 'root',
    id: 'vertical',
    card: {
        filterBar: { className: 'w-full', id: 'filterBar' },
        container: { className: 'w-full', id: 'container' },
        footer: { className: 'w-full', id: 'footer' }
    }
});
```

#### `secondaryLayout(options)`
Layout con tabla y formulario lateral.
```javascript
this.secondaryLayout({
    parent: 'root',
    id: 'secondary',
    cardtable: {
        className: 'col-7',
        filterBar: { id: 'filterTable' },
        container: { id: 'listTable' }
    },
    cardform: {
        className: 'col-5',
        id: 'containerForm'
    }
});
```

---

## Funciones Auxiliares Globales

### `useFetch(options)`
Función global para peticiones AJAX.
```javascript
const data = await useFetch({
    url: 'ctrl/ctrl-products.php',
    data: { opc: 'ls' },
    success: (response) => console.log(response)
});
```

### `formDataToJson(formData)`
Convierte FormData a objeto JSON.
```javascript
const jsonData = formDataToJson(formData);
```

---

## Tipos de Input Soportados

### Formularios JSON
```javascript
json: [
    { opc: "input", tipo: "texto" },
    { opc: "input", tipo: "numero" },
    { opc: "input", tipo: "cifra" },
    { opc: "input", tipo: "email" },
    { opc: "input", type: "date" },
    { opc: "input", type: "time" },
    { opc: "textarea" },
    { opc: "select", data: [] },
    { opc: "radio" },
    { opc: "checkbox" },
    { opc: "input-calendar" },
    { opc: "input-file" },
    { opc: "btn" },
    { opc: "btn-submit" },
    { opc: "button" },
    { opc: "dropdown" },
    { opc: "label" }
]
```

---

## Temas Disponibles

### Tablas
- `light` - Fondo blanco, texto oscuro
- `dark` - Fondo oscuro (#1F2A37), texto blanco
- `corporativo` - Azul corporativo (#003360)
- `shadcdn` - Estilo moderno (#111827)

### Navegación
- `light` - Fondo claro
- `dark` - Estilo Huubie (#1F2A37)

---

## Notas Importantes

1. **Herencia**: Siempre extender de `Templates` para acceder a todos los componentes
2. **Constructor**: Pasar `link` (API) y `div_modulo` (contenedor raíz)
3. **Validación**: Los formularios validan automáticamente campos con `required`
4. **Responsive**: Todos los componentes usan TailwindCSS y son responsive
5. **Eventos**: Usar `onClick`, `onchange`, `fn` según el componente
6. **Async**: Usar `async/await` con `useFetch()` para peticiones

---

## Ejemplo Completo

```javascript
class App extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "products";
    }

    render() {
        this.layout();
        this.filterBar();
        this.ls();
    }

    layout() {
        this.primaryLayout({
            parent: 'root',
            id: this.PROJECT_NAME,
            card: {
                filterBar: { id: 'filterBar' },
                container: { id: 'container' }
            }
        });
    }

    filterBar() {
        this.createfilterBar({
            parent: 'filterBar',
            data: [
                {
                    opc: "select",
                    id: "category",
                    lbl: "Categoría",
                    data: categories,
                    onchange: "app.ls()"
                }
            ]
        });
    }

    ls() {
        this.createTable({
            parent: 'container',
            idFilterBar: 'filterBar',
            data: { opc: 'ls' },
            coffeesoft: true,
            conf: { datatable: true, pag: 15 },
            attr: {
                id: 'tbProducts',
                theme: 'corporativo'
            }
        });
    }
}
```

---

## Integración con Proyectos

### Archivos Obligatorios
```html
<!-- En index.php -->
<script src="src/js/coffeSoft.js"></script>
<script src="src/js/plugins.js"></script>
```

### Estructura de Proyecto
```
proyecto/
├── index.php
├── ctrl/
│   └── ctrl-proyecto.php
├── mdl/
│   └── mdl-proyecto.php
├── js/
│   └── proyecto.js
└── src/
   
```

### Inicialización
```javascript
let api = 'ctrl/ctrl-proyecto.php';
let app;

$(async () => {
    app = new App(api, "root");
    app.render();
});

class App extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "proyecto";
    }
}
```