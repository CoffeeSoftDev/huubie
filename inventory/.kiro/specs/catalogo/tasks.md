# Implementation Plan - Módulo Catálogo

- [x] 1. Configurar estructura base del proyecto


  - Crear estructura de carpetas para el módulo
  - Configurar archivos de entrada (index.php)
  - Establecer rutas y configuración de base de datos
  - _Requirements: 5.1_



- [x] 2. Implementar modelo de datos (mdl-catalogo.php)


  - _Requirements: 5.1, 5.2_

- [ ] 2.1 Crear clase base del modelo
  - Extender clase CRUD

  - Configurar propiedades $bd y $util
  - Establecer conexión con base de datos
  - _Requirements: 5.2_

- [ ] 2.2 Implementar métodos para Categorías
  - Crear método listCategory() para consultar categorías activas
  - Crear método getCategoryById() para obtener categoría específica
  - Crear método createCategory() para insertar nuevas categorías

  - Crear método updateCategory() para actualizar categorías
  - Crear método deleteCategoryById() para eliminar categorías
  - Crear método existsCategoryByName() para validar duplicados
  - _Requirements: 1.2, 1.3, 1.4, 6.2_

- [ ] 2.3 Implementar métodos para Áreas
  - Crear método listArea() para consultar áreas activas
  - Crear método getAreaById() para obtener área específica

  - Crear método createArea() para insertar nuevas áreas
  - Crear método updateArea() para actualizar áreas
  - Crear método deleteAreaById() para eliminar áreas
  - Crear método existsAreaByName() para validar duplicados
  - _Requirements: 2.2, 2.3, 2.4, 2.5_

- [x] 2.4 Implementar métodos para Zonas


  - Crear método listZone() para consultar zonas activas
  - Crear método getZoneById() para obtener zona específica


  - Crear método createZone() para insertar nuevas zonas
  - Crear método updateZone() para actualizar zonas
  - Crear método deleteZoneById() para eliminar zonas
  - Crear método existsZoneByName() para validar duplicados
  - _Requirements: 3.2, 3.3, 3.4_


- [ ] 3. Implementar controlador (ctrl-catalogo.php)
  - _Requirements: 5.1, 5.2_

- [ ] 3.1 Crear clase base del controlador
  - Extender clase mdl
  - Configurar validación de sesión
  - Establecer headers CORS

  - Implementar método init() para datos iniciales
  - _Requirements: 5.2_

- [ ] 3.2 Implementar endpoints para Categorías
  - Crear método lsCategory() para listar en tabla
  - Crear método getCategory() para obtener por ID
  - Crear método addCategory() con validación de duplicados
  - Crear método editCategory() para actualizar

  - Crear método deleteCategory() con confirmación
  - Implementar sanitización de datos con $this->util->sql()
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 6.1, 6.2, 6.4, 6.5_

- [ ] 3.3 Implementar endpoints para Áreas
  - Crear método lsArea() para listar en tabla
  - Crear método getArea() para obtener por ID
  - Crear método addArea() con validación de duplicados

  - Crear método editArea() para actualizar
  - Crear método deleteArea() con verificación de zonas asociadas
  - Implementar sanitización de datos
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 6.1, 6.2, 6.4, 6.5_



- [x] 3.4 Implementar endpoints para Zonas


  - Crear método lsZone() para listar en tabla
  - Crear método getZone() para obtener por ID
  - Crear método addZone() con validación de duplicados
  - Crear método editZone() para actualizar
  - Crear método deleteZone() con confirmación
  - Implementar sanitización de datos

  - _Requirements: 3.2, 3.3, 3.4, 3.5, 6.1, 6.2, 6.4, 6.5_

- [ ] 3.5 Implementar funciones auxiliares del controlador
  - Crear función renderStatus() para badges de estado
  - Crear función dropdown() para menús de acciones
  - Implementar manejo de errores estandarizado
  - _Requirements: 6.4, 6.5_

- [x] 4. Implementar frontend JavaScript (catalogo.js)

  - _Requirements: 5.1, 5.3, 5.4_

- [ ] 4.1 Crear clase App principal
  - Extender clase Templates de CoffeeSoft
  - Configurar PROJECT_NAME y api
  - Implementar método render() para inicialización
  - Implementar método layout() con tabLayout
  - Crear estructura de pestañas navegables
  - _Requirements: 4.1, 4.2, 4.5, 5.3_


- [ ] 4.2 Implementar clase Category
  - Extender clase Templates
  - Crear método lsCategory() con createTable
  - Crear método addCategory() con createModalForm
  - Crear método editCategory() con useFetch y autofill
  - Crear método deleteCategory() con swalQuestion
  - Crear método filterBarCategory() con createfilterBar
  - Crear método jsonCategory() con estructura de formulario

  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.3, 5.4, 6.1, 6.3_

- [ ] 4.3 Implementar clase Area
  - Extender clase Templates
  - Crear método lsArea() con createTable


  - Crear método addArea() con createModalForm
  - Crear método editArea() con useFetch y autofill

  - Crear método deleteArea() con swalQuestion
  - Crear método filterBarArea() con createfilterBar
  - Crear método jsonArea() con estructura de formulario
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 5.3, 5.4, 6.1, 6.3_

- [ ] 4.4 Implementar clase Zone
  - Extender clase Templates

  - Crear método lsZone() con createTable
  - Crear método addZone() con createModalForm
  - Crear método editZone() con useFetch y autofill
  - Crear método deleteZone() con swalQuestion



  - Crear método filterBarZone() con createfilterBar
  - Crear método jsonZone() con estructura de formulario
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 5.3, 5.4, 6.1, 6.3_

- [ ] 4.5 Implementar validaciones frontend
  - Validar campos vacíos antes de enviar
  - Validar longitud máxima de campos (255 caracteres)
  - Implementar mensajes de error descriptivos
  - Configurar validación automática en formularios
  - _Requirements: 6.1_

- [ ] 5. Crear interfaz de usuario (index.php)
  - _Requirements: 4.1, 4.3, 4.5_

- [ ] 5.1 Configurar estructura HTML base
  - Incluir validación de sesión
  - Cargar layout/head.php y layout/core-libraries.php
  - Incluir CoffeeSoft Framework (coffeSoft.js y plugins.js)
  - Crear contenedor root para la aplicación
  - Configurar breadcrumb de navegación
  - _Requirements: 4.1, 4.3, 5.1_

- [ ] 5.2 Integrar estilos y tema
  - Aplicar theme 'light' de CoffeeSoft
  - Configurar TailwindCSS para componentes
  - Establecer consistencia visual con template corporativo
  - _Requirements: 4.3_

- [ ] 6. Checkpoint - Verificar funcionalidad básica
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implementar características avanzadas
  - _Requirements: 4.4_

- [ ] 7.1 Agregar contador de registros por pestaña
  - Mostrar total de categorías activas
  - Mostrar total de áreas activas
  - Mostrar total de zonas activas
  - Actualizar contadores después de operaciones CRUD
  - _Requirements: 4.4_

- [ ] 7.2 Implementar filtros avanzados
  - Agregar filtro por estado (activo/inactivo)
  - Agregar búsqueda por nombre
  - Implementar ordenamiento de columnas
  - _Requirements: 4.4_

- [ ] 7.3 Mejorar experiencia de usuario
  - Agregar animaciones de transición entre pestañas
  - Implementar loading states durante peticiones AJAX
  - Agregar tooltips informativos
  - Mejorar mensajes de confirmación
  - _Requirements: 4.2, 4.3_

- [ ]*8. Implementar pruebas unitarias
  - _Requirements: 5.2, 5.3_

- [ ]*8.1 Crear pruebas para el modelo
  - Test para listCategory() con diferentes filtros
  - Test para createCategory() con datos válidos
  - Test para existsCategoryByName() con duplicados
  - Test para updateCategory() y deleteCategory()
  - Repetir para Area y Zone
  - _Requirements: 5.2_

- [ ]*8.2 Crear pruebas para el controlador
  - Test para addCategory() con validación de duplicados
  - Test para editCategory() con datos válidos e inválidos
  - Test para deleteCategory() con confirmación
  - Test para manejo de errores y respuestas JSON
  - Repetir para Area y Zone
  - _Requirements: 5.2_

- [ ]*8.3 Crear pruebas de integración frontend
  - Test para flujo completo CRUD de categorías
  - Test para navegación entre pestañas
  - Test para validaciones de formulario
  - Test para actualización automática de listados
  - _Requirements: 5.3_

- [ ] 9. Checkpoint final - Verificar sistema completo
  - Ensure all tests pass, ask the user if questions arise.

- [ ]*10. Documentación y optimización
  - _Requirements: 5.1_

- [ ]*10.1 Crear documentación técnica
  - Documentar estructura de base de datos
  - Documentar API endpoints del controlador
  - Documentar componentes y métodos del frontend
  - Crear guía de uso para usuarios finales
  - _Requirements: 5.1_

- [ ]*10.2 Optimizar rendimiento
  - Implementar caché para consultas frecuentes
  - Optimizar consultas SQL con índices
  - Minimizar peticiones AJAX redundantes
  - Implementar lazy loading para tablas grandes
  - _Requirements: 5.2_
