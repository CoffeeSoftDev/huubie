# Requirements Document

## Introduction

Esta especificación define los requisitos para mejorar la visualización de productos personalizados en el sistema de pedidos. Cuando un producto tiene la propiedad `is_custom = true`, debe mostrar una interfaz visual diferenciada que indique claramente que es un producto personalizado, sin imagen y con un diseño específico.

## Requirements

### Requirement 1

**User Story:** Como usuario del sistema de pedidos, quiero identificar visualmente los productos personalizados, para distinguirlos fácilmente de los productos regulares con imagen.

#### Acceptance Criteria

1. WHEN un producto tiene `is_custom = true` THEN el sistema SHALL mostrar un span con el texto "personalizado" debajo del nombre del producto
2. WHEN un producto es personalizado THEN el sistema SHALL NOT mostrar imagen del producto
3. WHEN un producto es personalizado THEN el sistema SHALL mostrar una card con fondo purple
4. WHEN un producto es personalizado THEN el sistema SHALL mostrar el ícono `icon-birthday` en lugar de la imagen

### Requirement 2

**User Story:** Como desarrollador del sistema, quiero que la lógica de detección de productos personalizados sea clara y mantenible, para facilitar futuras modificaciones.

#### Acceptance Criteria

1. WHEN se renderiza la lista de productos THEN el sistema SHALL verificar la propiedad `is_custom` de cada producto
2. WHEN `is_custom` es `true` THEN el sistema SHALL aplicar el estilo personalizado
3. WHEN `is_custom` es `false` o `undefined` THEN el sistema SHALL mantener el comportamiento actual
4. WHEN se modifica el diseño THEN el sistema SHALL mantener la funcionalidad existente para productos regulares

### Requirement 3

**User Story:** Como usuario, quiero que el diseño de productos personalizados sea consistente con el tema visual del sistema, para mantener una experiencia coherente.

#### Acceptance Criteria

1. WHEN se muestra un producto personalizado THEN el sistema SHALL usar colores purple consistentes con el tema
2. WHEN se muestra el ícono THEN el sistema SHALL usar el ícono `icon-birthday` con el tamaño apropiado
3. WHEN se muestra el texto "personalizado" THEN el sistema SHALL usar estilos de texto consistentes con el sistema
4. WHEN se renderiza la card THEN el sistema SHALL mantener el espaciado y layout coherente con otros elementos