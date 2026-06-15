---
name: features-inventory
description: Requerimientos y ajustes del módulo de inventario
date: 2026-06-14
---

# Features Inventory

**Coffee UI**

-   ~Funcionalidad a los alerts de coffee: animación, etc.~
    
-   Implementar el cambio de empresa en la navbar.
    
-   ~Para todos los formatos el boton de imprimir debe ir a lado de la x de cerrar~
    
-    ~Revisar el problema que tiene el alert que hace pequeño el contenedor~
    
-   Definir que paleta de colores es la correcta 
    
-   ~Cambia el diseño de los botones para la tabla, ahora en lugar de botones deben ser solo iconos~
    

**Administrador de accesos**

\- Sucursales

      Formato a la tabla

       Formato a la filterbar

\- Usuarios

       Agregar/Editar usuario en sucursal asignada poder agregar multiples sucursales

       Poder seleccionar el color de usuario \*

       Modificar el formato de tabla, darle estilo 

               - Icono de usuario

               - Badge de estado

               - Botones 

**Tenant**

\- Layout

Corregir el tamaño del contenedor que tenga un minimo de altura

Darles un mejor diseño a modulos,submodulos,secciones,roles,tipos de permiso

*\- Accesos y permisos*

        - Permiso

               El permiso de superAdmin debe tener acceso a todos los modulos

               Para que sirve el boton de cancelar? solo debe aparecer cuando se le da editar

               Cambiar los clics, 

                      - Al dar clic sobre el checkbox otorgas/quitas permiso ala sección

                       - Al dar clic sobre la row se abren que tipos de permiso puede tener

              El modulo debe iniciar con los checkbox bloqueados, al darle clic al boton editar se                          habilitan

               Al precionar guardar cierra todo y vuelve a deshabilitar

 -

**Traspaso**

\- Cards KPI

-   ~Alinear las cards: título a la izquierda, números a la derecha.~

\- FilterBar

-   ~Definir los estados que estarán disponibles para el traspaso.~
-   Definir el destino de los traspasos.

\- Visor de traspaso

-   ~Preguntar si deseas cancelar el traspaso.~
-   ~Pregunta si deseas aceptar el traspaso.~

\*\*Importante \*\*  
Revisar los permisos si eres administrador puedes ver solo los destinos a los que tu tienes asignados

**Entradas**

-   ~\- Los inputs del modal deben ser más grandes.~
-   ~\- El SKU del modal de nueva entrada debe verse correctamente.~

---

**Salidas**

Main Container

-   ~El título de salidas de inventario debe especificar qué sucursal se está consultando.~

Modal de registrar salida

-   ~Agregar los motivos reales de salida: *Salida*, *Merma*.~
-   ~Revisar que funcionen correctamente:~
    -   ~Observación~
    -   ~Evidencia~
-   ~Cambiar el selector de registrar salida por `alertMessage`.~

Cards KPI

-   ~Ordenar el texto a la izquierda y los números a la derecha.~
-   ~El motivo *top* debe mostrar el color configurado para dicho motivo.~

Observación

-   Revisar si existe otra funcionalidad para las salidas de almacén, como alguna aprobación, etc.

Visor Container

       Cambiar diseño de tabla 

-   Revisar diseño de detalles de recepción.
-   Subir comprobante de firma.
-   Al imprimir el comprobante, debe emitirse la persona que solicitó la salida y debe aparecer la firma **pendiente de detalle**.

---

**Stock**

Cards KPI

-   Ordenar el texto a la izquierda y los números a la derecha.
-   Realizar pruebas de traspaso para tener datos.

Visor de productos

-   Agregar 10 movimientos de entrada y 10 movimientos de salida para ver cómo se comporta el historial de movimiento.
