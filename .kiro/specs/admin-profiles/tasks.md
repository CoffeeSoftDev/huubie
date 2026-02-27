# Implementation Plan - Admin Profiles Module

- [x] 1. Set up project structure and database schema


  - Create directory structure for admin module (ctrl, mdl, js folders)
  - Create database tables (users, profiles, udn, user_profiles)
  - Set up index.php with session validation and CoffeeSoft framework imports
  - _Requirements: 9.1, 9.2_



- [ ] 2. Implement data models and core database operations
- [ ] 2.1 Create User model methods
  - Implement listUsers() for retrieving users with filters
  - Implement getUserById() for single user retrieval
  - Implement existsUserByUsername() for uniqueness validation
  - Implement createUser() for user creation
  - Implement updateUser() for user updates
  - Implement deleteUserById() for user deletion
  - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.7, 2.9_

- [ ]* 2.2 Write property test for user creation with unique username
  - **Property 3: User creation with unique username**
  - **Validates: Requirements 2.4**

- [x]* 2.3 Write property test for duplicate username prevention

  - **Property 4: Duplicate username prevention**
  - **Validates: Requirements 2.5**

- [ ] 2.4 Create Profile model methods
  - Implement listProfiles() for retrieving profiles with filters
  - Implement getProfileById() for single profile retrieval
  - Implement createProfile() for profile creation
  - Implement updateProfile() for profile updates
  - _Requirements: 3.1, 3.2, 3.4, 3.6, 3.8_


- [ ]* 2.5 Write property test for profile status toggle
  - **Property 8: Profile status toggle**
  - **Validates: Requirements 3.8**

- [ ] 2.6 Create UDN model methods
  - Implement listUDN() for retrieving business units with filters
  - Implement getUDNById() for single UDN retrieval
  - Implement createUDN() for UDN creation
  - Implement updateUDN() for UDN updates
  - Implement deleteUDNById() for UDN deletion
  - _Requirements: 4.1, 4.2, 4.4, 4.6, 4.8_


- [ ]* 2.7 Write property test for UDN deletion completeness
  - **Property 10: UDN deletion completeness**
  - **Validates: Requirements 4.8**

- [ ] 2.8 Create profile assignment model methods
  - Implement assignProfileToUser() for assigning profiles
  - Implement removeProfileFromUser() for removing profiles
  - Implement getUserProfiles() for retrieving user's profiles
  - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [ ]* 2.9 Write property test for profile assignment persistence
  - **Property 11: Profile assignment persistence**
  - **Validates: Requirements 5.3, 5.4**



- [x]* 2.10 Write property test for profile removal completeness

  - **Property 12: Profile removal completeness**
  - **Validates: Requirements 5.5**

- [ ] 3. Implement backend controller (ctrl-admin.php)
- [ ] 3.1 Create init() method
  - Implement init() to return filter data (status lists, etc.)
  - _Requirements: 6.1_

- [ ] 3.2 Implement User controller methods
  - Implement lsUsers() to format user list for frontend
  - Implement getUser() to retrieve single user data
  - Implement addUser() with validation and error handling
  - Implement editUser() with validation
  - Implement deleteUser() with permission checks
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_


- [ ]* 3.3 Write property test for user data persistence
  - **Property 5: User data persistence**
  - **Validates: Requirements 2.7**

- [ ]* 3.4 Write property test for user deletion completeness
  - **Property 6: User deletion completeness**

  - **Validates: Requirements 2.9**

- [ ] 3.5 Implement Profile controller methods
  - Implement lsProfiles() to format profile list for frontend
  - Implement getProfile() to retrieve single profile data
  - Implement addProfile() with validation
  - Implement editProfile() with validation

  - Implement statusProfile() to toggle active/inactive status
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [ ] 3.6 Implement UDN controller methods
  - Implement lsUDN() to format UDN list for frontend


  - Implement getUDN() to retrieve single UDN data
  - Implement addUDN() with validation
  - Implement editUDN() with validation
  - Implement deleteUDN() with permission checks
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

- [ ] 3.7 Implement profile assignment controller methods
  - Implement assignProfile() to assign profile to user
  - Implement removeProfile() to remove profile from user
  - Implement getUserProfiles() to get user's assigned profiles
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 3.8 Create helper functions
  - Implement renderStatus() for status badge rendering
  - Implement dropdown() for action menu generation
  - Implement formatSpanishDate() for date formatting
  - _Requirements: 2.2, 3.2, 4.2_

- [ ] 4. Checkpoint - Ensure backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement frontend structure (admin.js)
- [x] 5.1 Create App class (main controller)


  - Extend Templates class
  - Implement constructor with PROJECT_NAME
  - Implement render() method to initialize module
  - Implement layout() method with primaryLayout
  - Implement layoutTabs() for tab navigation
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_


- [ ] 5.2 Create dashboard display
  - Implement dashboard metrics display (total users, active users, profiles, UDN)
  - Implement system status information display
  - Use infoCard component for metrics
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ]* 5.3 Write property test for dashboard metrics accuracy
  - **Property 1: Dashboard metrics accuracy**
  - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**



- [ ] 6. Implement Users management (Users class)
- [ ] 6.1 Create Users class structure
  - Extend Templates class
  - Implement constructor with PROJECT_NAME

  - Implement render() method
  - Implement layout() method with primaryLayout
  - _Requirements: 2.1_

- [ ] 6.2 Implement user list display
  - Implement filterBarUsers() with status filter and "Nuevo Usuario" button
  - Implement lsUsers() using createTable component
  - Configure table with DataTables, theme, and action columns
  - _Requirements: 2.1, 2.2, 6.1, 6.3_


- [ ]* 6.3 Write property test for entity list display completeness
  - **Property 2: Entity list display completeness**
  - **Validates: Requirements 2.2, 3.2, 4.2**

- [ ] 6.4 Implement user creation
  - Implement jsonUser() with form field definitions
  - Implement addUser() using createModalForm component
  - Add validation for required fields
  - Handle success and error responses
  - _Requirements: 2.3, 2.4, 2.5, 7.1, 7.2, 7.3, 7.4_

- [ ]* 6.5 Write property test for required field validation
  - **Property 15: Required field validation**
  - **Validates: Requirements 7.1**

- [ ]* 6.6 Write property test for email format validation
  - **Property 16: Email format validation**
  - **Validates: Requirements 7.2**

- [ ]* 6.7 Write property test for username format validation
  - **Property 17: Username format validation**

  - **Validates: Requirements 7.3**

- [ ]* 6.8 Write property test for password length validation
  - **Property 18: Password length validation**
  - **Validates: Requirements 7.4**


- [ ] 6.9 Implement user editing
  - Implement editUser(id) with async data fetch
  - Use createModalForm with autofill
  - Handle update success and error responses
  - _Requirements: 2.6, 2.7_


- [ ] 6.10 Implement user deletion
  - Implement deleteUser(id) using swalQuestion component
  - Add warning about permanent deletion
  - Handle deletion confirmation and response
  - _Requirements: 2.8, 2.9_


- [ ] 7. Implement Profiles management (Profiles class)
- [ ] 7.1 Create Profiles class structure
  - Extend Templates class
  - Implement constructor with PROJECT_NAME

  - Implement render() method
  - Implement layout() method with primaryLayout
  - _Requirements: 3.1_

- [x] 7.2 Implement profile list display

  - Implement filterBarProfiles() with status filter and "Nuevo Perfil" button
  - Implement lsProfiles() using createTable component
  - Configure table with DataTables and action columns
  - _Requirements: 3.1, 3.2, 6.1_


- [ ] 7.3 Implement profile creation
  - Implement jsonProfile() with form field definitions
  - Implement addProfile() using createModalForm component
  - Handle success and error responses
  - _Requirements: 3.3, 3.4_


- [ ] 7.4 Implement profile editing
  - Implement editProfile(id) with async data fetch
  - Use createModalForm with autofill
  - Handle update success and error responses
  - _Requirements: 3.5, 3.6_


- [ ] 7.5 Implement profile status toggle
  - Implement statusProfile(id, status) using swalQuestion component
  - Toggle between active and inactive states
  - Handle status change confirmation and response
  - _Requirements: 3.7, 3.8_


- [ ] 8. Implement UDN management (UDN class)
- [ ] 8.1 Create UDN class structure
  - Extend Templates class
  - Implement constructor with PROJECT_NAME

  - Implement render() method
  - Implement layout() method with primaryLayout
  - _Requirements: 4.1_

- [x] 8.2 Implement UDN list display

  - Implement filterBarUDN() with status filter and "Nueva Unidad" button
  - Implement lsUDN() using createTable component
  - Configure table with DataTables and action columns
  - _Requirements: 4.1, 4.2, 6.1_

- [x] 8.3 Implement UDN creation

  - Implement jsonUDN() with form field definitions
  - Implement addUDN() using createModalForm component
  - Handle success and error responses
  - _Requirements: 4.3, 4.4_



- [ ] 8.4 Implement UDN editing
  - Implement editUDN(id) with async data fetch
  - Use createModalForm with autofill
  - Handle update success and error responses
  - _Requirements: 4.5, 4.6_

- [ ] 8.5 Implement UDN deletion
  - Implement deleteUDN(id) using swalQuestion component
  - Add warning about permanent deletion
  - Handle deletion confirmation and response
  - _Requirements: 4.7, 4.8_

- [ ] 9. Implement profile assignment functionality
- [ ] 9.1 Add profile assignment UI to user rows
  - Add assign profile icon/button to user table actions
  - Implement modal to display available profiles
  - _Requirements: 5.1, 5.2_

- [ ] 9.2 Implement profile assignment logic
  - Implement assignProfile(userId, profileId) method
  - Handle assignment success and update UI
  - Display assigned profiles as badges on user rows
  - _Requirements: 5.3, 5.4_

- [ ] 9.3 Implement profile removal logic
  - Implement removeProfile(userId, profileId) method
  - Handle removal success and update UI
  - _Requirements: 5.5_

- [ ] 10. Implement filtering and search functionality
- [ ] 10.1 Implement status filtering
  - Add status filter to all filter bars
  - Implement filter change handlers to refresh tables
  - _Requirements: 6.1, 6.3_

- [ ]* 10.2 Write property test for filter application and clearing
  - **Property 13: Filter application and clearing**
  - **Validates: Requirements 6.3, 6.4**

- [ ] 10.2 Implement search functionality
  - Add search input to filter bars
  - Implement real-time search filtering
  - Handle empty results with appropriate message
  - _Requirements: 6.2, 6.5_

- [ ]* 10.3 Write property test for search filtering accuracy
  - **Property 14: Search filtering accuracy**
  - **Validates: Requirements 6.2**

- [ ] 10.4 Implement filter clearing
  - Add clear filters button
  - Implement reset to show all records
  - _Requirements: 6.4_

- [ ] 11. Implement validation and feedback
- [ ] 11.1 Implement client-side validation
  - Add required field validation to all forms
  - Add email format validation
  - Add username format validation (alphanumeric + underscore only)
  - Add password length validation (minimum 8 characters)
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ]* 11.2 Write property test for valid form submission
  - **Property 19: Valid form submission**
  - **Validates: Requirements 7.5**

- [ ] 11.3 Implement visual feedback
  - Add loading indicators for all AJAX requests
  - Implement success notifications using alert() component
  - Implement error notifications with details
  - Add hover effects to action buttons
  - Add loading states for data fetching
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ]* 11.4 Write property test for action feedback consistency
  - **Property 20: Action feedback consistency**
  - **Validates: Requirements 8.1, 8.2, 8.3**

- [ ] 12. Implement session security
- [ ] 12.1 Add session validation to index.php
  - Validate IDU cookie on page load
  - Redirect to logout if session invalid
  - _Requirements: 9.1, 9.2_

- [ ]* 12.2 Write property test for session validation on access
  - **Property 21: Session validation on access**
  - **Validates: Requirements 9.1, 9.3**

- [ ]* 12.3 Write property test for invalid session handling
  - **Property 22: Invalid session handling**
  - **Validates: Requirements 9.2**

- [ ] 12.4 Add permission checks to sensitive operations
  - Validate admin role before delete operations
  - Re-validate permissions for sensitive actions
  - Handle session expiration during use
  - _Requirements: 9.3, 9.4, 9.5_

- [ ] 13. Implement responsive design
- [ ] 13.1 Configure responsive layouts
  - Use TailwindCSS responsive classes for all components
  - Configure primaryLayout for responsive behavior
  - Ensure tabs work on mobile devices
  - _Requirements: 10.1, 10.2, 10.3_

- [ ] 13.2 Optimize tables for small screens
  - Configure DataTables for responsive mode
  - Add horizontal scrolling for tables on mobile
  - Ensure action buttons remain accessible
  - _Requirements: 10.4_

- [ ] 13.3 Optimize modals for mobile
  - Configure modals to display full-screen on mobile
  - Ensure form inputs are touch-friendly
  - Test modal scrolling on small screens
  - _Requirements: 10.5_

- [ ]* 13.4 Write property test for responsive layout adaptation
  - **Property 23: Responsive layout adaptation**
  - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**

- [ ] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Integration and deployment
- [ ] 15.1 Integrate with existing system
  - Ensure compatibility with existing navbar and sidebar
  - Test navigation from other modules
  - Verify session sharing with other modules
  - _Requirements: All_

- [ ] 15.2 Performance optimization
  - Implement lazy loading for tabs
  - Add debouncing to search inputs
  - Optimize database queries with proper indexes
  - _Requirements: All_

- [ ] 15.3 Final testing and deployment
  - Test all workflows end-to-end
  - Verify all validations work correctly
  - Test on different browsers and devices
  - Deploy to staging environment
  - Conduct user acceptance testing
  - Deploy to production
  - _Requirements: All_
