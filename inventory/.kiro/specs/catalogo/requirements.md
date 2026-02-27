# Requirements Document - Módulo Catálogo

## Introduction

El módulo de Catálogo es un componente fundamental del sistema de gestión de almacén que permite administrar la estructura organizacional base mediante la gestión de Categorías, Áreas y Zonas. Este módulo proporciona una interfaz modular con pestañas para facilitar la navegación y administración de cada elemento estructural del almacén.

## Glossary

- **Sistema**: Aplicación web de gestión de almacén desarrollada con CoffeeSoft Framework
- **Catálogo**: Módulo administrativo para gestionar la estructura base del almacén
- **Categoría**: Clasificación principal de materiales e insumos del almacén
- **Área**: Espacio físico del almacén donde se organizan los materiales
- **Zona**: Subdivisión interna de un área para distribución detallada de insumos
- **Usuario**: Persona con acceso al sistema (administrador o encargado de almacén)
- **Interfaz**: Componente visual del sistema basado en CoffeeSoft Framework
- **Pestaña**: Elemento de navegación que permite cambiar entre secciones sin recargar la página

## Requirements

### Requirement 1

**User Story:** Como administrador del sistema, quiero gestionar las categorías de materiales, para mantener organizado el inventario por tipos principales de artículos.

#### Acceptance Criteria

1. WHEN el usuario accede al módulo Catálogo THEN el Sistema SHALL mostrar la pestaña "Categorías" como vista activa por defecto
2. WHEN el usuario ingresa un nombre de categoría y presiona el botón agregar THEN el Sistema SHALL validar que el campo no esté vacío y crear un nuevo registro en la tabla mtto_categoria
3. WHEN una categoría es creada exitosamente THEN el Sistema SHALL asignar un idcategoria único y mostrar la categoría en el listado con su ID correspondiente
4. WHEN el usuario presiona el botón eliminar en una categoría THEN el Sistema SHALL solicitar confirmación y eliminar el registro de la base de datos
5. WHEN una categoría es agregada o eliminada THEN el Sistema SHALL actualizar automáticamente el listado de categorías sin recargar la página completa

### Requirement 2

**User Story:** Como administrador del almacén, quiero registrar y controlar las áreas del almacén, para organizar físicamente los espacios donde se clasifican los materiales.

#### Acceptance Criteria

1. WHEN el usuario selecciona la pestaña "Áreas" THEN el Sistema SHALL mostrar el formulario de registro de áreas y el listado de áreas existentes
2. WHEN el usuario ingresa un nombre de área y presiona agregar THEN el Sistema SHALL validar que el nombre no esté vacío y crear un nuevo registro en la tabla mtto_almacen_area
3. WHEN un área es creada exitosamente THEN el Sistema SHALL asignar un idArea único y mostrar el área en el listado
4. WHEN el usuario intenta agregar un área con nombre duplicado THEN el Sistema SHALL mostrar un mensaje de error y prevenir la creación del registro
5. WHEN el usuario presiona el botón eliminar en un área THEN el Sistema SHALL verificar que no existan zonas asociadas y eliminar el registro

### Requirement 3

**User Story:** Como encargado de almacén, quiero administrar las zonas internas del almacén, para distribuir correctamente la ubicación de los insumos dentro de cada área.

#### Acceptance Criteria

1. WHEN el usuario selecciona la pestaña "Zonas" THEN el Sistema SHALL mostrar el formulario de registro de zonas y el listado de zonas existentes
2. WHEN el usuario ingresa un nombre de zona y presiona agregar THEN el Sistema SHALL validar que el campo no esté vacío y crear un nuevo registro en la tabla mtto_almacen_zona
3. WHEN una zona es creada exitosamente THEN el Sistema SHALL asignar un id_zona único y mostrar la zona en el listado
4. WHEN el usuario presiona el botón eliminar en una zona THEN el Sistema SHALL solicitar confirmación y eliminar el registro de la base de datos
5. WHEN una zona es eliminada THEN el Sistema SHALL actualizar automáticamente el listado de zonas sin recargar la página

### Requirement 4

**User Story:** Como usuario del sistema, quiero acceder a un módulo organizado en pestañas, para navegar entre categorías, áreas y zonas sin perder la estructura visual.

#### Acceptance Criteria

1. WHEN el usuario accede al módulo Catálogo THEN el Sistema SHALL mostrar un encabezado con el título "📦 Catálogo" y una descripción funcional del módulo
2. WHEN el usuario hace clic en una pestaña THEN el Sistema SHALL cambiar la vista activa sin recargar toda la página utilizando el componente tabLayout de CoffeeSoft
3. WHEN el Sistema muestra cada sección THEN el Sistema SHALL mantener consistencia visual con el template corporativo definido en los pivotes
4. WHEN el usuario visualiza una pestaña THEN el Sistema SHALL mostrar el total de registros existentes en esa sección
5. WHEN el Sistema renderiza el módulo THEN el Sistema SHALL utilizar el primaryLayout de CoffeeSoft con filterBar y container para cada pestaña

### Requirement 5

**User Story:** Como desarrollador del sistema, quiero que el módulo siga la arquitectura MVC de CoffeeSoft, para mantener el código organizado y reutilizable.

#### Acceptance Criteria

1. WHEN el módulo es implementado THEN el Sistema SHALL crear los archivos ctrl-catalogo.php, mdl-catalogo.php y catalogo.js en las carpetas correspondientes
2. WHEN el controlador procesa una petición THEN el Sistema SHALL utilizar los métodos del modelo para acceder a la base de datos siguiendo las reglas de MDL.md
3. WHEN el frontend realiza una petición THEN el Sistema SHALL utilizar useFetch para comunicarse con el controlador siguiendo las reglas de FRONT JS.md
4. WHEN se crean formularios THEN el Sistema SHALL utilizar createForm o createModalForm de CoffeeSoft con validación automática
5. WHEN se muestran listados THEN el Sistema SHALL utilizar createTable de CoffeeSoft con soporte para DataTables y paginación

### Requirement 6

**User Story:** Como administrador del sistema, quiero que las operaciones CRUD sean seguras y validadas, para mantener la integridad de los datos del catálogo.

#### Acceptance Criteria

1. WHEN el usuario intenta agregar un registro THEN el Sistema SHALL validar que todos los campos requeridos estén completos antes de enviar al backend
2. WHEN el controlador recibe una petición de creación THEN el Sistema SHALL validar la existencia de registros duplicados antes de insertar en la base de datos
3. WHEN el usuario intenta eliminar un registro THEN el Sistema SHALL mostrar un diálogo de confirmación usando swalQuestion de CoffeeSoft
4. WHEN una operación es exitosa THEN el Sistema SHALL mostrar un mensaje de éxito con status 200 y actualizar la vista automáticamente
5. WHEN una operación falla THEN el Sistema SHALL mostrar un mensaje de error descriptivo con status 500 o 409 según corresponda
