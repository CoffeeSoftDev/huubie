# Requirements Document - Módulo de Proveedores

## Introduction

El módulo de Proveedores es un sistema integral para gestionar pagos a proveedores de cada unidad de negocio. Permite la captura, modificación y consulta de pagos según el nivel de acceso del usuario, así como visualizar balances detallados y exportar información en formato Excel. Este módulo reemplaza parte del antiguo sistema "Pagos y Salidas" y se integra con el módulo de Compras existente.

## Glossary

- **System**: Módulo de Proveedores del sistema financiero CoffeeSoft
- **User**: Usuario del sistema con diferentes niveles de acceso (1-4)
- **Supplier**: Proveedor registrado en el sistema
- **Payment**: Pago realizado a un proveedor
- **Purchase**: Compra a crédito registrada en el sistema
- **Business Unit**: Unidad de negocio (UDN) que realiza operaciones
- **Balance Report**: Concentrado de compras y pagos por proveedor
- **Payment Type**: Tipo de pago (Corporativo, Fondo fijo, etc.)
- **Access Level**: Nivel de permisos del usuario (1: Captura, 2: Gerencia, 3: Contabilidad/Dirección, 4: Administración)

## Requirements

### Requirement 1: Captura de Pagos a Proveedores (Nivel 1)

**User Story:** As a nivel uno user, I want to register supplier payments through a simple form, so that I can maintain daily control of payments made by the business unit

#### Acceptance Criteria

1. WHEN the user accesses the payment module, THE System SHALL display a form with fields for Supplier, Payment Type, Amount, and Description
2. WHEN the user attempts to save a payment without selecting a supplier, THE System SHALL display a validation error message
3. WHEN the user attempts to save a payment without selecting a payment type, THE System SHALL display a validation error message
4. WHEN the user successfully saves a payment, THE System SHALL update the daily payment table automatically
5. WHEN the user views the payment table, THE System SHALL display real-time payment totals
6. WHEN the user selects a payment registered during the current day, THE System SHALL allow editing the payment details
7. WHEN the user selects a payment registered during the current day, THE System SHALL allow deleting the payment
8. WHEN the user changes the selected date, THE System SHALL update the displayed payment information

### Requirement 2: Consulta del Concentrado Diario (Nivel 2)

**User Story:** As a nivel dos user (Gerencia), I want to view the consolidated purchases and payments by supplier, so that I can visualize balances, movements and general totals within a date range

#### Acceptance Criteria

1. WHEN the user accesses the balance report, THE System SHALL allow selecting a date range
2. WHEN the user views the balance report, THE System SHALL display supplier balances in collapsible format
3. WHEN the user views the balance report, THE System SHALL separate purchases and payments in color-coded columns (green for purchases, red for payments)
4. WHEN the user views the balance report, THE System SHALL display visible totals for Initial Balance, Credit Purchases, Credit Payments, and Final Balance
5. WHEN the user clicks the export button, THE System SHALL generate an Excel file with the balance report
6. WHEN the user clicks on a supplier detail, THE System SHALL display a modal window with complete description information
7. WHEN the user attempts to edit or delete records, THE System SHALL prevent the action for nivel dos users

### Requirement 3: Filtro por Unidad de Negocio (Nivel 3)

**User Story:** As a nivel tres user (Contabilidad/Dirección), I want to filter information by business unit, so that I can analyze specific financial movements of each unit

#### Acceptance Criteria

1. WHEN the user accesses the module, THE System SHALL display a business unit selector
2. WHEN the user selects a business unit, THE System SHALL apply the filter to all module listings
3. WHEN the user changes the business unit filter, THE System SHALL synchronize with date range filters
4. WHEN a nivel tres user attempts to capture or modify data, THE System SHALL prevent the action
5. WHEN the user views filtered data, THE System SHALL display only information corresponding to the selected business unit

### Requirement 4: Administración de Proveedores (Nivel 4)

**User Story:** As a nivel cuatro user (Contabilidad), I want to manage the system's supplier list, so that I can keep the information used in the payment module up to date

#### Acceptance Criteria

1. WHEN the user accesses supplier administration, THE System SHALL display options to add, edit, and delete suppliers
2. WHEN the user creates a new supplier, THE System SHALL require fields for Name, Status (active/inactive), and Type
3. WHEN the user attempts to create a duplicate supplier, THE System SHALL display a validation error message
4. WHEN the user modifies a supplier, THE System SHALL maintain a change history
5. WHEN the user deletes a supplier, THE System SHALL verify that no active transactions exist for that supplier
6. WHEN the user views the supplier list, THE System SHALL display all suppliers with their current status

### Requirement 5: Visualización Segura sin Edición (Niveles 2, 3 y 4)

**User Story:** As a consultation user (Gerencia, Contabilidad, Dirección), I want to view movements without being able to modify data, so that financial information integrity is ensured

#### Acceptance Criteria

1. WHEN a nivel dos, tres, or cuatro user accesses the module, THE System SHALL hide edit and delete buttons
2. WHEN a nivel dos, tres, or cuatro user attempts to access capture functions via URL, THE System SHALL deny access
3. WHEN a nivel dos, tres, or cuatro user views the module, THE System SHALL maintain read-only mode
4. WHEN the user views payment details, THE System SHALL display complete information without modification options
5. WHEN the user attempts any modification action, THE System SHALL validate permissions on both frontend and backend

### Requirement 6: Interfaz de Pestañas y Componentes

**User Story:** As a user, I want to navigate between different sections of the module through tabs, so that I can access different functionalities efficiently

#### Acceptance Criteria

1. WHEN the user accesses the module, THE System SHALL display tabs for Captura (Capture) and Concentrado (Balance Report)
2. WHEN the user clicks on the Captura tab, THE System SHALL display the daily payment capture interface
3. WHEN the user clicks on the Concentrado tab, THE System SHALL display the supplier balance report
4. WHEN the user views the Captura tab, THE System SHALL display summary cards for Total Payments, Fixed Fund Payments, and Corporate Payments
5. WHEN the user views the Concentrado tab, THE System SHALL display a collapsible table grouped by supplier
6. WHEN the user toggles the balance report view, THE System SHALL expand or collapse supplier details

### Requirement 7: Integración con Módulo de Compras

**User Story:** As a user, I want the payment module to integrate with the purchase module, so that I can view complete supplier balance information

#### Acceptance Criteria

1. WHEN the user views the balance report, THE System SHALL retrieve credit purchase data from the purchase module
2. WHEN the user views supplier details, THE System SHALL display both purchases and payments in chronological order
3. WHEN the user calculates supplier balance, THE System SHALL include initial balance, credit purchases, and credit payments
4. WHEN the user exports the report, THE System SHALL include data from both purchases and payments
5. WHEN the user filters by date range, THE System SHALL apply the filter to both purchases and payments
