# Requirements Document - Módulo de Materiales

## Introduction

El módulo de Materiales es un componente fundamental del Sistema de Almacén ERP que permite gestionar el inventario de materiales y equipos. Este módulo facilita el registro, edición, eliminación y búsqueda de materiales, proporcionando control total sobre el inventario con información detallada de cada artículo incluyendo zona, categoría, área, cantidad y costos.

## Glossary

- **Material**: Artículo o equipo registrado en el almacén con código único, categoría, área y costo asociado
- **Zona**: Ubicación física principal donde se almacena el material (ej: HOTEL, LAPPCES, ROLLO)
- **Categoría**: Clasificación del tipo de material (ej: PIEZAS, HERRAMIENTAS, CONSUMIBLES)
- **Área**: Subdivisión específica dentro de una zona (ej: PAPELERIA, LIMPIEZA, MANTENIMIENTO)
- **Código**: Identificador único del material con formato AR-XX-XX-XXX
- **Estado**: Condición actual del material (activo/inactivo)
- **Costo Unitario**: Precio individual de cada unidad del material
- **Valor Total**: Suma del costo de todos los materiales en inventario

## Requirements

### Requirement 1

**User Story:** As a warehouse administrator, I want to view the main materials interface with filters and a data table, so that I can visualize and manage all registered materials in the warehouse

#### Acceptance Criteria

1. WHEN the materials module loads, THE System SHALL display the title "Materiales - Gestión de materiales del almacén"
2. WHEN the interface renders, THE System SHALL display a filter bar containing Zone, Category, Area and Search fields
3. WHEN the materials table loads, THE System SHALL display columns for Photo, Code, Zone, Equipment/Material, Category, Area, Quantity, Cost, Status and Actions
4. WHEN materials are displayed, THE System SHALL show a "+ Nuevo Material" button in the top right corner
5. WHEN the table renders, THE System SHALL display the total inventory value at the bottom of the table

### Requirement 2

**User Story:** As a warehouse administrator, I want to register a new material through a complete form, so that I can keep the inventory updated with available items

#### Acceptance Criteria

1. WHEN the user clicks "+ Nuevo Material" button, THE System SHALL open a modal with the title "Nuevo Material"
2. WHEN the modal opens, THE System SHALL display fields for Photo, Code (format AR-01-29-XXX), Zone, Equipment/Material Name, Category, Area, Quantity and Unit Cost
3. WHEN the user attempts to save, THE System SHALL validate all required fields marked with asterisk (*)
4. WHEN the user uploads a photo, THE System SHALL accept only JPG, PNG, GIF formats with maximum size of 5MB
5. WHEN the user clicks "Guardar Material" with valid data, THE System SHALL save the material and display it in the main table
6. WHEN the material is saved successfully, THE System SHALL close the modal and refresh the materials table

### Requirement 3

**User Story:** As a warehouse administrator, I want to modify information of an existing material, so that I can keep inventory data and costs accurate

#### Acceptance Criteria

1. WHEN the user clicks the Edit icon on a material row, THE System SHALL open a modal titled "Editar Material" with preloaded data
2. WHEN the edit modal opens, THE System SHALL allow modification of Zone, Name, Category, Area, Quantity and Unit Cost fields
3. WHEN editing a material with photo, THE System SHALL allow replacing or removing the existing photo
4. WHEN the user uploads a new photo, THE System SHALL validate format (JPG, PNG, GIF) and size (max 5MB)
5. WHEN the user clicks "Guardar Cambios" with valid data, THE System SHALL update the material and refresh the table
6. WHEN changes are saved successfully, THE System SHALL close the modal and display the updated information

### Requirement 4

**User Story:** As a warehouse administrator, I want to delete a material from inventory, so that I can keep the database free of obsolete or incorrect records

#### Acceptance Criteria

1. WHEN the user clicks the Delete icon on a material row, THE System SHALL display a confirmation modal with title "¿Está seguro?"
2. WHEN the confirmation modal opens, THE System SHALL display the material code and name in the message
3. WHEN the confirmation modal displays, THE System SHALL show "Cancelar" and "Eliminar" buttons
4. WHEN the user clicks "Eliminar" button, THE System SHALL permanently delete the material from the database
5. WHEN the material is deleted successfully, THE System SHALL close the modal and refresh the materials table
6. WHEN the user clicks "Cancelar" button, THE System SHALL close the modal without deleting the material

### Requirement 5

**User Story:** As a module user, I want to apply filters and search by code or name, so that I can quickly locate materials within the inventory

#### Acceptance Criteria

1. WHEN the user selects a Zone filter, THE System SHALL update the table to show only materials from that zone
2. WHEN the user selects a Category filter, THE System SHALL update the table to show only materials from that category
3. WHEN the user selects an Area filter, THE System SHALL update the table to show only materials from that area
4. WHEN the user types in the search bar, THE System SHALL filter materials by partial code or name match
5. WHEN filters are applied, THE System SHALL update the table dynamically without page reload
6. WHEN the user changes between filter options, THE System SHALL maintain previously selected filters

### Requirement 6

**User Story:** As a warehouse administrator, I want the system to calculate and display the total inventory value, so that I can monitor the financial value of stored materials

#### Acceptance Criteria

1. WHEN materials are displayed in the table, THE System SHALL calculate the total value by multiplying quantity by unit cost for each material
2. WHEN the table renders, THE System SHALL display the sum of all material values at the bottom
3. WHEN filters are applied, THE System SHALL recalculate and display the total value for filtered materials only
4. WHEN a material is added or edited, THE System SHALL update the total inventory value automatically
5. WHEN a material is deleted, THE System SHALL recalculate and update the total inventory value

### Requirement 7

**User Story:** As a warehouse administrator, I want to upload and manage material photos, so that I can visually identify materials in the inventory

#### Acceptance Criteria

1. WHEN the user clicks the photo upload area, THE System SHALL open a file selection dialog
2. WHEN the user selects a file, THE System SHALL validate the file format is JPG, PNG or GIF
3. WHEN the user selects a file, THE System SHALL validate the file size does not exceed 5MB
4. WHEN an invalid file is selected, THE System SHALL display an error message and prevent upload
5. WHEN a valid file is uploaded, THE System SHALL display a preview of the image in the form
6. WHEN editing a material with photo, THE System SHALL display the current photo with an option to remove it

### Requirement 8

**User Story:** As a warehouse administrator, I want the system to generate unique material codes, so that each material can be uniquely identified

#### Acceptance Criteria

1. WHEN creating a new material, THE System SHALL display the code format as AR-01-29-XXX
2. WHEN the user enters a code, THE System SHALL validate the format matches the pattern AR-XX-XX-XXX
3. WHEN the user attempts to save with an existing code, THE System SHALL display an error message
4. WHEN the code is valid and unique, THE System SHALL allow the material to be saved
5. WHEN displaying materials in the table, THE System SHALL show the complete code for each material
