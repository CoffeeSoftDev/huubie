# Implementation Plan - Módulo de Proveedores

## Task List

- [x] 1. Set up project structure and database schema


  - Create database tables for payments_supplier and payment_types
  - Add foreign key relationships with existing suppliers table
  - Insert initial data for payment_types (Corporativo, Fondo fijo)
  - _Requirements: 1.1, 4.2, 6.4_






- [x] 2. Implement backend model (mdl-proveedor.php)

- [x] 2.1 Create base model structure

  - Extend CRUD class and configure database connection
  - Define $bd and $util properties
  - _Requirements: 1.1, 2.1_

- [ ] 2.2 Implement payment query methods
  - Write listPayments() to retrieve payments with filters (date, udn)

  - Write getPaymentById() to get single payment details
  - Write lsSuppliers() to get active suppliers for selects
  - Write lsPaymentTypes() to get payment types for selects
  - _Requirements: 1.1, 1.5, 6.1_


- [x] 2.3 Implement payment CRUD methods

  - Write createPayment() to insert new payment records
  - Write updatePayment() to modify existing payments
  - Write deletePaymentById() to remove payments
  - Write existsPaymentByDate() to validate duplicates
  - _Requirements: 1.2, 1.3, 1.4, 1.6, 1.7_

- [x] 2.4 Implement balance report methods

  - Write listBalance() to generate supplier balance report
  - Integrate with purchases module to get credit purchases
  - Write calculateBalance() helper to compute initial/final balances




  - _Requirements: 2.1, 2.2, 2.3, 2.4, 7.1, 7.2, 7.3_

- [ ]* 2.5 Write unit tests for model methods
  - Test payment CRUD operations

  - Test balance calculations
  - Test integration with purchases module
  - _Requirements: All model requirements_

- [ ] 3. Implement backend controller (ctrl-proveedor.php)
- [x] 3.1 Create controller structure and init method

  - Extend mdl class
  - Implement init() to load suppliers, payment types, and UDN filters
  - _Requirements: 1.1, 3.1_

- [ ] 3.2 Implement payment listing endpoint
  - Write ls() method to list payments for selected date

  - Format payment data for frontend table

  - Include dropdown actions based on user level and date
  - Calculate daily totals (total, corporate, fixed fund)
  - _Requirements: 1.1, 1.5, 1.8, 5.1, 5.2_

- [x] 3.3 Implement payment CRUD endpoints



  - Write addPayment() to create new payments with validation
  - Write editPayment() to update payments with date/level restrictions
  - Write deletePayment() to remove payments with confirmations
  - Write getPayment() to retrieve payment details for editing
  - _Requirements: 1.2, 1.3, 1.4, 1.6, 1.7, 5.3, 5.4_

- [x] 3.4 Implement balance report endpoint

  - Write lsBalance() to generate consolidated supplier report
  - Format data with collapsible rows grouped by supplier
  - Apply date range and UDN filters
  - Calculate totals for initial balance, purchases, payments, final balance
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.2, 3.3, 7.4, 7.5_

- [ ] 3.5 Implement Excel export endpoint
  - Write exportExcel() to generate Excel file with balance report




  - Use PHPSpreadsheet library for formatting
  - Include headers, data, and totals
  - Send download headers and cleanup temporary files
  - _Requirements: 2.5, 2.6_


- [ ] 3.6 Create helper functions
  - Write dropdown() to generate action menus based on permissions

  - Write renderStatus() to format status badges
  - Write formatBalance() to format currency values
  - _Requirements: 1.6, 1.7, 5.1_



- [ ]* 3.7 Write integration tests for controller
  - Test all endpoints with different user levels

  - Test permission validations
  - Test data formatting
  - _Requirements: All controller requirements_


- [x] 4. Implement frontend main structure (proveedor.js)

- [x] 4.1 Create App class and initialization

  - Extend Templates class from CoffeeSoft

  - Define PROJECT_NAME as "proveedor"
  - Implement constructor with link and div_modulo parameters
  - Write render() method to initialize module
  - Fetch initial data (suppliers, payment types, UDN) from init endpoint
  - _Requirements: 6.1, 6.2_



- [ ] 4.2 Implement main layout structure
  - Write layout() method using primaryLayout component
  - Create tab structure with tabLayout for Captura and Concentrado tabs
  - Configure tab navigation with onClick handlers
  - Set up container IDs following pattern: container-captura, container-concentrado


  - _Requirements: 6.1, 6.2, 6.3, 6.5_

- [ ] 4.3 Implement date picker and main filters
  - Integrate dataPicker component for date selection
  - Write filterBar() method for main date filter
  - Add UDN selector for nivel 3+ users


  - Implement filter synchronization across tabs
  - _Requirements: 1.8, 3.1, 3.3_

- [ ] 5. Implement Capture Tab functionality
- [ ] 5.1 Create Capture Tab layout
  - Write layoutCapture() method with summary cards
  - Display three cards: Total Payments, Corporate Payments, Fixed Fund Payments

  - Use infoCard component from CoffeeSoft


  - Create container for payment table

  - _Requirements: 6.4_

- [ ] 5.2 Implement payment listing
  - Write lsPayments() method using createTable component

  - Configure table with columns: Supplier, Payment Type, Amount, Description, Actions
  - Apply theme 'corporativo' for consistent styling
  - Show/hide action buttons based on user level
  - _Requirements: 1.1, 1.5, 5.1_

- [ ] 5.3 Implement add payment functionality
  - Write addPayment() method using createModalForm component
  - Create form with fields: supplier (select), payment_type (select), amount (input), description (textarea)
  - Implement frontend validation (required fields, amount > 0)

  - Handle success response and refresh table

  - _Requirements: 1.2, 1.3, 1.4_



- [ ] 5.4 Implement edit payment functionality
  - Write editPayment(id) method using createModalForm component
  - Fetch payment data with getPayment endpoint
  - Pre-fill form with autofill option
  - Validate edit permissions (only current day for nivel 1)


  - Handle success response and refresh table
  - _Requirements: 1.6, 5.4_

- [ ] 5.5 Implement delete payment functionality
  - Write deletePayment(id) method using swalQuestion component
  - Show confirmation dialog with payment details
  - Call deletePayment endpoint on confirmation

  - Refresh table after successful deletion
  - _Requirements: 1.7, 5.4_

- [ ] 5.6 Implement real-time totals calculation
  - Write calculateTotals() helper method

  - Update summary cards when table data changes
  - Separate totals by payment type (corporate, fixed fund)
  - _Requirements: 1.5_

- [ ]* 5.7 Write unit tests for Capture Tab
  - Test form validation

  - Test totals calculation
  - Test permission-based UI rendering
  - _Requirements: Capture tab requirements_

- [ ] 6. Implement Balance Tab functionality
- [ ] 6.1 Create Balance Tab layout
  - Write layoutBalance() method with filter bar
  - Add date range selector
  - Add UDN filter for nivel 3+ users
  - Create container for balance table
  - _Requirements: 2.1, 3.1, 6.3_

- [x] 6.2 Implement balance report table

  - Write lsBalance() method using template from group-table.md

  - Create collapsible table grouped by supplier
  - Display columns for each date in range with purchases (green) and payments (red)
  - Show totals row for each supplier: Initial Balance, Credit Purchases, Credit Payments, Final Balance
  - Apply color coding: green for purchases, red for payments
  - _Requirements: 2.2, 2.3, 2.4, 6.5, 6.6_


- [ ] 6.3 Implement supplier detail expansion
  - Write toggleSupplier(id) method to expand/collapse supplier rows
  - Show detailed transactions when expanded
  - Display purchase and payment descriptions
  - _Requirements: 2.6, 6.6_


- [ ] 6.4 Implement Excel export
  - Write exportExcel() method
  - Call exportExcel endpoint with current filters
  - Handle file download response

  - Show loading indicator during generation

  - _Requirements: 2.5_

- [ ] 6.5 Implement balance filters
  - Write filterBarBalance() method using createfilterBar component
  - Add date range inputs

  - Add UDN selector
  - Add export button
  - Trigger lsBalance() on filter changes
  - _Requirements: 2.1, 3.1, 3.2, 3.3_

- [ ]* 6.6 Write integration tests for Balance Tab
  - Test balance calculations

  - Test collapsible table functionality
  - Test Excel export
  - Test filter synchronization
  - _Requirements: Balance tab requirements_

- [ ] 7. Implement permission-based UI rendering
- [ ] 7.1 Create permission validation helpers
  - Write canEdit() method to check if user can edit (nivel 1 + current day)
  - Write canDelete() method to check if user can delete (nivel 1 + current day)
  - Write canCapture() method to check if user can capture (nivel 1 only)


  - _Requirements: 5.1, 5.2, 5.3_


- [ ] 7.2 Implement conditional UI rendering
  - Hide edit/delete buttons for nivel 2+ users
  - Hide capture form for nivel 2+ users

  - Show read-only view for consultation users
  - Display appropriate messages for restricted actions
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 7.3 Implement backend permission validation
  - Add nivel validation in all CRUD endpoints
  - Add date validation for edit/delete operations

  - Return 403 status for unauthorized actions
  - Log permission violations for audit
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 8. Implement integration with Purchases module
- [ ] 8.1 Create integration interface
  - Require mdl-compras.php in mdl-proveedor.php
  - Write getPurchasesBySupplier() wrapper method
  - Map purchase data to balance report format
  - _Requirements: 7.1, 7.2_

- [ ] 8.2 Implement balance calculation logic
  - Write calculateBalance() to combine purchases and payments
  - Calculate initial balance from previous period
  - Sum credit purchases for period
  - Sum credit payments for period
  - Calculate final balance (initial + purchases - payments)
  - _Requirements: 7.3, 7.4_

- [ ] 8.3 Handle integration errors
  - Add try-catch for purchases module calls
  - Provide fallback if purchases module unavailable
  - Log integration errors
  - _Requirements: 7.1, 7.2_

- [ ]* 8.4 Write integration tests
  - Test data flow between modules
  - Test balance calculations with real data
  - Test error handling
  - _Requirements: Integration requirements_

- [ ] 9. Implement Excel export functionality
- [ ] 9.1 Set up PHPSpreadsheet library
  - Install PHPSpreadsheet via Composer or manual download
  - Create ExcelExporter helper class
  - _Requirements: 2.5_

- [ ] 9.2 Implement Excel generation
  - Write generateBalanceExcel() method
  - Create worksheet with headers
  - Populate data rows with supplier balances
  - Apply formatting (colors, borders, number formats)
  - Add totals row at bottom
  - _Requirements: 2.5, 2.6_

- [ ] 9.3 Implement file download
  - Generate temporary file with unique name
  - Set appropriate headers (Content-Type, Content-Disposition)
  - Stream file to browser
  - Delete temporary file after download
  - _Requirements: 2.5_

- [ ]* 9.4 Test Excel export
  - Test with various data sets
  - Verify formatting and formulas
  - Test file cleanup
  - _Requirements: 2.5_

- [ ] 10. Implement error handling and validation
- [ ] 10.1 Add frontend validation
  - Validate required fields in forms
  - Validate amount is positive number
  - Validate date is not in future
  - Show user-friendly error messages
  - _Requirements: 1.2, 1.3_

- [ ] 10.2 Add backend validation
  - Validate all input parameters
  - Check user permissions
  - Validate business rules (date restrictions, duplicates)
  - Return standardized error responses
  - _Requirements: All requirements_

- [ ] 10.3 Implement error logging
  - Log all errors to file
  - Include user context (id, level, udn)
  - Include request parameters
  - Include stack traces for debugging
  - _Requirements: All requirements_

- [ ]* 10.4 Write error handling tests
  - Test validation error messages
  - Test permission errors
  - Test database errors
  - Test integration errors
  - _Requirements: All requirements_

- [ ] 11. Implement UI/UX enhancements
- [ ] 11.1 Add loading indicators
  - Show spinner during AJAX requests
  - Disable buttons during save operations
  - Show progress for Excel generation
  - _Requirements: All requirements_

- [ ] 11.2 Add success/error notifications
  - Use SweetAlert2 for notifications
  - Show success messages after save/delete
  - Show error messages with details
  - Auto-dismiss success messages after 3 seconds
  - _Requirements: All requirements_

- [ ] 11.3 Implement responsive design
  - Test on mobile devices
  - Adjust table layout for small screens
  - Stack filters vertically on mobile
  - Ensure touch-friendly buttons
  - _Requirements: All requirements_

- [ ] 11.4 Add accessibility features
  - Add ARIA labels to form fields
  - Ensure keyboard navigation works
  - Test with screen readers
  - Verify color contrast ratios
  - _Requirements: All requirements_

- [ ] 12. Testing and quality assurance
- [ ] 12.1 Perform manual testing
  - Test all user flows for each nivel
  - Test with different UDNs
  - Test with various date ranges
  - Test edge cases (empty data, large datasets)
  - _Requirements: All requirements_

- [ ] 12.2 Perform security testing
  - Test SQL injection vulnerabilities
  - Test XSS vulnerabilities
  - Test CSRF protection
  - Test direct URL access without permissions
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 12.3 Perform performance testing
  - Test with large datasets (1000+ payments)
  - Measure page load times
  - Measure Excel generation time
  - Optimize slow queries
  - _Requirements: All requirements_

- [ ] 12.4 Fix bugs and issues
  - Document all bugs found during testing
  - Prioritize critical bugs
  - Fix and retest
  - _Requirements: All requirements_

- [ ] 13. Documentation and deployment
- [ ] 13.1 Create user documentation
  - Write user guide for each nivel
  - Create screenshots and examples
  - Document common workflows
  - _Requirements: All requirements_

- [ ] 13.2 Create technical documentation
  - Document API endpoints
  - Document database schema
  - Document integration points
  - Document deployment steps
  - _Requirements: All requirements_

- [ ] 13.3 Prepare for deployment
  - Create database migration scripts
  - Configure production environment
  - Set up file permissions
  - Test in staging environment
  - _Requirements: All requirements_

- [ ] 13.4 Deploy to production
  - Execute database migrations
  - Deploy code files
  - Verify all functionality works
  - Monitor for errors
  - _Requirements: All requirements_

- [ ] 13.5 Train users
  - Conduct training sessions for each nivel
  - Provide user documentation
  - Answer questions and provide support
  - _Requirements: All requirements_
