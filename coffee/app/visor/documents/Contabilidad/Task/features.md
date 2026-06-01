---
name: features
description: Lista de pendientes del módulo de Contabilidad
date: 2026-05-29
---

# Módulo de Consulta de Calificaciones de Camaristas

Este módulo permitirá visualizar las calificaciones de las camaristas, con filtros y elementos visuales que faciliten el análisis del desempeño semanal.

## 1. Barra de Filtros (FilterBar)

Debe incluir los siguientes selectores:

- **Selector de mes**
- **Selector de año**
- **Selector de evaluaciones por semana**  
  Ej. *Semana del 11 al 17 de mayo*

## 2. Banner del Ganador de la Semana

- **Diseño**: Badge con fondo dorado.
- **Icono**: Trofeo ubicado en el lado izquierdo.
- **Texto**:
  - Título: **"Ganador de la semana"** en color azul.
  - Nombre del empleado y su porcentaje de desempeño en color verde.

## 3. Tabla de Porcentajes de Desempeño

- **Título centrado**:  
  Ej. *Semana del 11 de mayo al 17 de mayo 2026*

- **Columnas**:
  - **Empleado**
  - **Porcentaje de desempeño**
  - **Indicador de meta alcanzada** (usar una barra de colores progresiva)

### Pista de Metas (Color Progress Indicator)

Los porcentajes se mostrarán con una barra de colores que cambia según el nivel alcanzado:

- **Rojo** → 60% - 79%
- **Naranja** → 80% - 89%
- **Amarillo** → 90% - 97%
- **Verde** → 98% - 100%

Ejemplo de visualización de porcentajes:

| Porcentaje | Color      |
|------------|------------|
| 60% - 79%  | Rojo       |
| 80% - 89%  | Naranja    |
| 90% - 97%  | Amarillo   |
| 98% - 100% | Verde      |

## 4. Leyenda de Colores

Debajo de la tabla debe haber una leyenda que indique qué representa cada color en la pista de metas.

## 5. Indicador del Líder de la Semana

Mostrar el nombre del empleado con el mejor desempeño en la semana consultada.

## 6. Administrador de Excepciones

Incluir una sección o funcionalidad para gestionar a los empleados que **no participarán** en la evaluación de desempeño.

## 7. Administrador de Rangos y Colores de Evaluación

Implementar un sistema configurable que permita administrar los colores y rangos de desempeño, en lugar de tener valores estáticos predefinidos.

### Funcionalidades:

- **Gestión de Rangos**: 
  - Definir rangos personalizados de porcentajes (ej. 60-79%, 80-89%, etc.)
  - Asignar un color específico a cada rango (rojo, naranja, amarillo, verde)
  - Modificar límites inferior y superior de cada rango

- **Flexibilidad del Sistema**:
  - Los rangos y colores se pueden ajustar según las necesidades de evaluación
  - Cambios que se reflejan inmediatamente en la visualización de la tabla de desempeño
  - Permite adaptar el sistema a diferentes criterios de evaluación

- **Interfaz de Configuración**:
  - Panel administrativo para crear, editar y eliminar rangos de colores
  - Vista previa en tiempo real de los cambios
  - Validación de solapamientos entre rangos

### Beneficio:
Permite una evaluación más flexible y adaptable a diferentes políticas de calificación sin requerir cambios en el código.