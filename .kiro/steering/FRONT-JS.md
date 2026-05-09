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

- Todos los componentes de coffeeSoft incluyen el parametro parent
debe llevar la siguiente nomenclatura
````   parent: `[nombreComponente]${this.PROJECT_NAME}`, ```


## Rules
- Se pueden usar pivotes para referencia o templates
- No agreges comentarios a las funciones
- Los nombres de las funciones deben:
  - Estar en inglés.
  - Usar notación `camelCase`.


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


**Consideraciones Finales**
- Usa los pivotes , templates para generar las funciones

