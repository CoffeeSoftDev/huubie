# Requirements Document - Módulo de Movimientos de Inventario (Versión 2.0 - Por Grupos)

## Introduction

El módulo de Movimientos de Inventario permite consultar, filtrar y visualizar el historial completo de **entradas y salidas** del inventario del sistema ERP, organizado por **grupos** en lugar de almacenes. Proporciona estadísticas en tiempo real, totales consolidados, balance de movimientos y un historial detallado por grupo, mes y año, facilitando la trazabilidad y control de las operaciones de inventario.

**Cambios principales en v2.0:**
- Reemplazo de "Almacén" por "Grupo" como unidad organizativa principal
- Integración con tabla `mtto_almacen` (grupos) en lugar de zonas
- Filtros por grupo en lugar de almacén
- Visualización de movimientos agrupados por categorías de productos

## Glossary

- **Movement**: Registro de entrada o salida de productos en el inventario
- **Group**: Categoría o grupo de productos (reemplaza el concepto de almacén físico)
- **Entry**: Movimiento de entrada de productos al inventario (incrementa stock)
- **Exit**: Movimiento de salida de productos del inventario (decrementa stock)
- **Balance**: Diferencia entre entradas y salidas en un período determinado
- **Responsible**: Usuario del sistema que ejecuta o autoriza un movimiento
- **Folio**: Identificador único de cada movimiento de inventario
- **Product**: Artículo del inventario perteneciente a un grupo específico
- **Area**: Área física donde se almacenan los productos (nivel secundario)
- **System**: Sistema ERP de gestión de inventario

## Requirements

### Requirement 1

**User Story:** As a system user, I want to access the movements module interface organized by groups, so that I can consult the history of inventory entries and exits grouped by product categories

#### Acceptance Criteria

1. WHEN the user accesses the movements module THEN the System SHALL display the main interface with filters for Month, Year, and Group
2. WHEN the interface loads THEN the System SHALL show visible filters with "Todos los grupos" as default option for Group filter
3. WHEN the interface loads THEN the System SHALL display summary cards showing Total Movements, Entries, Exits, and Balance
4. WHEN the interface loads initially THEN the System SHALL display movements grouped by product categories
5. WHEN no movements exist for the selected filters THEN the System SHALL display a message indicating no results found

### Requirement 2

**User Story:** As a user, I want to filter movements by month, year, and group, so that I can obtain precise information according to product categories

#### Acceptance Criteria

1. WHEN the user selects a month filter THEN the System SHALL display movements for the selected month from a dropdown list of all months
2. WHEN the user selects a year filter THEN the System SHALL display movements for the selected year from a dropdown list
3. WHEN the user selects a group filter THEN the System SHALL display movements only for products belonging to the selected group
4. WHEN the user selects "Todos los grupos" THEN the System SHALL display movements for all product groups
5. WHEN the user changes any filter THEN the System SHALL update the data dynamically without reloading the page

### Requirement 3

**User Story:** As a user, I want to visualize summary cards with totals organized by groups, so that I can have a quick overview of inventory movements by category

#### Acceptance Criteria

1. WHEN the summary cards are displayed THEN the System SHALL show the total number of movements for the selected period and group
2. WHEN the summary cards are displayed THEN the System SHALL show total entries with green color indicator and upward arrow icon
3. WHEN the summary cards are displayed THEN the System SHALL show total exits with red color indicator and downward arrow icon
4. WHEN the summary cards are displayed THEN the System SHALL calculate and display the balance as total units entered minus total units exited
5. WHEN filters are applied THEN the System SHALL update all summary cards dynamically to reflect the filtered data by group

### Requirement 4

**User Story:** As a user, I want to view the detailed history of movements organized by groups, so that I can identify folios, quantities, products, groups, and responsible parties

#### Acceptance Criteria

1. WHEN the history table is displayed THEN the System SHALL show columns for Folio, Date, Type, Product, Quantity, Group, and Responsible
2. WHEN displaying movement types THEN the System SHALL show "Entrada" badge in green and "Salida" badge in red
3. WHEN displaying quantities THEN the System SHALL show positive values with "+" prefix for entries and negative values with "-" prefix for exits
4. WHEN displaying the history THEN the System SHALL order movements in descending order by date (most recent first)
5. WHEN the table displays products THEN the System SHALL show the product name and its associated group

### Requirement 5

**User Story:** As an administrator, I want to register the responsible party and group association for each movement, so that I can maintain traceability of inventory operations by category

#### Acceptance Criteria

1. WHEN a movement is created THEN the System SHALL require and store the responsible user and associated group for that movement
2. WHEN displaying movement history THEN the System SHALL show the name of the responsible user and the group name for each movement
3. WHEN the responsible user is inactive THEN the System SHALL display the user name with an "inactive" indicator
4. WHEN querying movement details THEN the System SHALL retrieve and display the complete information including product, group, area, and responsible user
5. WHEN filtering by group THEN the System SHALL maintain the association between movements, products, and their groups

### Requirement 6

**User Story:** As a user, I want the system to validate movement data by group, so that inventory records remain accurate and consistent within each category

#### Acceptance Criteria

1. WHEN creating a movement THEN the System SHALL validate that the folio is unique and not duplicated
2. WHEN creating an exit movement THEN the System SHALL validate that sufficient stock exists for the product in its group
3. WHEN creating a movement THEN the System SHALL validate that the product exists, is active, and belongs to a valid group
4. WHEN creating a movement THEN the System SHALL validate that the group exists and is active in the mtto_almacen table
5. WHEN creating a movement THEN the System SHALL validate that the quantity is a positive number greater than zero

### Requirement 7

**User Story:** As a user, I want movements to be automatically timestamped and linked to groups, so that I can track when each operation occurred and to which category it belongs

#### Acceptance Criteria

1. WHEN a movement is created THEN the System SHALL automatically record the creation date, time, and associated group
2. WHEN displaying movement history THEN the System SHALL show dates in Spanish format (DD/MM/YYYY)
3. WHEN filtering by date range and group THEN the System SHALL include all movements within the specified period for the selected group
4. WHEN ordering movements THEN the System SHALL use the timestamp for chronological sorting within each group
5. WHEN exporting movement data THEN the System SHALL include the complete timestamp, group name, and product information

### Requirement 8

**User Story:** As a user, I want to see the balance indicator with dynamic colors, so that I can quickly identify if there is a positive or negative balance in inventory movements

#### Acceptance Criteria

1. WHEN the balance is positive or zero THEN the System SHALL display the balance in green color with a "+" prefix
2. WHEN the balance is negative THEN the System SHALL display the balance in red color with a "-" prefix
3. WHEN filters change THEN the System SHALL recalculate and update the balance color dynamically
4. WHEN the balance card is displayed THEN the System SHALL show the balance in units format (not currency)
5. WHEN hovering over the balance card THEN the System SHALL maintain the color coding for visual clarity

### Requirement 9

**User Story:** As a user, I want the interface to load with current month and year pre-selected, so that I can immediately see recent movements without manual filter selection

#### Acceptance Criteria

1. WHEN the module loads initially THEN the System SHALL pre-select the current month in the month filter
2. WHEN the module loads initially THEN the System SHALL pre-select the current year in the year filter
3. WHEN the module loads initially THEN the System SHALL pre-select "Todos los grupos" in the group filter
4. WHEN the pre-selected filters are applied THEN the System SHALL automatically load and display movements for the current period
5. WHEN the user changes pre-selected filters THEN the System SHALL update the data according to the new selection

### Requirement 10

**User Story:** As a user, I want to see product information with their associated groups in the movement history, so that I can understand the category context of each movement

#### Acceptance Criteria

1. WHEN displaying a movement in the history table THEN the System SHALL show the product name from mtto_almacen table
2. WHEN displaying a movement in the history table THEN the System SHALL show the group name associated with the product
3. WHEN a product belongs to multiple areas THEN the System SHALL display the primary area associated with the movement
4. WHEN displaying product information THEN the System SHALL use data from the mtto_almacen table joined with mtto_almacen_area
5. WHEN a product or group is inactive THEN the System SHALL still display historical movements with an indicator showing the inactive status
