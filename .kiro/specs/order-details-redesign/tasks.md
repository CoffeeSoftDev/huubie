# Implementation Plan

- [x] 1. Enhance Modal Container and Layout Structure

  - Modify `showOrderDetails` method to use larger modal size ('xl' instead of 'small')
  - Update modal className to 'order-details-enhanced-modal' for custom styling
  - Implement responsive layout detection system with mobile/tablet/desktop breakpoints
  - Create layout manager utility to handle different screen size adaptations
  - Add CSS custom properties for consistent theming across card types

  - _Requirements: 3.4, 4.1, 4.2, 4.3_

- [x] 2. Create Order Information Panel Components

  - Implement `renderCustomerInfo` method to display customer details with icons and proper styling

  - Create `renderOrderInfo` method for order date, time, and notes display
  - Build `renderFinancialSummary` method with color-coded balance indicators
  - Design left-side panel layout with proper spacing and visual hierarchy
  - Add responsive behavior for order info panel (full width on mobile, 1/3 width on desktop)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3_

- [x] 3. Implement Product Card Factory System

  - Create `ProductCardFactory` class with static methods for card type detection
  - Implement card type identification logic based on `is_custom` and `customer_products` properties
  - Build factory pattern to instantiate appropriate card classes
  - Add error handling for undefined or malformed product data
  - Create base card interface for consistent method signatures
  - _Requirements: 1.1, 2.1, 7.1, 7.2_

- [x] 4. Build Normal Product Card Component

  - Create `NormalProductCard` class with complete render method
  - Implement product image rendering with fallback placeholder handling
  - Design standard card layout with image, name, price, quantity, and total
  - Add support for dedication and observation display when present
  - Apply standard card styling with gray borders and consistent spacing
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 7.3_

- [x] 5. Develop Personalized Product Card Component

  - Create `PersonalizedProductCard` class with expanded card layout
  - Implement "Personalizado" badge with purple gradient styling
  - Build two-column grid layout for desktop (images/basic info left, customization right)
  - Design uploaded images gallery with grid display and click functionality
  - Add customization details grouping and display system
  - _Requirements: 2.1, 2.2, 2.3, 6.1, 6.2, 7.1, 7.2_

- [x] 6. Implement Customization Data Display

  - Create customization grouping logic by modifier type (cobertura, formas, relleno, etc.)
  - Build customization details rendering with pricing information
  - Implement pricing calculation for base price + customization costs
  - Design visual hierarchy for customization categories and items
  - Add handling for missing or empty customization data
  - _Requirements: 2.3, 2.4, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 7. Build Image Gallery System for Personalized Cards

  - Implement uploaded images display in grid format
  - Create image preview functionality with proper URL handling
  - Add click-to-enlarge functionality for reference images
  - Implement fallback display for orders without uploaded images
  - Add loading states and error handling for image display
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 8. Implement Responsive Design System

  - Create responsive breakpoint detection and layout switching
  - Implement mobile-first approach with vertical stacking on small screens
  - Add tablet-specific layout adaptations with flexible columns
  - Ensure touch-friendly interface elements for mobile devices
  - Test and optimize layout transitions between screen sizes
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 9. Add Visual Distinction and Styling

  - Implement purple gradient background and borders for personalized cards
  - Create standard gray styling for normal product cards
  - Add distinctive "Personalizado" badge with icon and purple theming
  - Ensure consistent spacing and alignment across different card types
  - Apply proper color coding for financial information (red/green for balance)
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_


- [x] 10. Integrate Enhanced Modal with Existing System






  - Update existing `showOrderDetails` calls to use new enhanced version
  - Ensure backward compatibility with current order data structure
  - Test integration with existing order management workflow
  - Verify modal opening/closing behavior works correctly
  - Update any dependent components that interact with order details modal
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 11. Add Performance Optimizations

  - Implement progressive image loading for better initial load times
  - Add loading indicators for data fetching and image loading
  - Optimize DOM manipulation using document fragments for multiple cards
  - Implement caching for repeated modal openings
  - Add debounced resize handlers for responsive behavior
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 12. Implement Error Handling and Edge Cases

  - Add null/undefined checks for all product properties
  - Handle missing image URLs with appropriate fallbacks
  - Implement graceful degradation for incomplete customization data
  - Add error states for failed data loading
  - Create fallback displays for empty or malformed order data
  - _Requirements: 1.5, 2.5, 5.5, 6.4, 6.5_

- [ ]\* 13. Add Unit Tests for Card Components

  - Write tests for ProductCardFactory card type detection
  - Test NormalProductCard rendering with various data scenarios
  - Test PersonalizedProductCard rendering and customization display
  - Verify responsive layout behavior across different screen sizes
  - Test error handling and edge cases for both card types
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 4.1, 4.2, 4.3_

- [ ]\* 14. Add Integration Tests for Modal System

  - Test complete modal opening and data loading workflow
  - Verify order information panel displays correctly
  - Test product card rendering for mixed order types (normal + personalized)
  - Validate responsive behavior and layout switching
  - Test modal closing and cleanup functionality
  - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 8.1, 8.2_

- [ ] 15. Update CSS and Styling Framework
  - Add custom CSS classes for enhanced modal styling
  - Implement CSS custom properties for consistent theming
  - Create responsive utility classes for layout management
  - Add animation classes for smooth transitions and loading states
  - Ensure TailwindCSS integration works properly with new components
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 4.1, 4.2, 4.3_
