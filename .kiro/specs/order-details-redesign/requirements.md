# Requirements Document

## Introduction

The Order Details Redesign feature enhances the existing `showOrderDetails` modal in the Pedidos system to provide a more comprehensive and visually appealing display of order information. The redesign introduces two distinct card types for different product categories (normal products and personalized cakes) and improves the overall layout with better information organization and responsive design.

## Requirements

### Requirement 1

**User Story:** As a bakery staff member, I want to see normal products displayed in a clean, organized card format, so that I can quickly review standard order items with their essential information.

#### Acceptance Criteria

1. WHEN viewing normal products in order details THEN the system SHALL display each product in a standard card format
2. WHEN a normal product card is rendered THEN the system SHALL include product image, name, unit price, quantity, and total price
3. WHEN a normal product has observations or dedication THEN the system SHALL display this additional information below the main product details
4. WHEN the product image is available THEN the system SHALL display it with proper scaling and fallback handling
5. WHEN the product image is missing THEN the system SHALL show a default placeholder icon

### Requirement 2

**User Story:** As a bakery staff member, I want to see personalized cake orders displayed in an expanded card format with detailed customization information, so that I can understand all the specific requirements for custom orders.

#### Acceptance Criteria

1. WHEN viewing personalized cake products THEN the system SHALL display them in an expanded card format larger than normal products
2. WHEN a personalized cake card is rendered THEN the system SHALL include a "Personalizado" label/badge to distinguish it from normal products
3. WHEN personalized cake details are shown THEN the system SHALL display customization options including cobertura, formas, relleno, tamaños, and extras
4. WHEN uploaded images exist for personalized cakes THEN the system SHALL display all customer-uploaded reference images
5. WHEN personalized cake pricing is shown THEN the system SHALL display the actual cake price prominently

### Requirement 3

**User Story:** As a bakery staff member, I want to see order information and financial summary positioned on the left side of the modal, so that I can have a clear overview of the order while reviewing product details.

#### Acceptance Criteria

1. WHEN the order details modal opens THEN the system SHALL position order information and financial summary on the left side
2. WHEN displaying order information THEN the system SHALL include customer details, order date, delivery time, and special notes
3. WHEN showing financial summary THEN the system SHALL display total amount, paid amount, and remaining balance
4. WHEN the layout is rendered THEN the system SHALL maintain clear visual separation between order info and product details
5. WHEN financial information is displayed THEN the system SHALL use appropriate color coding for different financial states

### Requirement 4

**User Story:** As a bakery staff member, I want the order details modal to be fully responsive, so that I can view order information clearly on different devices including tablets and mobile phones.

#### Acceptance Criteria

1. WHEN the modal is viewed on desktop THEN the system SHALL display a two-column layout with order info on left and products on right
2. WHEN the modal is viewed on tablet devices THEN the system SHALL adapt the layout while maintaining readability
3. WHEN the modal is viewed on mobile devices THEN the system SHALL stack the layout vertically with order info at top and products below
4. WHEN switching between screen sizes THEN the system SHALL maintain all functionality and information visibility
5. WHEN touch interactions are used THEN the system SHALL provide appropriate touch-friendly interface elements

### Requirement 5

**User Story:** As a bakery staff member, I want personalized cake cards to display detailed customization data in an organized manner, so that I can understand all the specific modifications requested by the customer.

#### Acceptance Criteria

1. WHEN displaying customization data THEN the system SHALL organize information into clear sections (cobertura, formas, relleno, tamaños, extras)
2. WHEN showing customization options THEN the system SHALL display each option with its corresponding details and pricing if applicable
3. WHEN multiple customization categories exist THEN the system SHALL present them in a logical, easy-to-read format
4. WHEN customization pricing is shown THEN the system SHALL clearly indicate individual option costs and total customization cost
5. WHEN no customization data exists THEN the system SHALL handle this gracefully without displaying empty sections

### Requirement 6

**User Story:** As a bakery staff member, I want to see customer-uploaded images for personalized orders displayed prominently, so that I can reference the visual requirements for custom cake creation.

#### Acceptance Criteria

1. WHEN personalized orders have uploaded images THEN the system SHALL display all images in a gallery format
2. WHEN multiple images are present THEN the system SHALL organize them in a grid or carousel layout
3. WHEN an image is clicked THEN the system SHALL provide a larger view or zoom functionality
4. WHEN images are displayed THEN the system SHALL include proper loading states and error handling
5. WHEN no images are uploaded THEN the system SHALL not display an empty image section

### Requirement 7

**User Story:** As a bakery staff member, I want the visual distinction between normal and personalized product cards to be immediately apparent, so that I can quickly identify the type of order items I'm reviewing.

#### Acceptance Criteria

1. WHEN both card types are displayed THEN the system SHALL use different visual styling to distinguish between normal and personalized products
2. WHEN personalized cards are shown THEN the system SHALL use distinctive colors, borders, or backgrounds to highlight their special nature
3. WHEN normal cards are displayed THEN the system SHALL use standard styling that doesn't compete with personalized card emphasis
4. WHEN cards are rendered THEN the system SHALL maintain consistent spacing and alignment regardless of card type
5. WHEN the "Personalizado" label is shown THEN the system SHALL use prominent styling that clearly identifies the product as customized

### Requirement 8

**User Story:** As a bakery staff member, I want the order details modal to load quickly and efficiently, so that I can access order information without delays during busy periods.

#### Acceptance Criteria

1. WHEN the modal is opened THEN the system SHALL load and display content within 2 seconds under normal network conditions
2. WHEN large images are present THEN the system SHALL implement progressive loading to show content incrementally
3. WHEN data is being loaded THEN the system SHALL display appropriate loading indicators
4. WHEN network issues occur THEN the system SHALL provide clear error messages and retry options
5. WHEN the modal is closed and reopened THEN the system SHALL utilize caching to improve subsequent load times