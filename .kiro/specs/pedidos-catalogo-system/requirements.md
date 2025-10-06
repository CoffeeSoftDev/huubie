# Requirements Document

## Introduction

The Pedidos Catálogo System is a comprehensive Point of Sale (POS) and order management system designed specifically for bakeries and pastry shops. The system enables staff to create orders, manage product catalogs, process payments, and handle custom cake orders with image uploads and special dedications. It provides a modern, responsive interface optimized for both desktop and tablet use in a bakery environment.

## Requirements

### Requirement 1

**User Story:** As a bakery staff member, I want to create and manage customer orders through an intuitive POS interface, so that I can efficiently process sales and track inventory.

#### Acceptance Criteria

1. WHEN the staff member accesses the system THEN the system SHALL display a dual-pane interface with product catalog on the left and order panel on the right
2. WHEN the staff member searches for products THEN the system SHALL filter products in real-time based on the search keyword
3. WHEN the staff member selects a product THEN the system SHALL add it to the current order with default quantity of 1
4. WHEN the staff member views the order panel THEN the system SHALL display all added products with quantities, prices, and total amount
5. WHEN the staff member modifies product quantities THEN the system SHALL update the order total automatically

### Requirement 2

**User Story:** As a bakery staff member, I want to manage product categories and filter products by category, so that I can quickly find specific types of baked goods.

#### Acceptance Criteria

1. WHEN the staff member views the product catalog THEN the system SHALL display category tabs (Chocolate, Frutas, Queso, Merengue, Todos)
2. WHEN the staff member clicks a category tab THEN the system SHALL filter products to show only items from that category
3. WHEN the staff member selects "Todos" THEN the system SHALL display all available products
4. WHEN products are displayed THEN the system SHALL show product images, names, and prices in a grid layout
5. WHEN no image is available for a product THEN the system SHALL display a default icon placeholder

### Requirement 3

**User Story:** As a bakery staff member, I want to customize orders with special dedications and upload reference images, so that I can fulfill custom cake requests accurately.

#### Acceptance Criteria

1. WHEN the staff member edits a product in an order THEN the system SHALL display a modal form with dedication and observation fields
2. WHEN the staff member adds a dedication THEN the system SHALL store and display the dedication text with the order item
3. WHEN the staff member uploads reference images THEN the system SHALL accept multiple image files (JPEG, PNG)
4. WHEN images are uploaded THEN the system SHALL display image previews in the order panel
5. WHEN the staff member saves product customizations THEN the system SHALL update the order item with all custom details

### Requirement 4

**User Story:** As a bakery staff member, I want to process payments with multiple payment methods and handle partial payments, so that I can accommodate different customer payment preferences.

#### Acceptance Criteria

1. WHEN the staff member initiates payment THEN the system SHALL display a payment modal with order total and payment options
2. WHEN the staff member selects partial payment THEN the system SHALL allow entry of advance payment amount
3. WHEN the staff member chooses a payment method THEN the system SHALL accept Efectivo, Tarjeta, or Transferencia
4. WHEN payment is processed THEN the system SHALL calculate and display remaining balance
5. WHEN payment is completed THEN the system SHALL update order status and generate receipt

### Requirement 5

**User Story:** As a bakery staff member, I want to print order receipts and tickets, so that I can provide customers with order confirmations and kitchen instructions.

#### Acceptance Criteria

1. WHEN the staff member clicks print THEN the system SHALL generate a formatted receipt with order details
2. WHEN the receipt is generated THEN the system SHALL include customer name, order items, quantities, prices, and totals
3. WHEN custom dedications exist THEN the system SHALL include dedication text in the printed receipt
4. WHEN the receipt is displayed THEN the system SHALL format it for thermal printer compatibility
5. WHEN payment information exists THEN the system SHALL include payment method and remaining balance details

### Requirement 6

**User Story:** As a bakery staff member, I want to manage order items by editing quantities, removing items, or clearing the entire order, so that I can make corrections before finalizing sales.

#### Acceptance Criteria

1. WHEN the staff member clicks quantity buttons THEN the system SHALL increase or decrease item quantities
2. WHEN quantity reaches zero THEN the system SHALL remove the item from the order
3. WHEN the staff member clicks remove item THEN the system SHALL delete the specific item from the order
4. WHEN the staff member clicks clear order THEN the system SHALL prompt for confirmation before removing all items
5. WHEN order modifications are made THEN the system SHALL recalculate totals automatically

### Requirement 7

**User Story:** As a bakery staff member, I want the system to handle custom cake building functionality, so that I can create personalized cake orders with specific requirements.

#### Acceptance Criteria

1. WHEN the staff member clicks "¡Arma tu pastel!" THEN the system SHALL launch the custom cake builder interface
2. WHEN editing a custom cake order THEN the system SHALL display specialized editing options for cake customization
3. WHEN a custom cake is added to order THEN the system SHALL mark it as a personalized order with special indicators
4. WHEN custom cake details are saved THEN the system SHALL store all customization parameters
5. WHEN custom cakes are displayed in order THEN the system SHALL show distinctive visual indicators

### Requirement 8

**User Story:** As a bakery staff member, I want the system to provide responsive design and touch-friendly interface, so that I can use it effectively on tablets and touch devices.

#### Acceptance Criteria

1. WHEN the system is accessed on different screen sizes THEN the system SHALL adapt layout responsively
2. WHEN used on mobile/tablet devices THEN the system SHALL provide touch-friendly button sizes and interactions
3. WHEN the interface is displayed THEN the system SHALL use appropriate font sizes and spacing for readability
4. WHEN switching between desktop and mobile views THEN the system SHALL maintain functionality across all screen sizes
5. WHEN touch interactions are used THEN the system SHALL provide appropriate visual feedback

### Requirement 9

**User Story:** As a bakery staff member, I want to view detailed product information in a modal preview, so that I can see complete product details before adding items to an order.

#### Acceptance Criteria

1. WHEN the staff member clicks the eye icon on a product card THEN the system SHALL display a product details modal
2. WHEN the product details modal opens THEN the system SHALL show the product image, name, category, price, and full description
3. WHEN the product has an image THEN the system SHALL display the full-size product image in the modal
4. WHEN the product has no image THEN the system SHALL display a placeholder image or icon
5. WHEN the modal is displayed THEN the system SHALL include an "Agregar al carrito" button to add the product to the current order
6. WHEN the staff member clicks "Agregar al carrito" THEN the system SHALL add the product to the order and close the modal
7. WHEN the staff member clicks outside the modal or the close button THEN the system SHALL close the modal without adding the product

### Requirement 10

**User Story:** As a bakery staff member, I want to have an exit button in the order panel, so that I can quickly return to the orders table when I need to navigate away from the current order interface.

#### Acceptance Criteria

1. WHEN the staff member views the order panel footer THEN the system SHALL display an "Exit" button alongside the "Print" and "Finish" buttons
2. WHEN the staff member clicks the "Exit" button THEN the system SHALL navigate back to the orders table interface
3. WHEN the "Exit" button is displayed THEN the system SHALL position it after the "Finish" button in the button layout
4. WHEN the "Exit" button is clicked THEN the system SHALL return to the main orders table view without requiring confirmation
5. WHEN the button layout is rendered THEN the system SHALL maintain proper spacing and visual consistency with existing buttons