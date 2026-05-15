# SPEC – Huubie POS (Pastelería)

| Campo         | Valor                                      |
|---------------|--------------------------------------------|
| Sistema       | Huubie POS – Pastelería + Pedidos          |
| Módulo        | POS                                        |
| Apartado      | Panel de venta                             |
| Versión       | 1.0                                        |
| Responsable   | Equipo de Desarrollo (Rosi y Somx)         |

---

## 1. Objetivo

Desarrollar un módulo estándar de POS orientado a la gestión y operación de ventas dentro del ecosistema de pedidos existente.

El sistema debe permitir:

- Captura eficiente de ventas.
- Administración de turnos.
- Cierre del día.
- Consulta de tickets.
- Procesamiento de pagos.
- Validación de cobros (verificar que el total de la venta sea correcto).

---

## 2. Descripción general

Panel de POS simple para venta directa de pastelería. Permite realizar ventas, aplicar descuentos y procesar pagos de forma sencilla, sin terminal física conectada: únicamente se captura el método de pago y el monto.

---

## 3. Historias de usuario

### 3.1 HU-01 – Catálogo de productos (Panel dinámico)

**Como** ADMIN / VENDEDOR  
**Quiero** visualizar todos los productos registrados en el sistema y agregarlos al panel de venta  
**Para** tener acceso rápido a los productos dados de alta.

#### Criterios de aceptación

**Panel de productos:**

- Mostrar todos los productos existentes.
- Agrupar y filtrar por categoría.
- Barra de búsqueda por nombre con filtrado en tiempo real.
- Mostrar imagen o icono del producto.
- Mostrar precio del producto.
- Botón para agregar producto al ticket de venta.
- Actualización del ticket en tiempo real al agregar un producto.

**Barra informativa (header del POS):**

- Turno activo: mostrar el turno actual. Si no hay turno abierto, bloquear la venta y solicitar apertura de turno.
- Sucursal activa: mostrar la sucursal seleccionada.
- Vendedor: mostrar el nombre de la persona encargada.
- Total de ventas acumuladas en el turno.
- Número de órdenes realizadas en el turno.

---

### 3.2 HU-02 – Visor de ventas (Ticket)

**Como** ADMIN / VENDEDOR  
**Quiero** un visor de ventas centralizado  
**Para** gestionar los detalles de la venta en curso: productos, pagos, clientes y operaciones.

#### Criterios de aceptación

**Estado vacío (sin productos):**

- Leyenda: "El ticket está vacío, agregar productos del catálogo".
- Botones de operación deshabilitados.
- Título de la venta y folio deshabilitados.

**Estado activo (con productos):**

- Se activa el panel de operaciones.
- Se muestran los datos de venta y folio del ticket.
- Aparece el botón para eliminar ticket.

**Gestión de productos en el ticket:**

- Mostrar por cada producto: imagen/icono, nombre, precio.
- Botones "+" y "−" para modificar cantidad.
- Opción para aplicar descuento individual por producto.
- Opción para eliminar producto del ticket.

**Gestión de cliente:**

- Selector de cliente existente desde una lista.
- Opción para agregar cliente nuevo (nombre completo obligatorio, teléfono y correo opcionales).

**Operaciones de venta (botones de acción):**

- Aplicar descuento general.
- Agregar nota.
- Imprimir ticket.
- Pagar venta.

**Resumen de la venta (footer del ticket):**

- Total de ítems.
- Total de productos distintos.
- Subtotal.
- Descuento aplicado (si existe).
- Total a pagar.

#### Flujos alternos

- Si el cliente no existe → formulario inline para crearlo.
- Si se eliminan todos los productos → el panel vuelve al estado vacío.
- Si se intenta pagar sin productos → alerta bloqueante: "Agrega productos antes de pagar".

---

### 3.3 HU-03 – Modal de pagos

**Como** ADMIN / VENDEDOR  
**Quiero** un apartado para capturar cómo se va a pagar la cuenta  
**Para** controlar los pagos de forma rápida y precisa.

#### Criterios de aceptación

**Encabezado del modal:**

- Título del proceso (ej. "Cobrar venta").
- Folio de venta.
- Cliente (si fue asignado).

**Información de la cuenta:**

- Subtotal.
- Descuento aplicado (si existe).
- Total en M.N.

**Conceptos de pago** (origen: tabla `conceptos_pago`):

Cada concepto muestra:

- Clave (ej. VISA, EFE, TDC).
- Descripción.
- Importe capturado.
- Importe total acumulado.

**Saldo final:** diferencia entre total y suma de pagos capturados.

**Acciones:**

- Botón "Cancelar" → cierra el modal sin guardar.
- Botón "Aceptar" → procesa el pago. Solo habilitado si el saldo final es ≤ 0 (cuenta cubierta).

---

### 3.4 HU-04 – Aplicar descuento

**Como** ADMIN / VENDEDOR  
**Quiero** aplicar descuentos de diferentes tipos (porcentaje, monto fijo o por producto)  
**Para** gestionar promociones o resolver incidencias de forma flexible.

#### Criterios de aceptación

**Tipos de descuento (3 botones/tabs):**

| Tipo        | Comportamiento                                                        |
|-------------|-----------------------------------------------------------------------|
| Porcentaje  | Aplica un % de descuento sobre el total de la cuenta.                 |
| Monto       | Aplica un descuento con valor fijo (ej. $200) sobre la cuenta.       |
| Producto    | Aplica un % de descuento únicamente al producto seleccionado.        |

**Motivo de descuento (selector obligatorio):**

- Cortesía.
- Error de captura.
- Cupón.
- Error en el servicio.
- Otro (campo de texto libre).

**Confirmación:**

- Modal de éxito: "Descuento aplicado con éxito".

**Validaciones:**

- Si no hay productos en la cuenta → error: "No hay productos en la cuenta".
- Si el descuento excede el valor permitido → error: "El descuento excede el valor permitido".

---

### 3.5 HU-05 – Cancelación de venta

**Como** ADMIN / VENDEDOR  
**Quiero** cancelar una venta con confirmación  
**Para** evitar eliminaciones accidentales y asegurar que el ticket se borre correctamente.

#### Criterios de aceptación

**Flujo:**

1. Clic en botón "Eliminar ticket".
2. Cuadro de diálogo de confirmación: "¿Deseas eliminar el ticket actual?".
3. Si confirma → eliminar productos y configuraciones del ticket de la base de datos.
4. Modal de éxito: "El ticket fue eliminado correctamente" (auto-cierre en 1.5 s).
5. El panel vuelve al estado vacío.

---

### 3.6 HU-06 – Agregar nota al ticket

**Como** ADMIN / VENDEDOR  
**Quiero** agregar una nota al ticket  
**Para** registrar observaciones visibles tanto en el ticket impreso como en el panel del sistema.

#### Criterios de aceptación

- Clic en botón "Nota" → abre modal con campo de texto.
- Al guardar la nota, aparece botón "Eliminar nota" junto al campo.
- En el botón de nota del panel aparece un badge con `1` indicando que existe una nota activa.

---

### 3.7 HU-07 – Ticket de venta (impresión)

**Como** ADMIN / VENDEDOR  
**Quiero** imprimir el ticket de venta  
**Para** generar un comprobante con el detalle de los productos vendidos.

#### Criterios de aceptación

- Al presionar "Imprimir ticket" se abre un panel/vista previa con la cuenta detallada.

---

### 3.8 HU-08 – Apertura y cierre de turno

**Como** ADMIN / VENDEDOR  
**Quiero** abrir y cerrar turno  
**Para** controlar las operaciones de venta por período.

#### Criterios de aceptación

- Comportamiento idéntico al módulo de pedidos existente.
- Al presionar "Abrir turno" se despliega el apartado de gestión de turno.

---

## 4. Excepciones y reglas de negocio

### 4.1 Base de datos compartida

La tabla `order` es compartida entre POS y Pedidos:

| Campo      | Valor | Significado                     |
|------------|-------|---------------------------------|
| `is_pos`   | `1`   | Orden generada desde POS        |
| `is_pos`   | `0`   | Orden generada desde Pedidos    |

### 4.2 Tablas relacionadas

| Tabla                   | Relación / Uso                                  |
|-------------------------|--------------------------------------------------|
| `order`                 | Tabla principal de la orden. Incluye `tip_amount` (propina, solo POS). |
| `cash_shift`            | Turno activo. Relacionado con cada orden.        |
| `pos_discount_reason`   | Catálogo de motivos de descuento.                |
| `pos_order_discount`    | Descuentos aplicados por orden.                  |
| `pos_order_payment`     | Pagos registrados por orden.                     |
| `pos_payment_type`      | Catálogo de tipos/conceptos de pago.             |

### 4.3 Campo `tip_amount`

Pertenece a la tabla `order`. Exclusivo de ventas POS (no aplica en pedidos).

---

## 5. Roles y permisos

| Rol            | Acceso                                       |
|----------------|----------------------------------------------|
| Administrador  | Acceso completo a todas las funcionalidades.  |
| Cajero         | Operaciones de venta y cobro.                |
| Vendedor       | Operaciones de venta y cobro.                |

---

## 6. Criterios de éxito

El proyecto se considera exitoso cuando:

- El sistema genera un movimiento de venta con todos sus apartados funcionales.
- Se puede visualizar e imprimir el ticket de venta.
- El turno de apertura es el mismo que se usa en pedidos.
- Se pueden consultar los movimientos diarios de venta.
- El sistema registra correctamente: productos, clientes, pagos y operaciones dentro del ticket.
- Los usuarios pueden realizar operaciones de venta completas.
- Funciona la reimpresión y cancelación de tickets.

---

## 7. Flujo general del sistema

```
Inicio de sesión
  → Selección de sucursal
    → Módulo POS
      → [Izquierda] Catálogo de productos
      → [Derecha] Ticket de venta
        → Agregar productos
        → Gestionar cliente
        → Aplicar descuentos
        → Agregar notas
        → Procesar pago
        → Imprimir ticket
        → Cancelar venta
```
