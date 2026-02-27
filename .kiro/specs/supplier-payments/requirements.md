# Requirements Document - Supplier Payments Module

## Introduction

The Supplier Payments Module is a comprehensive financial management system designed to handle supplier payment operations across multiple business units. This module replaces part of the legacy "Payments and Outputs" system and provides role-based access control for payment capture, consultation, and supplier administration.

The system supports daily payment tracking, consolidated reporting with date ranges, balance calculations, and Excel export capabilities. It integrates with the existing CoffeeSoft ERP architecture and follows the MVC pattern with MySQL database backend.

## Glossary

- **System**: The Supplier Payments Module within the CoffeeSoft ERP framework
- **User**: Any authenticated person accessing the system with assigned role permissions
- **Supplier**: A vendor or provider registered in the system that receives payments
- **Payment**: A financial transaction recorded against a supplier account
- **UDN (Unidad de Negocio)**: Business unit or operational division within the organization
- **Consolidated Report**: A summary view showing purchases and payments grouped by supplier
- **Payment Type**: Classification of payment method (Corporate, Petty Cash, etc.)
- **Access Level**: User permission tier (Level 1: Capture, Level 2: Management, Level 3: Accounting, Level 4: Administration)
- **Balance**: Financial calculation showing initial balance, credit purchases, credit payments, and final balance
- **Operation Date**: The date when a payment transaction occurred

## Requirements

### Requirement 1

**User Story:** As a capture user (level one), I want to register supplier payments through a simple form, so that I can maintain daily control of payments made by the business unit.

#### Acceptance Criteria

1. WHEN a level one user accesses the payment capture interface THEN the System SHALL display a form with fields for supplier selection, payment type, amount, and description
2. WHEN a user attempts to save a payment without selecting a supplier THEN the System SHALL prevent submission and display a validation message
3. WHEN a user attempts to save a payment without selecting a payment type THEN the System SHALL prevent submission and display a validation message
4. WHEN a user successfully saves a payment THEN the System SHALL update the daily payment table automatically and refresh the totals
5. WHEN a user changes the selected date THEN the System SHALL reload the payment list for that specific date

### Requirement 2

**User Story:** As a capture user (level one), I want to edit and delete payments I registered during the current day, so that I can correct errors before the daily closing.

#### Acceptance Criteria

1. WHEN a level one user views the daily payment list THEN the System SHALL display edit and delete action buttons for each payment record
2. WHEN a user clicks the edit button THEN the System SHALL open a modal form pre-filled with the payment data
3. WHEN a user modifies payment data and saves THEN the System SHALL update the record and refresh the table with updated totals
4. WHEN a user clicks the delete button THEN the System SHALL display a confirmation dialog before deletion
5. WHEN a user confirms deletion THEN the System SHALL remove the payment record and recalculate the daily totals

### Requirement 3

**User Story:** As a management user (level two), I want to consult the consolidated report of purchases and payments by supplier, so that I can visualize balances, movements, and general totals within a date range.

#### Acceptance Criteria

1. WHEN a level two user accesses the consolidated report THEN the System SHALL display a date range selector and supplier balance table
2. WHEN a user selects a date range THEN the System SHALL display suppliers in an expandable format with purchases and payments separated by color-coded columns
3. WHEN the consolidated report displays THEN the System SHALL show totals for initial balance, credit purchases, credit payments, and final balance
4. WHEN a user clicks on a supplier row THEN the System SHALL expand to show detailed transactions for that supplier
5. WHEN a user clicks the export button THEN the System SHALL generate an Excel file with the complete consolidated report

### Requirement 4

**User Story:** As a management user (level two), I want to view detailed descriptions of all transactions, so that I can understand the context of each payment and purchase.

#### Acceptance Criteria

1. WHEN a user views the consolidated report THEN the System SHALL provide a detail view option for each supplier
2. WHEN a user opens the detail view THEN the System SHALL display the complete description captured in the payment form
3. WHEN multiple transactions exist for a supplier THEN the System SHALL list all descriptions chronologically
4. WHEN a description exceeds display limits THEN the System SHALL show the full text in the detail modal
5. WHEN the detail modal is open THEN the System SHALL display transaction date, amount, payment type, and full description

### Requirement 5

**User Story:** As an accounting user (level three), I want to filter information by business unit, so that I can analyze specific financial movements of each unit.

#### Acceptance Criteria

1. WHEN a level three user accesses the module THEN the System SHALL display a business unit selector in the filter bar
2. WHEN a user selects a business unit THEN the System SHALL apply the filter to all module listings and reports
3. WHEN the business unit filter is active THEN the System SHALL synchronize with date range filters
4. WHEN a level three user views payment data THEN the System SHALL prevent capture or modification actions
5. WHEN a level three user attempts to edit data THEN the System SHALL display a read-only view without action buttons

### Requirement 6

**User Story:** As an administration user (level four), I want to manage the supplier list in the system, so that I can maintain updated information used in the payment module.

#### Acceptance Criteria

1. WHEN a level four user accesses supplier administration THEN the System SHALL display options to add, edit, and manage supplier status
2. WHEN adding a new supplier THEN the System SHALL require fields for name, business unit, and active status
3. WHEN a user attempts to create a duplicate supplier name THEN the System SHALL prevent creation and display a validation message
4. WHEN a user changes supplier status to inactive THEN the System SHALL hide the supplier from payment capture dropdowns
5. WHEN a user edits supplier information THEN the System SHALL maintain historical transaction integrity

### Requirement 7

**User Story:** As a consultation user (management, accounting, or administration levels), I want to view movements without modification capabilities, so that financial information integrity is ensured.

#### Acceptance Criteria

1. WHEN a user with level two or higher accesses the module THEN the System SHALL hide edit and delete action buttons
2. WHEN a consultation user attempts to access edit URLs directly THEN the System SHALL return an access denied response
3. WHEN the module loads for consultation users THEN the System SHALL display data in read-only mode
4. WHEN a consultation user views the interface THEN the System SHALL show only view and export actions
5. WHEN backend receives modification requests from consultation users THEN the System SHALL validate permissions and reject unauthorized actions

### Requirement 8

**User Story:** As a system administrator, I want the module to integrate with the existing database schema, so that data consistency is maintained across the ERP system.

#### Acceptance Criteria

1. WHEN the System stores payment data THEN the System SHALL use the supplier_payment table with fields: id, supplier_id, amount, description, operation_date, active
2. WHEN the System retrieves supplier data THEN the System SHALL query the supplier table with fields: id, udn_id, name, active
3. WHEN the System performs database operations THEN the System SHALL use foreign key relationships between supplier_payment.supplier_id and supplier.id
4. WHEN the System filters by business unit THEN the System SHALL join supplier table on udn_id field
5. WHEN the System soft-deletes records THEN the System SHALL set the active field to 0 instead of physical deletion

### Requirement 9

**User Story:** As a developer, I want the module to follow CoffeeSoft architecture patterns, so that code maintainability and consistency are ensured.

#### Acceptance Criteria

1. WHEN the module is implemented THEN the System SHALL use MVC architecture with separate ctrl, mdl, and js files
2. WHEN frontend components are created THEN the System SHALL extend the Templates class from CoffeeSoft framework
3. WHEN database operations are performed THEN the System SHALL use the CRUD class methods (_Select, _Insert, _Update, _Delete)
4. WHEN forms are rendered THEN the System SHALL use createModalForm and createForm components from CoffeeSoft
5. WHEN tables are displayed THEN the System SHALL use createTable component with CoffeeSoft theme configuration

### Requirement 10

**User Story:** As a user, I want the interface to use tab navigation, so that I can easily switch between daily capture and consolidated report views.

#### Acceptance Criteria

1. WHEN the module loads THEN the System SHALL display two tabs: "Daily Capture" and "Consolidated Report"
2. WHEN a user clicks the Daily Capture tab THEN the System SHALL show the payment form and daily transaction table
3. WHEN a user clicks the Consolidated Report tab THEN the System SHALL show the date range filter and supplier balance table
4. WHEN switching between tabs THEN the System SHALL maintain filter selections and user context
5. WHEN a tab is active THEN the System SHALL apply visual styling to indicate the current view

### Requirement 11

**User Story:** As a capture user, I want real-time total calculations, so that I can verify the accuracy of daily payment entries.

#### Acceptance Criteria

1. WHEN the daily payment table loads THEN the System SHALL display total payment amount at the bottom of the table
2. WHEN a new payment is added THEN the System SHALL recalculate and update the total immediately
3. WHEN a payment is edited THEN the System SHALL adjust the total to reflect the new amount
4. WHEN a payment is deleted THEN the System SHALL subtract the amount from the total
5. WHEN the date filter changes THEN the System SHALL recalculate totals for the selected date

### Requirement 12

**User Story:** As a management user, I want color-coded columns in the consolidated report, so that I can quickly distinguish between purchases and payments.

#### Acceptance Criteria

1. WHEN the consolidated report displays THEN the System SHALL use green background color for purchase columns
2. WHEN the consolidated report displays THEN the System SHALL use red background color for payment columns
3. WHEN a supplier row is expanded THEN the System SHALL maintain color coding for detailed transactions
4. WHEN totals are calculated THEN the System SHALL display them with appropriate color coding
5. WHEN the report is exported to Excel THEN the System SHALL preserve color coding in the exported file
