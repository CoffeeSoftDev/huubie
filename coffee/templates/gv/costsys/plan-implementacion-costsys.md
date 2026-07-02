# Plan de implementación — Costsys · Grupo Varoch

> Generado por Coffee Intelligence 🧠☕ a partir de `ERS Costsys.docx` y las historias de usuario
> (`Documento sin título.docx`). Extractos de texto disponibles en `ERS Costsys.txt` y
> `Documento sin título.txt` dentro de esta misma carpeta.

---

## 1. Contexto del proyecto

**Costsys** es el sistema de control de costos por producto, clasificación y unidad de negocio (UDN)
de Grupo Varoch. Su propósito es responder:

- ¿Cuánto cuesta producir cada producto y cuánto se gana?
- ¿Cuál es el costo de producción total por clasificación?
- ¿Qué productos se desplazan más y cuáles requieren ajuste de precio?

Lo logra mediante el **costeo de recetas/subrecetas** y el **costo potencial**: un concentrado mensual
que cruza costos contra el desplazamiento de ventas importado (SoftRestaurant), comparado contra
márgenes saludables definidos por clasificación (tablero de control / semáforos).

**Stakeholders:** Ing. Rosa Angélica Pérez Velásquez · Ing. Sergio Osorio Méndez (reunión 25/06/2026).

---

## 2. Sistema de diseño (obligatorio)

Todos los templates de Costsys heredan el sistema visual de `coffee/templates/gv` (**Coffee-Varoch**):

| Elemento | Especificación |
|---|---|
| Tema | **Light** — fondo página `#F2F5F9`, texto `#0F172A` |
| Color primario | Azul institucional `#003360` (hover `#00264A`) |
| Color acción | `#2563EB` |
| Éxito / verde | `#7AAB20` (texto `#5d8418`) |
| Peligro / rojo | `#9E1B32` |
| Warning / amarillo | `#D97706` |
| Tipografía | Inter (Google Fonts) + Tailwind CDN + iconos Lucide |
| Navbar | Blanca, logo GV degradado `#003360→#2563EB`, pill de UDN con dropdown, score de valores, usuario |
| Rail lateral | `#menu-sidebar` de 60px con `.menu-rail-item` (activo: azul `#003360` sobre `rgba(0,51,96,.10)`) |
| Cards | `.cv-card` blancas, borde `#E2E8F0`, radio 12px, sombra suave |
| Tablas | Header sticky `#003360` texto `#E8EEF5`; filas de grupo `#EEF3F8`; hover `rgba(37,99,235,.05)` |
| Inputs | `.cv-input` fondo `#F8FAFC`, focus azul `#2563EB` con ring |
| Badges | `.cv-badge` pill con borde (`badge-success`, `badge-primary`, `badge-action`, `badge-neutral`) |

Referencias directas: `gv-navbar.html` (navbar + rail + dropdowns), `gv-permisos.html` (tabla matriz
con header azul y switches), `gv-index-navegacion.html` (hub de tarjetas).

**El rail lateral de Costsys** debe reflejar los módulos propios del sistema:
Inicio · Ingredientes · Subrecetas · Recetas · Costo Potencial · Proyección · Admin.

---

## 3. Mapa de módulos y fases

```
┌─────────────────────────────────────────────────────────────────┐
│ FASE 1                                                          │
│  ├─ Administrador (catálogos base)                              │
│  │   ├─ Unidades (de medida)                                    │
│  │   ├─ Marcas                                                  │
│  │   ├─ Proveedores                                             │
│  │   ├─ Clasificación                                           │
│  │   ├─ Subclasificación                                        │
│  │   └─ Tablero de control (semáforos %costo / MC)              │
│  ├─ Catálogo de Ingredientes                                    │
│  ├─ Catálogo de Subrecetas (wizard 2 pasos)                     │
│  └─ Catálogo de Recetas (clonar, borrador→activa, vínculo SR)   │
├─────────────────────────────────────────────────────────────────┤
│ FASE 2                                                          │
│  ├─ Costo Potencial (tablero mensual con semáforos)             │
│  └─ Proyección / Ejercicio mensual (precios propuestos,         │
│      programación de aplicación masiva)                         │
├─────────────────────────────────────────────────────────────────┤
│ EXTRAS (post FASE 2)                                            │
│  └─ Notificaciones ERP (cambios de precio, productos nuevos     │
│      en SoftRestaurant y en pedidos Fogaza)                     │
└─────────────────────────────────────────────────────────────────┘
```

El orden dentro de FASE 1 importa: los catálogos base del Administrador alimentan los selects de
Ingredientes; Ingredientes alimenta Subrecetas; ambos alimentan Recetas. Desarrollar en ese orden.

---

## 4. Detalle por módulo

### 4.1 Administrador (catálogos base)

Panel administrativo con **tabs** (patrón catálogo admin multi-entidad): Unidades · Marcas ·
Proveedores · Clasificación · Subclasificación · Tablero de control.

- CRUD simple por entidad (tabla + modal crear/editar + eliminar con confirmación).
- Clasificación y Subclasificación son jerárquicas (subclasificación pertenece a clasificación) y
  dependen de la UDN.
- **Tablero de control:** define los rangos de semáforo que pintan las celdas `%costo` y
  `Margen de contribución` en el costo potencial. Permite fijar mínimo/máximo de porcentaje
  **por clasificación** y **por subclasificación**. UI sugerida: tabla de rangos con inputs numéricos
  y preview del color (verde = sano, rojo = fuera de rango).

### 4.2 Catálogo de Ingredientes

**Lista** (filtrada por UDN, exportable a Excel, paginación persistente al recargar):

- Título: `Lista de Ingredientes / (Nombre de la UDN)`.
- Columnas: producto · precio compra · contenido neto · precio unidad · unidad · marca · proveedor ·
  descripción · acciones (editar / eliminar).

**Crear / Editar** (modal):

- Campos: nombre*, contenido neto*, unidad (select)*, precio*, **precio por unidad = precio /
  contenido neto (readonly, autocalculado)**, marca (select), proveedor (select), descripción,
  UDN (select)* — en edición la UDN va `disabled`.
- Validación de duplicados por UDN: SweetAlert
  `"Ya existe este ingrediente para (Nombre de la UDN)"`.

**Eliminar:**

- Si está vinculado a subrecetas/recetas → alerta bloqueante que lista los vínculos:
  `"No se puede eliminar el ingrediente (nombre) porque está vinculado a las siguientes recetas y
  subrecetas: Subrecetas: (…) Recetas: (…)"`.
- Sin vínculos → confirmación estándar y borrado definitivo.

### 4.3 Catálogo de Subrecetas

**Lista** (filtrada por UDN **y clasificación**, exportable a Excel, paginación persistente):

- Título: `Lista de Subrecetas / (Nombre de la UDN)`.
- Columnas: fecha de creación · foto · nombre · costo de ingredientes · rendimiento · costo x unidad ·
  botón "ver más" (…) con: ver, editar, agregar instrucciones, imprimir, eliminar.

**Crear — wizard multipasos:**

- **Paso 1 (alta base):** imagen, UDN (select)*, nombre*, clasificación (select dependiente de la
  UDN)*, observaciones, instrucciones. Al guardar se crea el registro y se obtiene el ID para
  vincular componentes.
- **Paso 2 (composición, panel dividido):**
  - **Panel 1 (izquierda):** dos tablas —
    - *Ingredientes:* ingrediente · unidad · cantidad · precio unidad · **costo real = cantidad ×
      precio unidad** · opciones (ver/editar, quitar). Encabezado con contador de ingredientes,
      total de costo, y botón "+ vincular" que abre formulario lateral colapsable
      (select ingrediente + cantidad + agregar).
    - *Subrecetas anidadas:* misma estructura (una subreceta puede usar otra subreceta como
      ingrediente).
  - **Panel 2 (derecha) — procedimiento culinario / costeo:**
    - Total de ingredientes (disabled, suma de ambas tablas)
    - Unidad de la subreceta (select)*
    - Rendimiento (input)*
    - **Costo = Total de ingredientes / Rendimiento** (disabled)
    - Sin rendimiento y unidad no se puede guardar.

**Eliminar:** misma regla de vínculos que ingredientes (bloqueo si está en recetas/subrecetas).

### 4.4 Catálogo de Recetas

- Vincula ingredientes **y** subrecetas para el costeo automático: costo de producción, rendimiento,
  precio de venta, **margen de contribución** y **% de costo**.
- Datos generales: nombre, clasificación, subclasificación, temporada (sí/no), foto, instrucciones.
- **Clonar receta:** copia completa (ingredientes, subrecetas, costeo, clasificación,
  subclasificación) con nombre `"(original) - Copia"`, estado inicial **Borrador**; al terminar los
  ajustes se cambia a **Activa** (solo las activas aparecen en el Costo Potencial).
- **Desactivación** de recetas (no borrado).
- **Vinculación con productos de SoftRestaurant** (para casar el desplazamiento de ventas).

### 4.5 Costo Potencial (FASE 2)

Concentrado general **mensual por UDN**, basado en **snapshots** (copia congelada de costos y ventas
del mes).

- **Filter bar:** UDN · Clasificación · Año · Mes.
- **Tabla agrupada por clasificación → subclasificación** (subgrupos), columnas:
  producto · **P. Propuesto (celda editable)** · P. Venta sin IVA · costo · costo % · MC ·
  desplazamiento · ventas estimadas · costo estimado · MC estimado.
- La tabla varía según el perfil del usuario (roles, ver §5).
- Tableros mensuales resumen: ventas/costo/margen **por clasificación** y **por subclasificación**.
- Acciones: actualizar precios de ingredientes · carga de desplazamiento automática al cierre de mes.

**Semáforos (funciones de pintado, rangos del Tablero de control):**

| Función | Regla |
|---|---|
| `pintarCosto` | Amarillo + icono warning si el costo cambió respecto al snapshot |
| `pintarPorcentajeCosto` | Verde si %costo bajo (sano) · rojo si supera el máximo |
| `pintarMC` | Verde si el margen de contribución es alto · rojo si es bajo |
| `pintarDesplazamiento` | Verde si sale por encima del promedio de su clasificación · rojo debajo |
| `aplicarCalculo()` | Recalcula indicadores en tiempo real sobre el snapshot; costo receta = total / rendimiento |

**Fórmulas del precio propuesto (HU-CP-04):**

```
Venta sin IVA propuesto = precio propuesto / (1 + (iva + ieps) / 100)
MC propuesto            = Venta sin IVA propuesto − costo
% costo propuesto       = (costo / Venta sin IVA propuesto) × 100
Costo estimado          = costo × desplazamiento
MC estimado             = MC propuesto × desplazamiento
```

Solo cambia el precio: costo y desplazamiento **no se tocan**. La celda editada se pinta de amarillo
y los indicadores se recalculan en la misma fila (actual vs propuesto).

### 4.6 Proyección / Ejercicio mensual (FASE 2)

- **Ejecutar ejercicio (HU-CP-02):** genera copia del snapshot del mes elegido (default: mes
  anterior) hacia una fecha futura — nunca hacia atrás. Separa columnas *actual* (precio venta,
  costo, MC, ventas/costo/MC estimados) vs *propuesto* (precio propuesto, %costo propuesto,
  ventas/costo/MC estimados propuestos).
- Guardar **bocetos** de proyecciones hasta aplicarlas; editar antes de aplicar; eliminar solo si no
  se ha aplicado.
- **Mes cerrado ⇒ solo lectura** (editar requiere rol administrador).
- **Programar actualización de precios (HU-CP-05):** el botón *Programación* aparece cuando hay ≥ 1
  precio propuesto. Modal con:
  - Fecha efectiva (datepicker, default día 1 del mes siguiente)
  - Tipo de aplicación: **Todas** · **Por clasificación** · **Por selección** (multi-select)
  - Vista previa de los cambios → confirmar inserta en `costo potencial proyección`.
- **Reglas duras:** una receta solo puede tener una programación pendiente por mes · precio
  propuesto > 0 · no se programan recetas descontinuadas · si la receta cambia de precio durante la
  programación se aplica el cálculo vigente · cancelable antes de la fecha · al ejecutar con
  selección parcial, el día 1 se completan las recetas no afectadas para cerrar el ciclo.
- Notificación a dirección operativa **2 días antes** de aplicar precios propuestos.
- **Aplicación de proyección = actualización masiva de precios de recetas.**

### 4.7 Extras (notificaciones ERP)

- Notificación flotante de cambios de precio en costo potencial → gerente, dirección operativa y
  auxiliar de gerente.
- Producto nuevo en SoftRestaurant (gerente) → notificar a dirección operativa.
- Producto nuevo en pedidos Fogaza → notificar a dirección operativa.

---

## 5. Roles y accesos

| Perfil | Acceso |
|---|---|
| Dirección general | Costo potencial |
| Dirección operativa | Completo |
| Developers | Completo |
| Calidad | Ver catálogos + costo potencial |
| Gerentes | Ver catálogos + costo potencial |
| Marketing | Ver costo potencial |

La matriz se administra con el módulo de perfiles/permisos existente (`gv-permisos.html`).

---

## 6. Reglas transversales

1. **Todo se filtra por UDN** (Sonoras Meat, Fogaza, Baos, Punto Modelo, Quinta Tabachines) usando
   el pill de la navbar.
2. **Exportación a Excel** en todas las listas de catálogo.
3. **Paginación persistente**: al recargar, el usuario regresa a la página donde estaba.
4. **Duplicados por UDN**: validación al crear/editar con SweetAlert.
5. **Eliminación protegida**: nunca borrar registros vinculados; mostrar los vínculos en la alerta.
6. **Montos en `DOUBLE`** en BD y cálculos derivados siempre readonly en UI (precio unidad, costo,
   totales).
7. **Snapshots inmutables**: los meses cerrados son de solo lectura salvo rol administrador.

---

## 7. Base de datos y migración

El ERS pide **reestructurar la BD** del Costsys anterior. Trabajo pendiente (sesión aparte con
Coffee Intelligence, 4 fases: Inspección → Modelado → DDL → Auto-revisión):

- Estrategia de nueva BD para soportar el costo potencial (snapshots mensuales, propuestos vs
  actuales, programaciones de precios).
- Plan de migración del Costsys anterior al nuevo.
- Entidades previstas: unidades, marcas, proveedores, clasificaciones, subclasificaciones,
  rangos de control (semáforos), ingredientes, subrecetas + composición, recetas + composición,
  vínculo receta↔producto SoftRestaurant, snapshot mensual + renglones, proyecciones y
  programaciones de precios.

---

## 8. Entregables de templates (para CoffeeMagic 🪄)

Todos en `coffee/templates/gv/costsys/`, con el diseño Coffee-Varoch de `templates/gv`:

| # | Archivo | Contenido |
|---|---|---|
| 1 | `costsys-index.html` | Hub de navegación de los templates (patrón `gv-index-navegacion.html`) con secciones FASE 1 / FASE 2 |
| 2 | `costsys-ingredientes.html` | Lista de ingredientes: filter bar UDN + búsqueda + exportar, tabla, paginación |
| 3 | `costsys-subrecetas.html` | Lista de subrecetas: filtros UDN + clasificación, tabla con foto y menú (…) |
| 4 | `costsys-recetas.html` | Lista de recetas: costeo, badges Borrador/Activa, clonar, temporada |
| 5 | `costsys-admin.html` | Panel admin con tabs: unidades, marcas, proveedores, clasificación, subclasificación |
| 6 | `costsys-tablero-control.html` | Rangos de semáforo %costo / MC por clasificación y subclasificación con preview de color |
| 7 | `costsys-costo-potencial.html` | Tablero mensual: filter bar (UDN/clasificación/año/mes), tabla agrupada con semáforos y P. Propuesto editable, cards resumen |
| 8 | `costsys-proyeccion.html` | Ejercicio mensual: actual vs propuesto, estado boceto/aplicada, botón Programación |
| 9 | `modals/modal-ingrediente.html` | Form crear/editar ingrediente (precio unidad autocalculado) |
| 10 | `modals/modal-subreceta-wizard.html` | Wizard 2 pasos: alta base + panel composición/costeo |
| 11 | `modals/modal-programar-precios.html` | Fecha efectiva + tipo de aplicación + vista previa (HU-CP-05) |

Notas para la conjuración:

- Navbar y rail idénticos a `gv-navbar.html`; el rail marca activo el módulo correspondiente.
- Los semáforos usan los colores del sistema: verde `#7AAB20`, rojo `#9E1B32`, amarillo `#D97706`.
- Datos de ejemplo realistas de restaurante (cortes de carne, pizzas Fogaza, baos, etc.) coherentes
  con las UDN de Grupo Varoch.
- Interactividad estática mínima con JS vanilla: tabs, dropdowns, celda P. Propuesto que recalcula
  la fila con las fórmulas de §4.5.
