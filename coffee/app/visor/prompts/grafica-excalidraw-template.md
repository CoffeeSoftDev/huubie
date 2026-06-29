=== EXCALIDRAW · PLANTILLA "RELACIONES + TABLA DETALLE" ===
El usuario eligio el sub-modo TEMPLATE. Ignora el estilo libre: genera SIEMPRE la
composicion descrita aqui, leyendo del documento/contexto los maestros corporativos
(tablas/entidades raiz), sus relaciones y los campos de la tabla principal. Responde
con UN solo bloque ```excalidraw.

DISPOSICION (obligatoria):
- IZQUIERDA: la RELACION de las tablas (cards conectadas por flechas).
- DERECHA:   la TABLA principal con sus CAMPOS (header + lista de campos).
Deja una banda vertical de aire entre ambas zonas (la izquierda termina y la derecha
empieza claramente mas a la derecha; no las mezcles).

OBLIGATORIO en el JSON:
- Primer nivel: `"type": "excalidraw"`, `"version": 2`, `"source": "coffeeia-template"`.
  El `source` exacto activa el auto-ajuste de cajas al texto en el visor: NO lo cambies.
- Cierra con `"appState": { "viewBackgroundColor": "#ffffff", "theme": "light" }`.
- TEXTO xs: TODOS los nodos y textos usan `"fontSize": 13`. Nada mas grande.
- No expliques el JSON ni agregues texto despues del bloque.

────────────────────────────────────────────────────────
1) IZQUIERDA · RELACION DE TABLAS = CARDS
────────────────────────────────────────────────────────
- Cada maestro es UN `rectangle` con esquinas redondeadas `"roundness": { "type": 3 }`,
  `"fillStyle": "solid"`, `"roughness": 1`, `"strokeWidth": 1.5`.
- Su nombre va en `"label": { "text": "<nombre>", "fontSize": 13 }` (UNA etiqueta por card).
- CAJAS JUSTAS AL TEXTO: da `width`/`height` aproximados al largo del nombre (el visor
  los reajusta exactamente al texto). No infles las cajas; no uses un ancho fijo para todas.
- COLOR POR GRUPO: agrupa los maestros por su grupo funcional (por prefijo o dominio:
  p.ej. todo lo de `order_*` un grupo, lo de `cash_*`/`shift_*` otro, lo de `*_closure`
  otro, etc.). Los maestros del MISMO grupo comparten color. Asigna colores de esta
  paleta (background / strokeColor), un color distinto por grupo:
    · azul     #a5d8ff / #1971c2
    · verde    #b2f2bb / #2f9e44
    · morado   #d0bfff / #6741d9
    · rosa     #fcc2d7 / #e64980
    · amarillo #ffec99 / #f08c00
    · cian     #99e9f2 / #0c8599
    · naranja  #ffd8a8 / #e8590c
- FLECHAS QUE APUNTAN A LAS CARDS: cada relacion es un `"type": "arrow"` enlazado por id,
  con `"end"` = la card a la que apunta (la punta cae sobre esa card) y `"start"` = la card
  origen. NO pongas `x/y/width/height/points` en las flechas: solo `start` y `end` por id.
  `{ "type": "arrow", "start": { "id": "<origen>" }, "end": { "id": "<destino>" }, "strokeColor": "#1e1e1e" }`
- Mantén TODAS estas cards en la mitad IZQUIERDA del lienzo (coordenadas `x` pequeñas),
  con aire entre ellas (sin encimar) y repartidas por grupos para que se lean los colores.

────────────────────────────────────────────────────────
2) DERECHA · TABLA PRINCIPAL CON SUS CAMPOS (como la 2da imagen)
────────────────────────────────────────────────────────
Elige la tabla/entidad principal del contexto y dibujala en la mitad DERECHA del lienzo
(coordenadas `x` grandes, claramente separada de las cards de la izquierda):
- HEADER: UN `rectangle` redondeado con el color del grupo al que pertenece la tabla,
  `"label": { "text": "<nombre_tabla>", "fontSize": 13 }`.
- CAMPOS EN UNA SOLA ETIQUETA: justo debajo del header, UN UNICO elemento
  `"type": "text"` que contenga TODOS los campos en un solo string separado por `\n`
  (saltos de linea). NO crees un nodo ni una etiqueta por campo. `"textAlign": "left"`,
  `"fontSize": 13`, `"strokeColor": "#1e1e1e"`.
- Replica el orden y las secciones de la imagen dentro de ese mismo texto, por ejemplo:
    id PK
    status (DOUBLE)

    — montos (DOUBLE) —
    total
    subtotal
    ...

    — fechas —
    created_at
    ...

    — llaves foraneas —
    subsidiary_id → subsidiaries
    employee_id → usr_users
    ...
  Marca PK con " PK", las foraneas como "campo → tabla_referida", y agrupa con lineas
  "— seccion —". Todo dentro del MISMO elemento text (un solo `\n`-string).

────────────────────────────────────────────────────────
EJEMPLO VALIDO (estructura; adapta nombres/campos al contexto real)
Izquierda = relacion de cards · Derecha = tabla detalle con campos
────────────────────────────────────────────────────────
```excalidraw
{
  "type": "excalidraw",
  "version": 2,
  "source": "coffeeia-template",
  "elements": [
    { "type": "rectangle", "id": "cash_shift", "x": 120, "y": 80, "width": 110, "height": 40, "backgroundColor": "#b2f2bb", "strokeColor": "#2f9e44", "fillStyle": "solid", "roughness": 1, "strokeWidth": 1.5, "roundness": { "type": 3 }, "label": { "text": "cash_shift", "fontSize": 13 } },
    { "type": "rectangle", "id": "shift_payment", "x": 70, "y": 220, "width": 130, "height": 40, "backgroundColor": "#a5d8ff", "strokeColor": "#1971c2", "fillStyle": "solid", "roughness": 1, "strokeWidth": 1.5, "roundness": { "type": 3 }, "label": { "text": "shift_payment", "fontSize": 13 } },
    { "type": "rectangle", "id": "order", "x": 270, "y": 220, "width": 90, "height": 40, "backgroundColor": "#d0bfff", "strokeColor": "#6741d9", "fillStyle": "solid", "roughness": 1, "strokeWidth": 1.5, "roundness": { "type": 3 }, "label": { "text": "order", "fontSize": 13 } },
    { "type": "rectangle", "id": "order_package", "x": 230, "y": 360, "width": 140, "height": 40, "backgroundColor": "#fcc2d7", "strokeColor": "#e64980", "fillStyle": "solid", "roughness": 1, "strokeWidth": 1.5, "roundness": { "type": 3 }, "label": { "text": "order_package", "fontSize": 13 } },

    { "type": "arrow", "start": { "id": "shift_payment" }, "end": { "id": "cash_shift" }, "strokeColor": "#1e1e1e" },
    { "type": "arrow", "start": { "id": "cash_shift" }, "end": { "id": "order" }, "strokeColor": "#1e1e1e" },
    { "type": "arrow", "start": { "id": "order" }, "end": { "id": "order_package" }, "strokeColor": "#1e1e1e" },

    { "type": "rectangle", "id": "daily_closure", "x": 720, "y": 70, "width": 150, "height": 40, "backgroundColor": "#b2f2bb", "strokeColor": "#2f9e44", "fillStyle": "solid", "roughness": 1, "strokeWidth": 1.5, "roundness": { "type": 3 }, "label": { "text": "daily_closure", "fontSize": 13 } },
    { "type": "text", "id": "daily_closure_fields", "x": 720, "y": 125, "fontSize": 13, "textAlign": "left", "strokeColor": "#1e1e1e", "text": "id PK\nstatus (DOUBLE)\n\n— montos (DOUBLE) —\ntotal\nsubtotal\ntax\ntotal_cash\ntotal_card\n\n— fechas —\ncreated_at\nclosure_date\n\n— llaves foraneas —\nsubsidiary_id → subsidiaries\nemployee_id → usr_users" }
  ],
  "appState": { "viewBackgroundColor": "#ffffff", "theme": "light" }
}
```
