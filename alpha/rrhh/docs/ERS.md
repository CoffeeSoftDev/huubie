# Especificación de Requerimientos de Software – Módulo RRHH Huubie

> **Versión:** 1.0
> **Fase:** 1 – Plantillas estáticas y diseño de BD
> **Fecha:** Abril 2026
> **Módulo:** `alpha/rrhh/`
> **Autor:** Equipo Huubie

---

## 1. Introducción

### 1.1 Propósito

Este documento define los requerimientos funcionales y no funcionales del módulo de **Recursos Humanos** del sistema Huubie. Sirve como contrato entre el equipo de producto y el equipo técnico para la Fase 1 (plantillas HTML estáticas + modelo de base de datos) y establece las bases de las fases posteriores (lógica de negocio, integraciones con biométrico, generación de recibos PDF, etc.).

### 1.2 Alcance

**Fase 1 – entrega este plan:**

- 8 plantillas HTML principales estandalone con datos dummy en `alpha/rrhh/templates/`.
- 3 plantillas HTML de modales reutilizables en `alpha/rrhh/templates/modals/`.
- Modelo de base de datos documentado (`base-de-datos.md`) con diagrama Mermaid y DDL sugerido.
- Este documento ERS.

**Fase 1 – fuera de alcance:**

- Controladores y modelos PHP (`ctrl/`, `mdl/`).
- Conexión real a base de datos.
- Integración con lector biométrico / reloj checador.
- Cálculo de nómina con reglas fiscales mexicanas (ISR, IMSS, INFONAVIT).
- Generación de recibos en PDF con timbrado CFDI.
- Submódulos de Reclutamiento, Desempeño, Cursos, Actas, Reconocimientos, Configuración.

### 1.3 Definiciones, acrónimos y abreviaturas

| Término | Definición |
|---|---|
| RRHH | Recursos Humanos |
| ERS | Especificación de Requerimientos de Software |
| RF | Requerimiento Funcional |
| RNF | Requerimiento No Funcional |
| CU | Caso de Uso |
| PDO | PHP Data Objects (capa de acceso a datos) |
| CURP | Clave Única de Registro de Población (identificador personal mexicano) |
| RFC | Registro Federal de Contribuyentes (identificador fiscal mexicano) |
| NSS | Número de Seguridad Social (identificador del IMSS) |
| Colaborador | Persona dada de alta como empleado, activa o baja |
| Incidencia | Registro diario de asistencia/retardo/falta/vacaciones/incapacidad |
| Permiso | Solicitud formal de ausencia (vacaciones, incapacidad, permiso especial) |
| Periodo | Intervalo de fechas para el cálculo de nómina (semanal, quincenal, etc.) |

### 1.4 Referencias

- Mockups visuales: `alpha/rrhh/images-templates/` (12 imágenes PNG).
- Template visual de referencia: `alpha/pedidos/templates/pos/pos-pedidos.html`.
- Paleta de colores fuente de verdad: `alpha/src/css/colors.css`.
- Módulo de referencia arquitectural: `alpha/pedidos/`.
- Propuesta de base de datos: `alpha/rrhh/docs/base-de-datos.md`.

### 1.5 Visión general del documento

- **Sección 2** describe el producto, sus funciones, perfiles de usuario y restricciones.
- **Sección 3** detalla los requerimientos funcionales (RF-01 a RF-07).
- **Sección 4** lista los requerimientos no funcionales.
- **Sección 5** presenta los casos de uso clave.
- **Sección 6** vincula cada mockup con su plantilla HTML y caso de uso.

---

## 2. Descripción General

### 2.1 Perspectiva del producto

El módulo RRHH es un submódulo dentro del ERP **Huubie**, siguiendo el patrón arquitectónico MVC establecido por `alpha/pedidos/`: `index.php` como punto de entrada, `ctrl/` para controladores, `mdl/` para modelos con PDO, `templates/` para vistas HTML, `sql/` para migraciones, `src/js/` para JavaScript con el framework propio `CoffeSoft` y `docs/` para documentación.

El módulo comparte la sesión de autenticación, el navbar, el sidebar y el sistema de sucursales con el resto del ERP. No es una aplicación aislada: convive con pedidos, eventos, administración e inventario.

### 2.2 Funciones del producto

1. **Gestión de personal** — altas, bajas, edición y consulta de colaboradores.
2. **Control de permisos** — solicitud, aprobación, rechazo y adjunto de comprobantes.
3. **Control de incidencias** — registro diario y visualización por rangos personalizados.
4. **Cálculo y aprobación de nómina** — por periodo y sucursal.
5. **Generación y consulta de recibos de nómina** — por colaborador.
6. **Dashboard de indicadores clave** — resumen visual del estado del área.
7. **Autorización de cambios sensibles** — re-autenticación con password para operaciones críticas.

### 2.3 Características de los usuarios

| Perfil | Rol | Permisos típicos |
|---|---|---|
| Admin general | 1 | Acceso total al módulo, autoriza cambios, aprueba nóminas |
| Gerente de sucursal | 2 | Ver/editar solo su sucursal, aprueba permisos |
| RRHH operativo | 3 | Captura incidencias y permisos, calcula nómina (no aprueba) |
| Colaborador | 4 | Consulta su propio recibo y sus permisos (fase futura) |

### 2.4 Restricciones

- **Stack fijo:** PHP 7.4+, MySQL 5.7+/8.0, PDO, jQuery 3.7, Tailwind CDN, Bootstrap 5, Chart.js 4.4, SweetAlert2, Select2, DataTables, DateRangePicker.
- **Bases de datos cruzadas:** `fayxzvov_alpha` (core), `fayxzvov_admin` (admin global), nueva `fayxzvov_rrhh` (este módulo). Las FKs entre bases son lógicas, no enforzadas por MySQL.
- **Sesión compartida** con `$_SESSION['USR']`, `$_SESSION['SUB']`, `$_SESSION['ROLID']`.
- **Paleta visual obligatoria:** los colores vienen de `alpha/src/css/colors.css`. No se pueden introducir colores nuevos que rompan el tema oscuro.
- **Re-autenticación obligatoria:** toda operación crítica debe pasar por el modal de autorización con password (RF-06).
- **Idioma:** español de México para toda la interfaz y mensajes.

### 2.5 Suposiciones y dependencias

- La tabla `usr_users` (en `fayxzvov_alpha` / `fayxzvov_admin`) ya existe y contiene los usuarios del sistema.
- La tabla `subsidiaries` ya tiene al menos dos sucursales configuradas.
- El frontend del ERP ya carga globalmente Chart.js, DataTables, SweetAlert2 y Select2 desde `alpha/pedidos/index.php` y similares.
- Existen archivos subidos al servidor bajo una ruta convenida (por definir en Fase 2) donde se guardarán fotos de empleados, comprobantes de permisos y documentos de expediente.

---

## 3. Requerimientos Específicos Funcionales

### RF-01 Gestión de Personal

**Descripción:** El sistema debe permitir el alta, baja, consulta y edición de colaboradores.

**Entradas:**
- Datos personales: nombre, apellido paterno, apellido materno, fecha de nacimiento, foto.
- Datos de contacto: teléfono, email.
- Datos fiscales/laborales: CURP, RFC, NSS, cuenta bancaria, banco.
- Datos laborales: puesto, turno, sucursal, fecha de ingreso, tipo de contrato (indefinido/temporal/honorarios/eventual), salario diario, frecuencia de pago.

**Procesamiento:**
- Al dar de alta, se inserta en `rrhh_empleados` con estado `activo`. Opcionalmente se enlaza a un registro existente en `usr_users` (si el colaborador tendrá login).
- Al dar de baja, se cambia `estado` a `baja`, se captura `fecha_baja` y `motivo_baja`. **No se borra físicamente** para preservar historial de nómina.
- La **edición del sueldo diario** requiere autorización con password (RF-06).
- La foto se sube vía modal drag & drop (RF-02 / CU-03).
- Los documentos de expediente (INE, CURP, RFC, contrato, etc.) se adjuntan en `rrhh_documentos_empleado`.

**Salidas:**
- Listado filtrable por sucursal, turno, puesto y estatus (activo/baja).
- Ficha individual del colaborador con datos, documentos e historial de permisos/incidencias.

**Plantilla HTML:** `rrhh-personal.html`

### RF-02 Control de Permisos

**Descripción:** Registrar, aprobar o rechazar solicitudes de permisos (vacaciones, incapacidad, permiso especial).

**Entradas:**
- Colaborador solicitante.
- Tipo de permiso: `incapacidad`, `vacaciones`, `permiso`.
- Fecha inicio y fecha fin (se calcula `dias`).
- Razón (texto libre).
- Archivo de solicitud (PDF o JPG, opcional).
- Archivo de comprobante (PDF o JPG, opcional).

**Procesamiento:**
- Al solicitar se crea registro en `rrhh_permisos` con estatus `pendiente` y `codigo` auto-generado (formato `PC-XXXX`).
- El gerente de sucursal o admin puede aprobar o rechazar. Ambas acciones requieren **autorización con password** (RF-06).
- Si se **aprueba** una incapacidad o vacaciones, el sistema inserta automáticamente incidencias en `rrhh_incidencias` para cada día del rango, con el estatus correspondiente y `permiso_id` apuntando al registro padre.
- Si se **rechaza**, se guarda `rechazado_por`, `rechazado_at` y opcionalmente `observaciones_aprobador`.
- Al adjuntar un comprobante, se abre el modal de upload drag & drop (CU-03) y se guarda la ruta en `comprobante_file`. Formatos permitidos: `.jpeg`, `.jpg`, `.pdf`. Tamaño máximo: 10 MB.

**Salidas:**
- Tabla paginable con badges de estatus (Aprobado verde, Rechazado rojo, Pendiente amarillo, Sin Estatus gris).
- Vista detalle del permiso con archivos adjuntos y historial.

**Plantillas HTML:** `rrhh-permisos.html`, `modal-permiso-form.html`, `modal-upload.html`, `modal-autorizacion.html`.

### RF-03 Control de Incidencias

**Descripción:** Registrar la asistencia diaria de los colaboradores y permitir la visualización por rango personalizado.

**Dos modos de vista:**

#### Vista Diaria (`rrhh-incidencia-diario.html`)

- Muestra el día seleccionado con una fila por colaborador.
- Columnas: Colaborador, Puesto, Turno, Tipo de Ingreso (Manual / Automático / Biométrico / Importado), Hora de entrada, Estatus.
- Estatus posibles: `atiempo` (verde), `retardo` (rojo), `falta` (rojo), `sin_estatus` (gris).
- El sistema calcula automáticamente `atiempo` vs `retardo` comparando `hora_entrada` contra `rrhh_turnos.hora_entrada` + `tolerancia_retardo_min`.
- Filtros: sucursal, turno, estatus.

#### Vista Personalizada (`rrhh-incidencia-personalizado.html`)

- Muestra un rango de días (típicamente una semana) con una columna por día.
- Cada celda es clickeable y abre un dropdown contextual con 5 opciones: **Incidencia**, **Falta**, **Asistencia**, **Vacaciones**, **Reconocimiento**.
- Al seleccionar una opción, se dispara el modal de autorización (RF-06). Si el password es correcto, se actualiza `rrhh_incidencias.estatus` del registro correspondiente.

**Entradas:**
- Filtros: sucursal, turno, rango de fechas, estatus.
- Cambio manual de estatus (requiere RF-06).

**Salidas:**
- Vista visual con dots de color y badges.
- Exportación a XLS (fase posterior).

### RF-04 Nómina

**Descripción:** Calcular, aprobar y generar recibos de nómina por periodo y sucursal.

**Flujo:**

1. **Apertura de periodo** — Admin crea un nuevo registro en `rrhh_nomina_periodos` con `frecuencia` (semanal / catorcenal / quincenal / mensual), `fecha_inicio`, `fecha_fin`, `subsidiaries_id`. Estado inicial: `abierta`.
2. **Cálculo automático** — El sistema recorre todos los colaboradores activos de la sucursal y para cada uno genera un registro en `rrhh_nomina_detalle` con:
   - `dias_laborados` = días con incidencia `atiempo` o `retardo` en el rango.
   - `dias_faltas`, `dias_vacaciones`, `dias_incapacidad` = conteos de incidencias.
   - `sueldo_diario` = snapshot de `rrhh_empleados.salario_diario` en el momento del cálculo.
   - `salario_total` = `dias_laborados * sueldo_diario`.
   - `bonos`, `incentivos`, `descuentos`, `extras` = valores iniciales en 0 (ajustables manualmente).
   - `faltas_retardos_descuento` = `dias_faltas * sueldo_diario`.
   - `a_pagar_efectivo`, `a_pagar_bancos` = se reparten según política (por definir).
   - `total_nomina` = suma final.
3. Estado del periodo pasa a `calculada`. La vista `rrhh-nomina.html` muestra un banner rojo "Nómina no aprobada".
4. **Revisión y ajustes** — Admin revisa la tabla. Puede ajustar bonos/descuentos/extras manualmente por colaborador.
5. **Aprobación** — Click en botón `Aprobar` → modal de autorización (RF-06) → si password correcto, `estatus = aprobada`, `aprobado_por`, `aprobado_at`.
6. **Generación de recibos** — Una vez aprobada, cada registro de `rrhh_nomina_detalle` recibe un `recibo_numero` y puede consultarse en `rrhh-nomina-recibo.html`.
7. **Pago** — Estado `pagada` (fase posterior, con integración a banca).

**Salidas:**
- Tabla consolidada de nómina del periodo (`rrhh-nomina.html`).
- Recibo HTML individual por colaborador (`rrhh-nomina-recibo.html`).
- Exportación XLS (fase posterior).
- Totales de efectivo y bancos visibles en el encabezado.

### RF-05 Dashboard / Resumen RRHH

**Descripción:** Página índice con indicadores clave agregados de todos los submódulos. Es la primera vista que ve el usuario al entrar al módulo.

**Métricas y componentes:**

- **4 stats cards:** Altas del periodo, Bajas del periodo, % Documentos completos, Vacantes abiertas.
- **Gráfico de línea** (Chart.js): empleados activos mes a mes con 2 datasets (Sucursal 1 y Sucursal 2 en líneas de color púrpura y cian).
- **Tabs del gráfico:** Alta, Bajas, Activos, Necesita contratación, Fatiga, Bloqueos, Ayuda.
- **Tabla de últimos permisos** (read-only, 10 filas) con las mismas columnas que `rrhh-permisos.html`.
- **3 KPI cards de nómina** del último periodo cerrado: Total efectivo, Total bancos, Promedio por colaborador.

**Plantilla HTML:** `rrhh-resumen.html`.

### RF-06 Autorización de cambios sensibles

**Descripción:** Toda operación crítica debe dispararse a través de un modal que pide la contraseña del usuario logueado.

**Operaciones que requieren autorización:**

- Aprobar o rechazar un permiso.
- Cambiar el estatus de una incidencia en vista personalizada.
- Aprobar una nómina.
- Editar el salario diario de un colaborador.
- Dar de baja a un colaborador.
- Eliminar cualquier documento del expediente.

**Procesamiento:**

1. La acción del usuario (click en "Aprobar", "Dar de baja", etc.) en lugar de ejecutarse directamente, abre `modal-autorizacion.html`.
2. Usuario ingresa su contraseña.
3. POST a `ctrl-rrhh-autorizacion.php` (fase 2) con `{accion, registro_id, tabla, valor_nuevo, password}`.
4. El controlador valida `password_verify($password, $usr_users.password_hash)`.
5. Si coincide: ejecuta la acción pendiente y registra en `rrhh_autorizaciones_log` con `usr_users_id`, `accion`, `tabla_afectada`, `registro_id`, `valor_anterior`, `valor_nuevo`, `ip`, `user_agent`, `created_at`.
6. Si no coincide: error con SweetAlert2, no se ejecuta nada, no se registra en log.

**Plantilla HTML:** `modal-autorizacion.html`.

### RF-07 Submódulos de fase posterior

Los siguientes submódulos aparecen en el sidebar de los mockups pero **quedan fuera del alcance de la Fase 1**. Se marcan como "En desarrollo" en la UI:

- **Reclutamiento** — vacantes, candidatos, entrevistas, pipeline.
- **Desempeño** — evaluaciones periódicas, KPIs por colaborador.
- **Cursos** — capacitaciones asignadas, certificaciones, vencimientos.
- **Actas** — actas administrativas, llamadas de atención, firmas.
- **Reconocimientos** — premios, bonos por mérito, empleado del mes.
- **Configuración** — catálogos de puestos, turnos, reglas de nómina, parámetros.

---

## 4. Requerimientos No Funcionales

### RNF-01 Seguridad

- Toda operación pasa por `session_start()` y valida `$_SESSION['USR']`.
- Operaciones críticas requieren re-autenticación (RF-06).
- Passwords almacenados con `password_hash()` (bcrypt) en `usr_users`.
- Validación **server-side** en los controladores; nunca confiar en datos del frontend.
- Uso exclusivo de **prepared statements** PDO (`_CRUD.php` ya los garantiza).
- Archivos subidos se validan por MIME type **y** extensión. Se rechazan ejecutables.
- Ruta de uploads **fuera del webroot** o con `.htaccess` que niegue la ejecución de PHP.

### RNF-02 Rendimiento

- Tablas con hasta 500 colaboradores deben cargar en **< 1 segundo**.
- Tablas con > 1000 registros usan DataTables con `serverSide: true`.
- Índices MySQL en todas las llaves foráneas y en columnas de filtro frecuente (`fecha`, `estatus`, `subsidiaries_id`).
- El gráfico de Chart.js en `rrhh-resumen.html` usa datos pre-agregados (no calcula sobre la marcha).

### RNF-03 Usabilidad

- Lenguaje español México en toda la interfaz.
- Badges de color consistentes en todo el módulo:
  - **Verde** = OK / Aprobado / A tiempo / Asistencia.
  - **Rojo** = Error / Rechazado / Falta / Retardo / Baja.
  - **Amarillo** = Pendiente / Vacaciones (en algunos contextos).
  - **Gris** = Sin estatus / Neutro.
  - **Púrpura** = Tipo `vacaciones` (tipo de permiso) / puesto Admin.
  - **Naranja** = Tipo `permiso` (tipo de permiso) / Incidencia.
- Todas las confirmaciones y errores usan SweetAlert2.
- Modales centrados, bloqueantes (backdrop `bg-black/60`) para acciones críticas.
- Teclado: `Esc` cierra modales, `Enter` confirma la acción principal.

### RNF-04 Compatibilidad

- Navegadores soportados: Chrome, Edge, Firefox, Safari (últimas 2 versiones).
- Resolución mínima de escritorio: 1024 px de ancho.
- Responsive básico para tablets (no móviles en Fase 1).
- PHP 7.4+ / MySQL 5.7+ / MariaDB 10.3+.
- El módulo debe coexistir sin conflictos con `alpha/pedidos/`, `alpha/eventos/`, `alpha/admin/`, `alpha/calendario/`.

### RNF-05 Mantenibilidad

- Código PHP sigue las convenciones de `alpha/pedidos/` (controlador extiende modelo, modelo extiende `_CRUD.php`).
- JavaScript modular siguiendo el framework propio `CoffeSoft` (`Complements → Components → Templates`).
- Nombres de tablas **prefijados con `rrhh_`** para evitar colisiones con otros módulos.
- Documentación en `alpha/rrhh/docs/` (este ERS, `base-de-datos.md`, futuros manuales).
- Commits siguiendo Conventional Commits: `feat(rrhh): ...`, `fix(rrhh): ...`.

### RNF-06 Trazabilidad

- Toda inserción/modificación registra `created_at`, `created_by`, `updated_at`, `updated_by`.
- Las acciones autorizadas (RF-06) quedan registradas en `rrhh_autorizaciones_log` con `valor_anterior` y `valor_nuevo` en JSON.
- Los archivos subidos guardan `subido_por` y `created_at`.
- Los cambios de estatus de periodo de nómina (`abierta → calculada → aprobada → pagada`) se registran con usuario y timestamp.

### RNF-07 Internacionalización

- Aunque la UI es en español, las claves de BD están en inglés parcial (`created_at`, `updated_at`) para consistencia con el resto del ERP.
- Los enums de BD usan valores en español (`activo`, `baja`, `aprobado`) porque son códigos de negocio.
- No se contempla traducción a otros idiomas en Fase 1.

---

## 5. Casos de uso clave

### CU-01 Solicitar permiso

- **Actor:** RRHH operativo.
- **Precondición:** El colaborador existe y está activo.
- **Flujo principal:**
  1. Usuario entra a `rrhh-permisos.html`.
  2. Click en botón `Solicitar` (púrpura) → abre `modal-permiso-form.html`.
  3. Captura tipo, fechas, razón y (opcional) archivo de solicitud.
  4. Click `Enviar`.
  5. Sistema inserta registro en `rrhh_permisos` con estatus `pendiente`.
  6. Tabla se refresca.
- **Flujo alterno:** Si cambia de opinión, click en `Cancelar` cierra el modal sin guardar.

### CU-02 Aprobar permiso

- **Actor:** Gerente de sucursal.
- **Precondición:** Existe un permiso con estatus `pendiente`.
- **Flujo principal:**
  1. Usuario entra a `rrhh-permisos.html`.
  2. Click en la fila del permiso pendiente → abre modal con detalles.
  3. Revisa razón y comprobante (si existe).
  4. Click `Enviar` (botón verde).
  5. Sistema abre `modal-autorizacion.html`.
  6. Usuario ingresa su password.
  7. Si correcto: permiso pasa a `aprobado`, se crean incidencias automáticas en `rrhh_incidencias` para el rango, se loguea en `rrhh_autorizaciones_log`.
  8. Tabla se refresca mostrando badge `Aprobado` verde.
- **Flujo alterno:** Password incorrecto → SweetAlert2 de error, no se guarda nada.

### CU-03 Adjuntar comprobante de permiso

- **Actor:** RRHH operativo.
- **Precondición:** El permiso existe.
- **Flujo principal:**
  1. En la tabla de `rrhh-permisos.html`, click en el ícono `Comprobante` de la fila.
  2. Abre `modal-upload.html` con drag & drop.
  3. Usuario arrastra un `.pdf` o `.jpg` (o hace click en `upload file`).
  4. Click `Enable` → archivo se sube al servidor.
  5. Sistema guarda la ruta en `rrhh_permisos.comprobante_file`.
  6. El ícono de la fila cambia a estado "con comprobante".

### CU-04 Cambiar estatus de un día en vista personalizada

- **Actor:** Gerente de sucursal.
- **Precondición:** Existe un registro de incidencia para ese día/colaborador.
- **Flujo principal:**
  1. En `rrhh-incidencia-personalizado.html`, click en la celda del día de un colaborador.
  2. Aparece dropdown contextual con 5 opciones (Incidencia, Falta, Asistencia, Vacaciones, Reconocimiento).
  3. Usuario selecciona una opción (ej. cambiar `Falta` → `Vacaciones`).
  4. Sistema abre `modal-autorizacion.html`.
  5. Password correcto → UPDATE en `rrhh_incidencias.estatus`, log en `rrhh_autorizaciones_log`.
  6. La celda se actualiza visualmente con el nuevo color.

### CU-05 Aprobar nómina del periodo

- **Actor:** Admin general.
- **Precondición:** Existe un periodo con estatus `calculada`.
- **Flujo principal:**
  1. Usuario entra a `rrhh-nomina.html`.
  2. Ve banner rojo "Nómina no aprobada" y la tabla con todos los colaboradores y sus totales.
  3. Revisa, ajusta bonos/descuentos manualmente si es necesario.
  4. Click en botón `Aprobar` (verde, botonera pie).
  5. Sistema abre `modal-autorizacion.html`.
  6. Password correcto → periodo pasa a `aprobada`, banner rojo desaparece, se habilita `Ver Recibo`, log en `rrhh_autorizaciones_log`.

### CU-06 Consultar recibo individual

- **Actor:** Admin o Gerente.
- **Precondición:** Existe un periodo con estatus `aprobada`.
- **Flujo principal:**
  1. Desde `rrhh-nomina.html`, click en `Ver Recibo` de una fila → abre `rrhh-nomina-recibo.html`.
  2. Se muestra el card de recibo con desglose de pago (Salario Total, Salario Diario, Bonos, Descuentos, Extras, Resumen Efectivo/Bancos).
  3. En el panel lateral derecho, usuario puede navegar entre los otros colaboradores del mismo periodo.
  4. Click en `Download Full` (futuro) descarga el PDF del recibo.

---

## 6. Wireframes de referencia

Los wireframes visuales son los 12 archivos PNG en `alpha/rrhh/images-templates/`. Correspondencia con las plantillas HTML y los casos de uso:

| Imagen | Plantilla HTML resultante | Caso de uso ilustrado |
|---|---|---|
| `resumen rrrhh.png` | `rrhh-resumen.html` | RF-05 Dashboard |
| `permisos.png` | `rrhh-permisos.html` (variante sin ID/fecha) | RF-02 listado |
| `permisos-2.png` | `rrhh-permisos.html` (versión con ID y FECHA) | RF-02 listado |
| `permiso-3.png` | `modal-permiso-form.html` | CU-01 solicitar |
| `permiso-4.png` | `modal-permiso-form.html` con datepicker | CU-01 solicitar |
| `incidencia.png` | `rrhh-incidencia-diario.html` | RF-03 vista diaria |
| `incidencia-2.png` | Datepicker del toggle Personalizada | RF-03 selección rango |
| `incidencia-3.png` | `rrhh-incidencia-personalizado.html` | CU-04 cambio estatus |
| `nomina.png` | `rrhh-nomina.html` | RF-04 cálculo |
| `nomina-2.png` | `rrhh-nomina-recibo.html` | CU-06 consulta recibo |
| `Screenshot_1.png` | `modal-upload.html` | CU-03 adjuntar |
| `Screenshot_2.png` | `modal-autorizacion.html` | RF-06 autorización |

---

## Anexo A — Notación de badges

Las plantillas HTML definen clases CSS reutilizables para los badges, declaradas en el bloque `<style>` baseline de cada plantilla:

| Clase | Uso | Color principal |
|---|---|---|
| `badge-aprobado` | Estatus permisos/nómina | `#3fc189` verde |
| `badge-rechazado` | Estatus permisos/nómina | `#ea0234` rojo |
| `badge-pendiente` | Estatus permisos | `#fbbf24` amarillo |
| `badge-sin-estatus` | Estatus incidencias/permisos | `#9ca3af` gris |
| `badge-atiempo` | Estatus incidencias | `#3fc189` verde |
| `badge-retardo` | Estatus incidencias | `#ea0234` rojo |
| `badge-falta` | Estatus incidencias | `#ea0234` rojo |
| `badge-incapacidad` | Tipo de permiso | `#f472b6` rosa |
| `badge-vacaciones` | Tipo de permiso | `#c4b5fd` púrpura claro |
| `badge-permiso` | Tipo de permiso | `#fb923c` naranja |
| `badge-puesto-admin` | Puesto en tablas | púrpura |
| `badge-puesto-cocina` | Puesto en tablas | púrpura |
| `badge-puesto-piso` | Puesto en tablas | azul |

---

## Anexo B — Historial de versiones

| Versión | Fecha | Autor | Cambios |
|---|---|---|---|
| 1.0 | 2026-04-08 | Equipo Huubie | Versión inicial – Fase 1 |
