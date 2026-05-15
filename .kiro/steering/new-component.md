# Prompt para construir un componente jQuery con Tailwind

**Compilar información**

- Se activa con la frase para iniciar una conversación 'new-component', 'new-component' , 'nuevo componente'.
- Al pegar un fragmento de codigo , se inicia el proceso de nuevo componente.
- Reúne toda la documentación, diagramas, fotos o descripciones del componente.
- Abre en formato markdown para mostrar el desarrollo del componente.
- No me des mucha informacion sobre lo que haras

## 1. Contexto claro:

Quiero que generes un **componente jQuery personalizado** cuyo propósito sea crear interfaces reutilizables con lógica desacoplada. El componente debe estar basado en un patrón configurable por `options`, tener un contenedor root definido por un `id`, y usar exclusivamente **TailwindCSS** para estilos.

## 2. Reglas o condiciones:

- Los componentes se crean con el formato markdown.
- Si el componente se toma de un codigo como react o next ya creado preguntar al usuario que desea hacer.

  - Crear componente normal
  - Guiar paso a paso la creación

- El componente debe declararse como una función con nombre camelCase: `nombreComponente(options)`.

- Debe iniciarse con una constante `defaults` que contenga todas las opciones configurables por defecto.
- Las opciones deben poder sobrescribirse con `Object.assign(defaults, options)`.
- Debe incluir lógica modular en una sección separada del renderizado HTML.
- Toda la interfaz debe estar construida con **jQuery** y **TailwindCSS** exclusivamente.
  -Todos los elementos visibles (etiquetas, IDs, estados) provengan de un objeto JSON (json: []).
  -Todo lo que se envia al backend debe ser data.
  El componente debe inyectarse en el DOM bajo el `id` del contenedor padre definido por `opts.parent`.

1. **Consulta de Datos (GET)**:

   - Si un componente requiere `json`, **debe hacer una consulta al Backend** obligatoriamente.
   - La llamada debe realizarse mediante `fetch()` siguiendo el estándar del método `get`.

2. **Eventos por Tipo de Acción**:

   - **Eliminar (Delete)**: Se debe implementar un evento `onDelete` que realice la acción correspondiente en el backend.
   - **Agregar (Add)**: Se debe implementar un evento `onAdd` conectado al backend.
   - **Modificar (Update)**: También se usará el evento `onAdd` para modificaciones, conectándose al backend (📌 considerar renombrar a `onSave` si hay ambigüedad entre agregar/modificar).

3. **Estructura de Soporte (MVC)**:
   - Cualquier evento definido (`onAdd`, `onDelete`, etc.) **debe crear automáticamente**:
     - Un **Controlador (ctrl)**.
     - Un **Modelo (mdl)**.
   - Estos deben adherirse a las **reglas de pivotes y templates estándar del proyecto**.

```js
// Consulta al backend
  async onShow() {
      let request = await useFetch({
        url: this._link,
        data: {
          opc: "get",
          id: 1
        },
      });

      this.NombreComponente({
        parent:'root',
        json: request.data
      });

```

## 3. Inputs esperados

- Atributos vía `options`:  
  `parent`, `id`, `class`, `json`, `data`.

- Eventos personalizados esperados (opcionales):  
  `onAdd`, `onUpdate`, `onDelete`, `onShow`, `onSubmit`.

- ¿Requiere datos del backend?:  
  Sí / No (si sí, usar `fetch()` con `opc: 'get'`).

---

## 4. Formato de salida esperado (ejemplo base):

- Se usa de referencia el pivot-component.js
- Se debe agregar onShow para mandarlo a llamar.
- el formato de salida es markdown
- No se usan funciones son metodos
- No uses `$` para crear una variable
- Al mostrar el uso basico debes mostrarlo como 'this.[nameComponent]()'
- Si lleva dentro de la configuacion de opts el atributo json, preguntar al usuario si desea crear el <ctrl> y el <mdl>
- **CRÍTICO:** NO usar prefijo `_` (guion bajo) en métodos ni propiedades de instancia. Aunque sea convención común de JS para "uso interno", el framework CoffeeSoft NO la aplica. Mantener consistencia con `Templates`, `Cards`, `Navbar`, `App`, etc.

  ✅ **CORRECTO:**
  ```js
  class ModuleCard {
      constructor(parent, options) {
          this.uid      = 'mc_' + Math.random().toString(36).slice(2, 7);
          this.parent   = parent;
          this.options  = options || {};
          this.settings = null;
      }
      init() {
          this.settings = this.buildSettings();
          this.render();
      }
      buildSettings() { ... }
      buildHeader(s) { ... }
  }
  ```

  ❌ **INCORRECTO:**
  ```js
  class ModuleCard {
      constructor(parent, options) {
          this._uid      = '...';
          this._parent   = parent;
          this._options  = options || {};
          this._settings = null;
      }
      _buildSettings() { ... }
      _buildHeader(s) { ... }
  }
  ```

  > **Aplica a:** métodos públicos, helpers internos, propiedades de instancia (`this.foo`) y cualquier identificador dentro de clases JS del framework. Si necesitas señalar "no es API documentada", usa comentario inline corto (`// helper`) o agrupa bajo separador `// -- Public API --`, pero el nombre va sin `_`.

```js
NombreComponente(options) {
  // 📌 Configuración por defecto
  const defaults = {
    parent: "root",
    id: "nombreComponente",
    title: "Título",
    class: "bg-[#1F2A37] p-4 rounded-xl",
    data: {},
    json: [],
    onDelete: () => {},
    onAdd: () => {},
    onUpdate: () => {}
  };

  const opts = Object.assign({}, defaults, options);

  // 🔵 Lógica de la aplicación


  // 🧱 Construcción de la interfaz
  const container = $("<div>", {
    id: opts.id,
    class: `${opts.class}`
  });

  const header = $("<h2>", {
    class: "text-white text-lg font-bold mb-2",
    text: opts.title
  });

  // 🔵 Aplicar eventos



  container.append(header);


  //  Inserción al DOM
  $(`#${opts.parent}`).html(container);
}
```

## 5. Datos SAMPLE para desarrollo UI-first

Todo componente nuevo que reciba `json` o `data` **debe declarar una constante `SAMPLE_[ENTIDAD]`** al inicio del modulo donde se usa. Permite visualizar el componente sin backend listo (UI-first development).

### Reglas

- **Naming:** `SAMPLE_[ENTIDAD]` en SCREAMING_SNAKE_CASE — ej. `SAMPLE_KPIS`, `SAMPLE_SALE`, `SAMPLE_FILTERS`, `SAMPLE_VENTAS_TABLE`.
- **Ubicacion:** top del archivo del modulo, antes de `$(async () => {...})`.
- **Shape:** replica EXACTA del JSON que devolveria el backend (incluye keys auxiliares como `a` para acciones, `id` oculto, badges en HTML cuando aplique).
- **Volumen:** 3-7 registros representativos. Incluye casos limite: cancelados, sin cliente, con descuento, etc.
- **Conexion:** el metodo `onShow[Entidad](data)` recibe el SAMPLE como argumento desde `render()`.

### Ejemplo en el formato esperado

```js
// ── Top del modulo ──
const SAMPLE_KPIS = [
    { id:'kpiCount', label:'Ventas',      value: 12,         tone:'default' },
    { id:'kpiTotal', label:'Monto total', value:'$4,820.00', tone:'success' }
];

// ── Dentro de la clase App ──
render() {
    this.layout();
    this.onShowKpis(SAMPLE_KPIS);                 // ← SAMPLE durante dev
    // this.onShowKpis(await this.getKpis());     // ← cuando exista backend
}

onShowKpis(rows) {
    this.kpisRow({ parent: 'kpisRow', json: rows });
}
```

### Variante para componentes con AJAX (`createTable`, `createCoffeeTable3`)

Cuando el componente del framework hace AJAX (ej. `createTable` con `idFilterBar`), el SAMPLE vive en el **backend** como funcion `ls[Entidad]()` con comentario marcador:

```php
// ───────────────────────────────────────────────────────────────────
//  lsVentas — Lista de ventas (SAMPLE: datos hardcodeados de muestra)
// ───────────────────────────────────────────────────────────────────
function lsVentas() {
    $samples = [ /* ... */ ];
    return ['row' => $__row];
}
```

### Beneficios

- Desacopla UI de backend — avanzar sin esperar API.
- Auto-documenta el shape esperado por el componente.
- Swap simple: `this.onShowX(SAMPLE_X)` → `this.onShowX(await fetch(...))`.
- Fixture util cuando el backend devuelve vacio durante dev.

trigger:
when_input_type: "code"
and_detects: - "fetch(" - "useFetch" - "fn_ajax" - "this.createModalForm" - "opc:"
then: - activar: new-component - analizar: estructura JSON, eventos (add, edit, delete) - verificar: si requiere ctrl y mdl - aplicar: reglas de new-components.md - preguntar: ¿Deseas generar el backend (ctrl y mdl)?
