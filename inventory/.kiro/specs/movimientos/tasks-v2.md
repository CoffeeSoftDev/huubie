# Implementation Plan - Módulo de Movimientos v2.0 (Por Grupos)

## Overview

Este plan de implementación detalla las tareas necesarias para reestructurar el módulo de movimientos de inventario, cambiando de organización por "almacén" a organización por "grupo" (categorías de productos). El plan sigue un enfoque incremental, construyendo sobre la estructura existente y validando cada componente antes de continuar.

---

## Tasks

- [x] 1. Actualizar modelo de datos (mdl-movimientos.php)


  - Modificar consultas SQL para usar `mtto_almacen.id_categoria` en lugar de zonas
  - Implementar método `lsGrupos()` para obtener lista de grupos activos
  - Actualizar método `listMovimientos()` con JOIN a tabla de categorías
  - Implementar método `getResumenMovimientos()` con cálculos por grupo
  - _Requirements: 2.3, 5.5, 6.4_

- [ ]* 1.1 Escribir property test para filtrado por grupo
  - **Property 1: Filter consistency by group**
  - **Validates: Requirements 2.1, 2.2, 2.3**



- [ ] 2. Actualizar controlador (ctrl-movimientos.php)
  - Modificar método `init()` para retornar lista de grupos en lugar de almacenes
  - Actualizar método `lsMovimientos()` para recibir parámetro `grupo` en lugar de `almacen`
  - Implementar cálculo de resumen con balance dinámico
  - Formatear respuesta JSON con información de grupos
  - _Requirements: 2.1, 2.2, 2.3, 3.4_

- [x]* 2.1 Escribir property test para cálculo de balance


  - **Property 2: Balance calculation accuracy**
  - **Validates: Requirements 3.4**

- [ ] 3. Actualizar frontend - Filtros (movimientos.js)
  - Modificar método `filterBar()` para usar filtro de "Grupo" en lugar de "Almacén"
  - Implementar pre-selección automática de mes y año actual
  - Configurar evento `onchange` para actualización dinámica
  - Agregar opción "Todos los grupos" como valor por defecto
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 9.1, 9.2, 9.3_



- [ ]* 3.1 Escribir property test para pre-selección de filtros
  - **Property 8: Pre-selection accuracy**
  - **Validates: Requirements 9.1, 9.2**

- [ ] 4. Actualizar frontend - Tarjetas resumen (movimientos.js)
  - Modificar método `summaryCards()` para incluir balance dinámico con colores
  - Implementar lógica de cambio de color (verde para positivo, rojo para negativo)
  - Agregar prefijos "+" y "-" según el valor del balance

  - Actualizar iconos y estilos de tarjetas
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 8.1, 8.2, 8.3_

- [ ]* 4.1 Escribir property test para balance dinámico
  - **Property 7: Dynamic balance color**
  - **Validates: Requirements 8.1, 8.2**

- [ ] 5. Actualizar frontend - Tabla de movimientos (movimientos.js)
  - Modificar método `lsMovimientos()` para mostrar columna "Grupo" en lugar de "Almacén"
  - Actualizar configuración de `createTable()` con nuevas columnas
  - Implementar formato de cantidades con prefijos "+" y "-"
  - Configurar badges de color para tipo de movimiento (verde/rojo)
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_


- [ ]* 5.1 Escribir property test para formato de cantidades
  - **Property 4: Quantity sign consistency**
  - **Validates: Requirements 4.3**

- [ ]* 5.2 Escribir property test para badges de tipo
  - **Property 3: Movement type badge color coding**
  - **Validates: Requirements 4.2**

- [ ] 6. Implementar actualización dinámica de tarjetas resumen
  - Conectar respuesta del backend con actualización de tarjetas


  - Implementar lógica de actualización de valores en `cardTotal`, `cardEntradas`, `cardSalidas`
  - Implementar cambio dinámico de color en `cardBalance`
  - Agregar animaciones de transición (opcional)
  - _Requirements: 3.5, 8.3_

- [ ]* 6.1 Escribir property test para sincronización de tarjetas
  - **Property 10: Summary card synchronization**
  - **Validates: Requirements 3.5**

- [x] 7. Implementar manejo de errores y casos especiales


  - Agregar manejo de error en peticiones AJAX
  - Implementar mensaje para resultados vacíos
  - Validar selección de grupo inválido
  - Agregar indicadores de carga durante peticiones
  - _Requirements: 1.5, 2.5_



- [ ]* 7.1 Escribir unit tests para manejo de errores
  - Test de error de conexión
  - Test de resultados vacíos
  - Test de grupo inválido

- [ ] 8. Optimizar consultas SQL y agregar índices
  - Crear índice en `mtto_almacen.id_categoria`
  - Optimizar consulta `listMovimientos()` con índices compuestos

  - Implementar LIMIT para paginación inicial
  - Agregar caché de lista de grupos

  - _Performance optimization_

- [ ] 9. Actualizar validaciones de datos
  - Validar que grupo existe antes de consultar
  - Validar formato de mes y año
  - Sanitizar parámetros POST en controlador
  - Implementar validación de permisos de usuario
  - _Requirements: 6.1, 6.3, 6.4_

- [ ]* 9.1 Escribir property test para validación de grupo
  - **Property 6: Group association consistency**


  - **Validates: Requirements 5.5**

- [ ] 10. Checkpoint - Verificar funcionalidad completa
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Actualizar documentación y comentarios
  - Actualizar comentarios en código JavaScript
  - Documentar nuevos métodos en controlador y modelo
  - Actualizar README si existe
  - Crear guía de usuario para nuevos filtros
  - _Documentation_

- [ ]* 11.1 Crear documentación de API
  - Documentar endpoints del controlador
  - Documentar estructura de respuestas JSON
  - Documentar parámetros de filtros

- [ ] 12. Testing de integración y validación final
  - Probar flujo completo: filtros → backend → respuesta → UI
  - Validar pre-selección de filtros al cargar
  - Validar actualización dinámica sin recarga
  - Validar colores dinámicos del balance
  - Validar formato de tabla con grupos
  - _Integration testing_

- [ ]* 12.1 Escribir tests de integración
  - Test de flujo completo de filtrado
  - Test de actualización de tarjetas resumen
  - Test de renderizado de tabla

---

## Implementation Notes

### Orden de Ejecución

1. **Backend primero (Tasks 1-2):** Asegurar que el modelo y controlador estén listos antes de modificar el frontend
2. **Frontend por componentes (Tasks 3-5):** Actualizar filtros, tarjetas y tabla de forma incremental
3. **Integración (Tasks 6-7):** Conectar todos los componentes y manejar errores
4. **Optimización (Tasks 8-9):** Mejorar performance y seguridad
5. **Validación (Tasks 10-12):** Testing completo y documentación

### Dependencias

- Task 2 depende de Task 1 (modelo debe estar listo para controlador)
- Tasks 3, 4, 5 dependen de Task 2 (frontend necesita API del backend)
- Task 6 depende de Tasks 3, 4, 5 (integración requiere componentes individuales)
- Task 10 depende de Tasks 1-9 (checkpoint requiere funcionalidad completa)

### Testing Strategy

- **Property-based tests (*):** Ejecutar con mínimo 100 iteraciones
- **Unit tests (*):** Validar componentes individuales
- **Integration tests (*):** Validar flujo completo end-to-end
- Todos los tests deben pasar antes del checkpoint (Task 10)

### Rollback Plan

Si se encuentran problemas críticos:
1. Mantener archivos originales como backup (`movimientos.js.bak`, etc.)
2. Usar control de versiones (Git) para revertir cambios
3. Documentar problemas encontrados para resolución posterior

### Performance Targets

- Tiempo de carga inicial: < 2 segundos
- Tiempo de actualización de filtros: < 1 segundo
- Consultas SQL: < 500ms
- Renderizado de tabla: < 300ms

### Security Checklist

- [ ] Validar todos los parámetros POST
- [ ] Usar prepared statements en consultas SQL
- [ ] Verificar sesión de usuario activa
- [ ] Sanitizar salida HTML
- [ ] Implementar rate limiting en API (opcional)

---

## Post-Implementation Tasks

Después de completar la implementación principal:

1. **Monitoreo:** Observar logs de errores durante primera semana
2. **Feedback:** Recopilar comentarios de usuarios sobre nueva interfaz
3. **Optimización:** Ajustar índices SQL según patrones de uso reales
4. **Documentación:** Actualizar manual de usuario con capturas de pantalla
5. **Training:** Capacitar usuarios sobre nuevos filtros por grupo

---

## Success Criteria

La implementación se considera exitosa cuando:

✅ Todos los tests pasan (unit, property-based, integration)
✅ Filtros por grupo funcionan correctamente
✅ Balance dinámico muestra colores correctos
✅ Pre-selección de mes/año actual funciona
✅ Tabla muestra información de grupos correctamente
✅ No hay errores en consola del navegador
✅ Performance cumple con targets establecidos
✅ Documentación está actualizada

---

**Última actualización:** 2025-01-23
**Versión:** 2.0
**Estado:** Pendiente de implementación
