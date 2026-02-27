# Requirements Document - Módulo de Movimientos de Inventario

## Introduction

El módulo de Movimientos de Inventario permite consultar, filtrar y visualizar el historial completo de **entradas y salidas** del inventario del sistema ERP. Proporciona estadísticas en tiempo real, totales consolidados, balance de movimientos y un historial detallado por almacén, mes y año, facilitando la trazabilidad y control de las operaciones de inventario.

## Glossary

- **Movement**: Registro de entrada o salida de productos en el inventario
- **Warehouse**: Almacén físico donde se almacenan los productos
- **Entry**: Movimiento de entrada de productos al inventario (incrementa stock)
- **Exit**: Movimiento de salida de productos del inventario (decrementa stock)
- **Balance**: Diferencia entre entradas y salidas en un período determinado
- **Responsible**: Usuario del sistema que ejecuta o autoriza un movimiento
- **Folio**: Identificador único de cada movimiento de inventario
- **System**: Sistema ERP de gestión de inventario

## Requirements

### Requirement 1

**User Story:** As a system user, I want to access the movements module interface, so that I can consult the history of inventory entries and exits in a clear and organized way

#### Acceptance Criteria

1. WHEN the user accesses the movements module THEN the System SHALL display the main interface with filters, summary cards, and movement history table
2. WHEN the interface loads THEN the System SHALL show visible filters for Month, Year, and Warehouse
3. WHEN the interface loads THEN the System SHALL display summary cards showing Total Movements, Entries, Exits, and Balance
4. WHEN the interface loads initially THEN the System SHALL display a maximum of 5 movements in the history table
5. WHEN no movements exist for the selected filters THEN the System SHALL display a message indicating no results found

### Requirement 2

**User Story:** As a user, I want to filter movements by month, year, and warehouse, so that I can obtain precise information according to my consultation needs

#### Acceptance Criteria

1. WHEN the user selects a month filter THEN the System SHALL display movements for the selected month including an "All months" option
2. WHEN the user selects a year filter THEN the System SHALL display movements for the selected year from a dropdown list
3. WHEN the user selects a warehouse filter THEN the System SHALL display movements only for the selected warehouse from active warehouses list
4. WHEN the user changes any filter THEN the System SHALL update the data dynamically without reloading the page
5. WHEN the applied filters return no results THEN the System SHALL display a message indicating no movements match the criteria

### Requirement 3

**User Story:** As a user, I want to visualize summary cards with totals (entries, exits, balance), so that I can have a quick overview of the inventory status

#### Acceptance Criteria

1. WHEN the summary cards are displayed THEN the System SHALL show the total number of movements for the selected period
2. WHEN the summary cards are displayed THEN the System SHALL show the total entries with green color indicator
3. WHEN the summary cards are displayed THEN the System SHALL show the total exits with red color indicator
4. WHEN the summary cards are displayed THEN the System SHALL calculate and display the balance as Entries minus Exits
5. WHEN filters are applied THEN the System SHALL update all summary cards dynamically to reflect the filtered data

### Requirement 4

**User Story:** As a user, I want to view the detailed history of movements performed, so that I can identify folios, quantities, responsible parties, and movement types

#### Acceptance Criteria

1. WHEN the history table is displayed THEN the System SHALL show columns for Folio, Date, Type, Product, Quantity, Warehouse, and Responsible
2. WHEN displaying movement types THEN the System SHALL color-code entries in green and exits in red
3. WHEN displaying quantities THEN the System SHALL show positive values for entries and negative values for exits with their respective signs
4. WHEN displaying the history THEN the System SHALL order movements in descending order by date
5. WHEN the user scrolls or requests more data THEN the System SHALL load additional movements beyond the initial 5 records

### Requirement 5

**User Story:** As an administrator, I want to register the responsible party associated with each movement, so that I can maintain traceability of inventory operations

#### Acceptance Criteria

1. WHEN a movement is created THEN the System SHALL require and store the responsible user for that movement
2. WHEN displaying movement history THEN the System SHALL show the name of the responsible user for each movement
3. WHEN the responsible user is inactive THEN the System SHALL display a label indicating "inactive responsible"
4. WHEN querying movement details THEN the System SHALL retrieve and display the complete information of the responsible user
5. WHEN filtering movements THEN the System SHALL maintain the association between movements and their responsible users

### Requirement 6

**User Story:** As a user, I want the system to validate movement data, so that inventory records remain accurate and consistent

#### Acceptance Criteria

1. WHEN creating a movement THEN the System SHALL validate that the folio is unique and not duplicated
2. WHEN creating an exit movement THEN the System SHALL validate that sufficient stock exists in the warehouse
3. WHEN creating a movement THEN the System SHALL validate that the product exists and is active
4. WHEN creating a movement THEN the System SHALL validate that the warehouse exists and is active
5. WHEN creating a movement THEN the System SHALL validate that the quantity is a positive number greater than zero

### Requirement 7

**User Story:** As a user, I want movements to be automatically timestamped, so that I can track when each operation occurred

#### Acceptance Criteria

1. WHEN a movement is created THEN the System SHALL automatically record the creation date and time
2. WHEN displaying movement history THEN the System SHALL show dates in Spanish format (DD/MM/YYYY)
3. WHEN filtering by date range THEN the System SHALL include all movements within the specified period
4. WHEN ordering movements THEN the System SHALL use the timestamp for chronological sorting
5. WHEN exporting movement data THEN the System SHALL include the complete timestamp information
