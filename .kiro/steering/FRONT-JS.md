## Objetivo General
Desarrollar un archivo JavaScript estructurado y modular, siguiendo estrictamente las convenciones del sistema y buenas prácticas de ingeniería.


### 1.Estructura Base del FRONT-JS
Debe respetarse el formato de CoffeeSoft
- Nombre del archivo bajo la convención:
  `[nombre].js`

- Construir una clase `App` que herede de `Templates`.
 ```JS
    let api = '';
    let app;
    $(function () {
        const app = new App(api,'root');
        app.init();
    }
    class App extends Template{}
  ```
- El constructor debe recibir dos parámetros: el enlace del controlador (`link`) y el identificador de contenedor principal (`div_modulo`).
- El constructor debe de tener la variable PROJECT_NAME
``` this.PROJECT_NAME = "projectName";``

- Si dos modulos , el segundo debe heredar la clase App
- Solo genera un submodulo si se necesita
- Si se genera un submodulo, debe crear una class aparte no juntar todo en la misma.



```JS
    class SubModulo extends App{}
```

> **Excepción — herencia de `App`:** El submódulo hereda de `App` **solo cuando hay estructura/estado compartido que reutilizar** (layout común, helpers, props de instancia). Si `App` es un mero orquestador (solo `layout()` + `renderTabs()` + `renderActiveTab()`) y no aporta nada reutilizable, el submódulo **puede extender `Templates` directamente**. No fuerces `extends App` para heredar la nada. Típico del patrón "catálogo admin multi-entidad" (ver final del documento).

- Todos los componentes de coffeeSoft incluyen el parametro parent
debe llevar la siguiente nomenclatura
````   parent: `[nombreComponente]${this.PROJECT_NAME}`, ```


## Rules
- Se pueden usar pivotes para referencia o templates
- No agreges comentarios a las funciones
- Los nombres de las funciones deben:
  - Estar en inglés.
  - Usar notación `camelCase`.

### Comentarios y separadores de seccion

**REGLA:** Los nombres `camelCase` ya documentan la intencion del metodo. NO agregar doc-lines descriptivas encima de cada metodo. Solo se permiten **separadores de seccion** para agrupar metodos por responsabilidad.

**Formato canonico del separador:**

```js
// -- Nombre de seccion --
```

**Secciones tipicas en una clase `App extends Templates`:**

```js
class App extends Templates {

    // -- Bootstrap --
    constructor(link, divModule) { ... }
    async init() { ... }
    render() { ... }

    // -- Layout --
    layout() { ... }

    // -- Filter bar --
    filterBar() { ... }
    getFilters() { ... }

    // -- Data --
    lsVentas() { ... }
    getVenta(id) { ... }

    // -- Render helpers --
    renderHeader(data) { ... }

    // -- Event handlers --
    onChangeFilters() { ... }
    cancelVenta(id) { ... }

    // -- Components --
    kpisRow(options) { ... }
}
```

✅ **CORRECTO:**
```js
// -- Filter bar --
filterBar() { ... }
getFilters() { ... }
```

❌ **INCORRECTO** (doc-line por metodo):
```js
// Renderiza la barra de filtros del modulo.
filterBar() { ... }
```

❌ **INCORRECTO** (banners decorativos largos):
```js
// ── Filter bar ────────────────────────────────────────────────────────
```

**Cuando SI se admite comentario inline corto:**
- Workaround puntual no obvio del codigo
- Constante magica que requiere contexto
- Nunca para describir lo que el nombre del metodo ya dice.
- **NO usar prefijo `_`** (guion bajo) en métodos ni propiedades de instancia de clases JS. Aunque sea convención común de JS para "uso interno", el framework CoffeeSoft no la aplica. Todos los identificadores van con nombre normal (`this.uid`, `this.parent`, `buildCards()`, `renderHeader()`), igual que en `Templates`, `Cards`, `Navbar`, `App`.

  ✅ **CORRECTO:**
  ```js
  class Ventas extends Templates {
      constructor(link, divModule) {
          super(link, divModule);
          this.PROJECT_NAME = 'Ventas';
      }
      render(data) {
          const cards = this.buildCards(data);
          new ModuleCard('#mainContainer', { cards }).init();
      }
      buildCards(data) { ... }
  }
  ```

  ❌ **INCORRECTO:**
  ```js
  class Ventas extends Templates {
      render(data) {
          const cards = this._buildCards(data);
          new ModuleCard('#mainContainer', { cards }).init();
      }
      _buildCards(data) { ... }
  }
  ```

  > **Aplica a:** métodos públicos, helpers internos y propiedades de instancia. Para señalar "no es API documentada", usar comentario inline corto o agrupar bajo separador `// -- Public API --`, pero el nombre va sin `_`.


## La clase debe implementar los siguientes métodos:

- init()
  - Ejecuta el método render().
- render()
  - Ejecuta los métodos layout() y filterBar().
- layout()
  - Se usa para crear la interfaz visual del sistema, se puede usar como referencia primaryLayout de CoffeeSoft
  ```JS
    layout() {
        this.primaryLayout({
            parent: `root`,
            class: 'flex p-2',
            id: this.PROJECT_NAME,
        });
    }
  ```
- filterBar()
  - Implementa el filtro principal utilizando createfilterBar() y configura el componente dataPicker() para capturar rangos de fechas.
```JS
     createFilterBar() {
        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            data: [
                {
                    opc: "input-calendar",
                    class: "col-sm-4",
                    id: "calendar"+this.PROJECT_NAME,
                    lbl: "Consultar fecha: ",
                },
                {
                    opc: "btn",
                    class: "col-sm-2",
                    color_btn: "primary",
                    id: "btn",
                    text: "Buscar",
                    fn: `${this.PROJECT_NAME.toLowerCase()}.ls()`,
                },
            ],
        });

        dataPicker({
            parent: "calendar"+this.PROJECT_NAME,
            onSelect: () => this.ls(),
        });
    }

```

- ls()
  - Carga datos de la tabla utilizando createTable(), incluyendo paginación y configuración responsiva.
```javascript
  ls() {

        let rangePicker = getDataRangePicker("calendar");

        this.createTable({

            parent     : `container${this.PROJECT_NAME}`,
            idFilterBar: `filterBar${this.PROJECT_NAME}`,// importante siempre incluirla
            data: { opc: "list", fi: rangePicker.fi, ff: rangePicker.ff },
            conf       : { datatable: true, pag: 10 },
            coffeesoft : true,

            attr: {
                id      : `tb${this.PROJECT_NAME}`,
                theme   : 'shadcdn',
                title   : 'Lista de registros',
                subtitle: '',
                center  : [1, 2,  7, 8,9,10,11],
                right   : [4,5,6],
                extends : true,
            },
        });
    }


```

- add[Entidad]()
  - Despliega un formulario modal mediante createModalForm() para agregar nuevos registros
  ```javascript
      add[Entidad]() {
        this.createForm({
            parent: "addForm",
            id: "formEntidad",
            data: { opc: "add" },
            json: this.json[Entidad](),

            success: (response) => {
                if (response.status == 200) {

                alert({
                      icon: "success",
                      title: "Pedido creado con éxito",
                      text: response.message,
                      btn1: true,
                      btn1Text: "Aceptar"
                  });

              } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok"
                    });
                }
            }
        });

        // extras.
        $("#lblCliente").addClass("border-b p-1");
      }
  ```


- edit(id)
  - usa async en las funciones
  - Realiza una consulta asincrónica useFetch({ opc: 'get', id: id }).
  - Posteriormente despliega un formulario modal de edición, usando autofill para precargar los datos obtenidos.
  - El formulario, al ser enviado, debe ejecutar el flujo opc: 'edit'.

    ```javascript
      async edit[Entidad](id) {
            
        const request = await useFetch({ url: this._link, data: { opc: "get", id } });
        this.createForm({
            parent: "formEditPedido",
            id: "formPedido",
            data: { opc: "edit", id },
            autofill: order,
            json: this.json(),
            success: (response) => {

              if (response.status == 200) {
                    alert({
                        icon: "success",
                        title: "Pedido actualizado",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Aceptar"
                    });
              } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok"
                    });
                }
            }
        });

      }
  ```
-json[Entidad]
  - Genera un objeto JSON con los datos del formulario, y los devuelve.
  - El objeto JSON debe tener el siguiente formato:
  ```javascript
   jsonOrder() {
        return [
            {
                opc: "label",
                id: "lblCliente",
                text: "Información del cliente",
                class: "col-12 fw-bold text-lg mb-2  p-1"
            },
            {
                opc: "input",
                lbl: "Nombre del cliente",
                id: "name",
                tipo: "texto",
                class: "col-12 col-sm-6 col-lg-4 mb-3"
            },
            {
                opc: "input",
                lbl: "Teléfono",
                id: "phone",
                tipo: "tel",
                class: "col-12 col-sm-6 col-lg-4 mb-3"
            },
            {
                opc: "input",
                lbl: "Correo electrónico",
                id: "email",
                tipo: "email",
                class: "col-12 col-sm-6 col-lg-4 mb-3",
                required: false
            },

            {
                opc: "input",
                lbl: "Fecha de cumpleaños",
                id: "date_birthday",
                type: "date",
                class: "col-12 col-sm-6 col-lg-4 mb-3"
            },

            {
                opc: "label",
                id: "lblPedido",
                text: "Datos del pedido",
                class: "col-12 fw-bold text-lg  mb-2 p-1"
            },


            {
                opc: "input",
                lbl: "Fecha de entrega",
                id: "date_order",
                type: "date",
                class: "col-12 col-lg-3 mb-3"
            },

            {
                opc: "input",
                lbl: "Hora de entrega",
                id: "time_order",
                type: "time",
                class: "col-12  col-lg-3 mb-3"
            },



            {
                opc: "textarea",
                id: "note",
                lbl: "Notas adicionales",
                rows: 3,
                class: "col-12 mb-3"
            },



            {
                opc: "btn-submit",
                id: "btnGuardarPedido",
                text: "Guardar Pedido",
                class: "col-12  offset-md-8 offset-lg-6 col-md-2 col-lg-3 "
            },
            {
                opc: "button",
                id: "btnRegresar",
                text: "Salir",
                class: "col-12 col-lg-3 col-md-2 ",
                className: 'w-full',
                icono: "fas fa-arrow-left",
                color_btn: "danger",
                onClick: () => order.init()
            },
        ];

    }
  ```

- cancel(id)
  - Utiliza swalQuestion() para confirmar la cancelación de un registro, y luego envía la acción opc: 'cancel'.

  ``` javascript
    cancelOrder(id) {
        const row = event.target.closest('tr');
        const folio = row.querySelectorAll('td')[0]?.innerText || '';

        this.swalQuestion({
            opts: {
                title: `¿Esta seguro?`,
                html: `¿Deseas cancelar la reservación con folio <strong>${folio}</strong>?
                Esta acción actualizará el estado a "Cancelado" en la tabla [reservaciones].`,
            },
            data: { opc: "cancelOrder", status: 4, id: id },
            methods: {
                request: (data) => {
                    alert({
                        icon: "success",
                        title: "Cancelado",
                        text: "El pedido fue cancelado exitosamente.",
                        btn1: true
                    });

                    this.ls();
                },
            },
        });
    }
  ```

- delete[Entidad](id)
  - Utiliza swalQuestion() para confirmar la eliminación permanente de un registro.
  - **IMPORTANTE:** Incluir advertencia visual de que la acción es irreversible.

  ``` javascript
    deleteOrder(id) {
        const row = event.target.closest('tr');
        const folio = row.querySelectorAll('td')[0]?.innerText || '';

        this.swalQuestion({
            opts: {
                title: `¿Eliminar pedido?`,
                html: `¿Estás seguro de eliminar el pedido con folio <strong>${folio}</strong>?
                <br><br>
                <span class="text-red-500">⚠️ Esta acción es permanente y no se puede deshacer.</span>`,
                icon: "warning",
            },
            data: { opc: "deleteOrder", id: id },
            methods: {
                request: (data) => {
                    alert({
                        icon: "success",
                        title: "Eliminado",
                        text: "El pedido fue eliminado correctamente.",
                        btn1: true
                    });
                    this.ls();
                },
            },
        });
    }
  ```


## Render perezoso de tabs — `renderActiveTab()`

En módulos con tabs, `renderActiveTab()` pinta **únicamente el tab activo** en el arranque. **NUNCA** llamar a todos los submódulos de golpe (`productos.render(); categorias.render(); almacenes.render(); ...`), porque cada `render()` dispara su propio `createTable`/`useFetch` y se hacen N peticiones innecesarias al cargar. El resto se renderiza **bajo demanda** desde el `onClick` de su tab conforme el usuario navega.

```js
render() {
    this.layout();
    this.renderTabs();
    this.renderActiveTab();   // solo el tab activo
}

renderTabs() {
    this.tabLayout({
        parent: `tabs${this.PROJECT_NAME}`,
        id: `tabs${this.PROJECT_NAME}`,
        json: [
            { id: "productos",  tab: "Productos",  lucideIcon: "package", active: true, onClick: () => productos.render() },
            { id: "categorias", tab: "Categorias", lucideIcon: "tag",                   onClick: () => categorias.render() }
        ]
    });
}

renderActiveTab() {
    productos.render();   // arranque: solo el activo; los demás al hacer click
}
```

## Patrón "Catálogo admin multi-entidad"

Cuando un módulo administra varias entidades CRUD homogéneas bajo una misma pantalla (p.ej. admin de inventario: productos, categorías, almacenes, áreas, unidades, proveedores, motivos, estados…):

- Una clase `App extends Templates` que **solo orquesta**: `layout()` (con `createLayout`, sin filterBar principal), `renderTabs()` (`tabLayout` con un tab por entidad, cada uno con `lucideIcon` distinto) y `renderActiveTab()`.
- Una clase CRUD por entidad. Como `App` solo orquesta, estas clases **extienden `Templates` directamente** (ver excepción de herencia arriba).
- Cada clase CRUD comparte el mismo esqueleto: `render() → filterBar() + ls()`, más `add()`, `edit(id)`, `status(id, active)`, `json()`.
- Variable global por entidad en minúsculas == `PROJECT_NAME` (`productos`, `categorias`, …).
- IDs de parents derivados de `PROJECT_NAME`: `` `filterBar${PROJECT_NAME}` ``, `` `container${PROJECT_NAME}` ``, `` `tb${PROJECT_NAME}` ``.
- Render perezoso: solo el tab activo en el arranque; el resto bajo demanda.

### Helpers globales compartidos (anti-duplicación)

En un módulo con N entidades CRUD, **NO** repetir el bloque éxito/error ni la lista de estados en cada clase. Declarar helpers globales al final del archivo (sección `// -- Helpers --`) y reutilizarlos en todas:

```js
// -- Helpers --

function statusFilter() {
    return [
        { id: "1", valor: "Activos" },
        { id: "0", valor: "Inactivos" },
        { id: "",  valor: "Todos" }
    ];
}

function afterSave(response, reload) {
    if (response.status == 200) {
        alert({ icon: "success", text: response.message });
        if (typeof reload === "function") reload();
    } else {
        alert({ icon: "info", title: "Oops!...", text: response.message, btn1: true, btn1Text: "Ok" });
    }
}
```

Uso en cada clase CRUD:
```js
success: (response) => afterSave(response, () => this.ls())
```

> **Regla:** `afterSave(response, reload)` y `statusFilter()` son el estándar para catálogos multi-entidad. NO definir variantes por clase (`statusOptions()`, `afterSave()` propio) que dupliquen la misma lógica. Una sola fuente de verdad en `// -- Helpers --`.

**Consideraciones Finales**
- Usa los pivotes , templates para generar las funciones

