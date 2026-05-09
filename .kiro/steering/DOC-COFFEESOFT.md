# CoffeeSoft.md

CoffeeSoft es un framework profesional para desarrollo modular de sistemas.
Está diseñado para:

- Usar clases base (**Templates**, **Components**, **Complements**) para extender la funcionalidad.
- Basarse en **Tailwind CSS** para el diseño.
- Orquestar todo el ecosistema a través de **CoffeeSoft.js**, que contiene los bloques fundamentales de trabajo para módulos, formularios, tablas y más.

## ⚙️ Workflow

CoffeeSoft sigue un flujo modular con tres bloques principales:

### 1. Complements

- **Clase base:** `Complements`
- Contienen funciones de utilidad generales.
- No generan interfaz, pero soportan componentes visuales.

### 2. Components

- **Clase:** `Components` (hereda de `Complements`).
- Representan elementos funcionales y visuales.
- Son **reutilizables y configurables** mediante `options`.

**Características clave:**

- Métodos de clase.
- Se invocan como `this.nombreComponente(opts)`.
- Usan **JQuery + TailwindCSS**.
- Su estructura parte de `NEW-COMPONENT.md`.

### 3. Templates

- **Clase:** `Templates` (padre de `App`, visto en `FRONT-JS.md`).
- Definen la **estructura general del sistema o módulo**.
- Toda clase `App` debe heredar de `Templates`.

---

# 📦 Components

## swalQuestion

**Nombre :** `swalQuestion(options = {})`
**Propósito :** Muestra un diálogo de confirmación con **SweetAlert** usando estilo corporativo CoffeeSoft.
Permite ejecutar peticiones AJAX y callbacks.

**Ejemplo:**

```javascript
this.swalQuestion({
  opts: {
    title: "¿Estás segura, Rosita? 🌹",
    text: "Se eliminará este registro.",
    icon: "warning",
  },
  data: { opc: "delete", id: 12 },
  methods: {
    success: (res) => {
      console.log("Se eliminó correctamente");
    },
  },
});
```

---

## createForm

**Nombre :** `createForm(options)`
**Propósito :** Genera un formulario dinámico a partir de un JSON.
Incluye autofill, validaciones, envío con `fn_ajax` y callbacks.

**Ejemplo:**

```javascript
this.createForm({
  parent: "contenedorForm",
  id: "formProducto",
  class: "grid grid-cols-2 gap-4",
  json: this.json(),
  data: { opc: "productos" },
  autofill: req.data,
  methods: {
    send: (data) => toast("Formulario guardado correctamente ✅"),
  },
});
```

---

## createModalForm

**Nombre :** `createModalForm(options)`
**Propósito :** Crea un modal con formulario dinámico (usando `bootbox.dialog`).
Soporta **autofill**, validaciones, valores dinámicos y envío con `useFetch`.

**Ejemplo:**

```javascript
this.createModalForm({
  id: "frmAddClient",
  bootbox: { title: "Agregar Cliente", closeButton: true },
  json: this.json(),
  data: { opc: "addCliente" },
  autofill: req.data,
  beforeSend: () => {},
  success: (data) => toast("Cliente agregado con éxito ✅"),
});
```

---

## createCoffeTable

**Nombre :** `createCoffeTable(options)`
**Propósito :**
Renderiza una tabla HTML completa con estilos preconfigurados para entornos Coffee Soft, soportando diferentes temas (light, dark, corporativo, shadcdn), agrupaciones de datos, filas alternas (striped), acciones (botones o menús dropdown), y personalización avanzada por columna.

Permite centrar y alinear columnas, modificar los estilos de filas, e incluso inyectar HTML avanzado por celda.

Ejemplo de uso básico:

```javascript
this.createCoffeTable({
  parent: "tablaUsuarios",
  id: "tablaUsr",
  title: "📋 Lista de Usuarios",
  subtitle: "Usuarios activos por sucursal",
  theme: "corporativo",
  f_size: 14,
  center: [0, 3, 4],
  data: {
    thead: ["#", "Nombre", "Rol", "Sucursal", "Estado"],
    row: [
      {
        id: 1,
        "#": "1",
        Nombre: "Rosi",
        Rol: "Admin",
        Sucursal: "Tuxtla",
        Estado: "Activo",
      },
      {
        id: 2,
        "#": "2",
        Nombre: "Somx",
        Rol: "Dev",
        Sucursal: "Comitán",
        Estado: "Activo",
      },
    ],
  },
});
```

---

## createTable

**Nombre :** `createTable(options)`
**Propósito:**
Este método permite crear tablas dinámicas a partir de datos obtenidos vía AJAX. Puede integrarse con un FilterBar (filtros de búsqueda).
Soporta configuración de DataTables, y puede renderizar tablas bajo el estándar CoffeeSoft (createCoffeTable) o mediante el plugin rpt_json_table2.

**Ejemplo de uso básico:**

```javascript
this.createTable({
  parent: "tableContainer",
  idFilterBar: "filterBar",
  coffeesoft: true,
  conf: {
    datatable: true,
    fn_datatable: "custom_data_table",
    pag: 20,
  },
  data: { extraParam: "value" },

  success: (data) => {
    console.log("Tabla renderizada con éxito");
  },
  attr: {
    class: "table-auto w-full",
  },
});
```

---

## createfilterBar

**Nombre :** `createfilterBar(options)`
**Propósito :**
Genera una barra de filtros (inputs, calendarios, selects, botones, etc.) con estructura dinámica definida por JSON. El contenido se inyecta dentro de un contenedor HTML especificado mediante el plugin content_json_form.

**Ejemplo:**

```javascript
this.createfilterBar({
  parent: "filterBar",
  id: "barraFiltrosVentas",
  json: [
    {
      opc: "input-calendar",
      id: "fecha_inicio",
      lbl: "Desde",
      class: "col-sm-3",
    },
    { opc: "btn", id: "btn", class: "col-sm-3" },
  ],
});
```

---

## tabLayout

**Nombre :** `tabLayout(options)`

**Propósito :**
Renderiza una barra de pestañas navegables con contenido asociado. Cada tab puede tener un onClick personalizado, tema visual (dark, light) y tamaño (short, large). Es compatible con contenedores dinámicos (renderContainer) y estilos personalizados.

**Ejemplo:**

```javascript

this.tabLayout({
    parent: "seccionDashboard",
    id: "tabsDashboard",
    theme: "light",
    type: "short",
    renderContainer: true,
    content: {
        class: "bg-white shadow rounded-md"
    },
    json: [
        {
            id: "ventas",
            tab: "Ventas",
            icon: "icon-chart-bar",
            active: true,
            content: "<p>Contenido de ventas</p>",
            onClick: () => console.log("Tab Ventas activado")
        },
        {
            id: "costsys",
            tab: "CostSys",
            icon: "icon-puzzle",
            content: "<p>Contenido de CostSys</p>",
            onClick: () => cargarCostSys()
        },
        {
            id: "redes",
            tab: "Redes Sociales",
            icon: "icon-globe",
            content: "<p>Contenido de redes</p>"
        }
    ]
});

**importante** para usar el container de un tab la convencion es container-[nombre_tab]

```

---

## navBar

**Nombre :** `navBar(options)`
**Propósito :**

- Genera una barra de navegación superior fija y responsiva, con: Logo adaptable (completo/mini).
- Menú de usuario con acciones personalizadas (perfil y cerrar sesión).
- Lanzador de módulos ERP (tipo grid launcher).
- Soporte para temas (light o dark).
- Control personalizado o automático del sidebar.

**Ejemplo:**

```javascript
this.navBar({
  theme: "dark",
  user: {
    name: "User",
    photo: "../fotoUser26.png",
    onProfile: () => redireccion("perfil/perfil.php"),
    onLogout: () => cerrar_sesion(),
  },
  onToggle: () => $("#sidebar").toggleClass("activo"),
  apps: [
    { icon: "icon-calendar", name: "Agenda", color: "text-pink-500" },
    { icon: "icon-dollar", name: "Ventas", color: "text-green-500" },
    { icon: "icon-cog", name: "Configuración", color: "text-blue-500" },
  ],
});
```

---

## sideBar

**Nombre :** `sideBar(options)`
**Propósito :**
Genera un menú lateral fijo (sidebar) con grupos de navegación y acciones por ítem. Puede integrarse al layout general (#root) y controlarse con un botón externo (#btnSidebar). Soporta temas claros u oscuros y estilos con Tailwind CSS.

**Ejemplo:**

```javascript
this.sideBar({
  theme: "dark",
  groups: [
    {
      name: "Administración",
      icon: "icon-cog",
      items: [
        {
          name: "Usuarios",
          icon: "icon-user",
          onClick: () => this.loadUsuarios(),
        },
        { name: "Roles", icon: "icon-key", onClick: () => this.loadRoles() },
      ],
    },
    {
      name: "Ventas",
      icon: "icon-cart",
      items: [
        {
          name: "Pedidos",
          icon: "icon-file-text",
          onClick: () => this.loadPedidos(),
        },
        {
          name: "Clientes",
          icon: "icon-users",
          onClick: () => this.loadClientes(),
        },
      ],
    },
  ],
});
```

##

# 🏗️ Templates
