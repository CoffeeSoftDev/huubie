# Implementation Plan - Módulo de Materiales

- [x] 1. Set up project structure and database



  - Create directory structure for almacen module (ctrl, mdl, js folders)
  - Create database tables following schema in design.md
  - Configure database connection and upload directories
  - _Requirements: All_



- [ ] 2. Implement data model (mdl-almacen.php)
- [ ] 2.1 Create base model class structure
  - Extend CRUD class and configure database connection


  - Initialize $bd property with "rfwsmqex_mtto."
  - Initialize $util property with Utileria instance
  - _Requirements: All_



- [ ] 2.2 Implement filter data methods
  - Create lsZones() method to return zones for filter
  - Create lsCategories() method to return categories for filter
  - Create lsAreas() method to return areas for filter
  - _Requirements: 1.2, 5.1, 5.2, 5.3_

- [ ] 2.3 Implement material CRUD methods
  - Create listMateriales() method with filter parameters
  - Create getMaterialById() method to retrieve single material
  - Create existsMaterialByCode() method for validation
  - Create createMaterial() method for insertions
  - Create updateMaterial() method for updates
  - Create deleteMaterialById() method for deletions
  - _Requirements: 1.3, 2.5, 3.5, 4.4_

- [x]* 2.4 Write property test for material code uniqueness


  - **Property 1: Material code uniqueness**
  - **Validates: Requirements 8.3**



- [ ]* 2.5 Write property test for filter consistency
  - **Property 2: Filter consistency**
  - **Validates: Requirements 5.1, 5.2, 5.3**

- [ ] 3. Implement controller (ctrl-almacen.php)
- [x] 3.1 Create controller class structure


  - Extend mdl class
  - Implement init() method to return filter data
  - _Requirements: 1.2, 5.1, 5.2, 5.3_


- [ ] 3.2 Implement lsMateriales() method
  - Receive filter parameters from POST
  - Call model listMateriales() method
  - Build row array with formatted data
  - Calculate total inventory value
  - Return row array and total value

  - _Requirements: 1.3, 1.5, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2_

- [ ] 3.3 Implement getMaterial() method
  - Receive material ID from POST
  - Call model getMaterialById() method

  - Return status, message and material data
  - _Requirements: 3.1_

- [ ] 3.4 Implement addMaterial() method
  - Validate required fields


  - Check for duplicate code using existsMaterialByCode()
  - Call model createMaterial() method
  - Return status and message
  - _Requirements: 2.3, 2.5, 8.3_

- [ ] 3.5 Implement editMaterial() method
  - Receive material ID and updated data from POST
  - Call model updateMaterial() method
  - Return status and message
  - _Requirements: 3.5_

- [x] 3.6 Implement deleteMaterial() method


  - Receive material ID from POST
  - Call model deleteMaterialById() method
  - Return status and message
  - _Requirements: 4.4_


- [ ] 3.7 Create helper functions
  - Create renderStatus() function for status badges
  - Create renderProductImage() function for photo display
  - _Requirements: 1.3, 7.6_



- [ ]* 3.8 Write property test for total value calculation
  - **Property 4: Total value calculation**
  - **Validates: Requirements 6.1, 6.2**

- [ ]* 3.9 Write property test for code format validation
  - **Property 10: Code format validation**


  - **Validates: Requirements 8.2**

- [ ] 4. Implement frontend (almacen.js)
- [ ] 4.1 Create App class structure
  - Extend Templates class from CoffeeSoft


  - Initialize PROJECT_NAME as "almacen"
  - Implement constructor with link and div_modulo
  - _Requirements: All_

- [ ] 4.2 Implement render() and layout() methods
  - Create render() method to initialize module
  - Create layout() method using primaryLayout()
  - Configure filterBar and container sections
  - _Requirements: 1.1, 1.2_



- [ ] 4.3 Implement filterBar() method
  - Use createfilterBar() component
  - Add Zone select filter
  - Add Category select filter
  - Add Area select filter
  - Add Search input field

  - Add "+ Nuevo Material" button
  - _Requirements: 1.2, 1.4, 5.1, 5.2, 5.3, 5.4_

- [ ] 4.4 Implement lsMateriales() method
  - Use createTable() component with coffeesoft theme
  - Configure table columns (Photo, Code, Zone, Equipment, Category, Area, Quantity, Cost, Status, Actions)
  - Set up DataTables with pagination
  - Display total inventory value at bottom

  - _Requirements: 1.3, 1.5, 5.5_

- [ ] 4.5 Implement jsonMaterial() method
  - Define form fields structure
  - Add photo upload field with validation message
  - Add code input field with format placeholder
  - Add zone select field
  - Add equipment/material name input field
  - Add category select field
  - Add area select field
  - Add quantity input field with number validation
  - Add unit cost input field with currency validation
  - _Requirements: 2.2, 2.3_

- [ ] 4.6 Implement addMaterial() method
  - Use createModalForm() component
  - Set modal title to "Nuevo Material"
  - Pass jsonMaterial() structure
  - Implement success callback to refresh table
  - Add photo format and size validation
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [ ] 4.7 Implement editMaterial() method
  - Fetch material data using useFetch()
  - Use createModalForm() component
  - Set modal title to "Editar Material"
  - Pass jsonMaterial() structure with autofill
  - Implement success callback to refresh table
  - Add option to remove existing photo
  - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6_

- [ ] 4.8 Implement deleteMaterial() method
  - Use swalQuestion() component
  - Display material code and name in confirmation
  - Show "¿Está seguro?" title
  - Add warning about permanent deletion
  - Implement success callback to refresh table
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [ ]* 4.9 Write property test for search partial matching
  - **Property 3: Search partial matching**
  - **Validates: Requirements 5.4**

- [ ]* 4.10 Write property test for filter state persistence
  - **Property 8: Filter state persistence**
  - **Validates: Requirements 5.6**

- [ ]* 4.11 Write property test for dynamic table update
  - **Property 9: Dynamic table update**
  - **Validates: Requirements 2.6, 3.5, 4.5**

- [ ] 5. Implement photo upload functionality
- [ ] 5.1 Add file input validation in frontend
  - Validate file extension (JPG, PNG, GIF)
  - Validate file size (max 5MB)
  - Display error messages for invalid files
  - Show preview of uploaded image
  - _Requirements: 2.4, 7.2, 7.3, 7.5_

- [ ] 5.2 Implement photo upload handler in controller
  - Create uploadPhoto() method
  - Validate file type and size on server
  - Generate unique filename
  - Move file to uploads directory
  - Return file path for database storage
  - _Requirements: 2.4, 7.1, 7.2, 7.3_

- [ ] 5.3 Implement photo deletion functionality
  - Add removePhoto() method in controller
  - Delete physical file from server
  - Update database to remove photo reference
  - _Requirements: 3.3, 7.6_

- [ ]* 5.4 Write property test for photo format validation
  - **Property 5: Photo format validation**
  - **Validates: Requirements 7.2, 7.3**

- [ ]* 5.5 Write property test for photo preview display
  - **Property 11: Photo preview display**
  - **Validates: Requirements 7.5**

- [ ] 6. Implement validation and error handling
- [ ] 6.1 Add frontend form validation
  - Validate required fields before submission
  - Validate code format (AR-XX-XX-XXX)
  - Validate quantity is positive integer
  - Validate cost is positive number
  - Display inline error messages
  - _Requirements: 2.3, 8.2_

- [ ] 6.2 Add backend validation
  - Validate all required fields in controller


  - Check for duplicate codes
  - Sanitize all inputs using $util->sql()
  - Return appropriate error status codes
  - _Requirements: 2.3, 8.3_

- [ ]* 6.3 Write property test for required field validation
  - **Property 6: Required field validation**
  - **Validates: Requirements 2.3**

- [ ]* 6.4 Write property test for material deletion confirmation
  - **Property 7: Material deletion confirmation**
  - **Validates: Requirements 4.2**

- [ ]* 6.5 Write property test for edit form data preload
  - **Property 12: Edit form data preload**
  - **Validates: Requirements 3.1**

- [ ] 7. Implement total value calculation
- [ ] 7.1 Add calculation logic in controller
  - Calculate total value in lsMateriales() method
  - Sum (quantity × unit cost) for all materials
  - Apply calculation to filtered results
  - Return total value with table data
  - _Requirements: 6.1, 6.2_

- [ ] 7.2 Display total value in frontend
  - Show total value at bottom of table
  - Format value as currency
  - Update total when filters change
  - Update total after CRUD operations
  - _Requirements: 1.5, 6.3, 6.4, 6.5_

- [ ] 8. Create index.php entry point
  - Create HTML structure with root div
  - Include CoffeeSoft framework scripts
  - Include jQuery and TailwindCSS
  - Include almacen.js script
  - Initialize App instance on document ready
  - _Requirements: All_

- [ ] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Integration testing and bug fixes
- [ ] 10.1 Test complete material registration flow
  - Test adding material with all fields
  - Test adding material with photo
  - Verify material appears in table
  - Verify total value updates
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [ ] 10.2 Test material editing flow
  - Test editing all material fields
  - Test replacing photo
  - Test removing photo
  - Verify changes reflect in table
  - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6_

- [ ] 10.3 Test material deletion flow
  - Test deletion confirmation dialog
  - Test successful deletion
  - Test cancellation of deletion
  - Verify material removed from table
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [ ] 10.4 Test filter and search functionality
  - Test single filter (zone, category, area)
  - Test multiple filters combined
  - Test search by code
  - Test search by name
  - Test filter persistence
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [ ] 10.5 Test photo upload functionality
  - Test valid photo formats
  - Test invalid photo formats
  - Test photo size limit
  - Test photo preview
  - Test photo removal
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ] 10.6 Test validation and error handling
  - Test required field validation
  - Test code format validation
  - Test duplicate code validation
  - Test numeric field validation
  - Test error messages display
  - _Requirements: 2.3, 8.2, 8.3_

- [ ] 10.7 Test total value calculation
  - Test calculation with empty inventory
  - Test calculation with multiple materials
  - Test calculation with filters applied
  - Test calculation after CRUD operations
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 11. Final Checkpoint - Make sure all tests are passing
  - Ensure all tests pass, ask the user if questions arise.
