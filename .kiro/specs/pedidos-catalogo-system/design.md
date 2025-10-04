# Design Document

## Overview

The Pedidos Catálogo System is designed as a modern Point of Sale (POS) interface specifically tailored for bakeries and pastry shops. The system follows a dual-pane layout architecture with a responsive design that adapts to different screen sizes. The left pane contains the product catalog with search and category filtering capabilities, while the right pane manages the current order with payment processing functionality.

The system is built using jQuery with TailwindCSS for styling, following the CoffeeSoft framework patterns. It integrates with a PHP backend using the MVC architecture pattern for data management and business logic.

## Architecture

### Frontend Architecture
- **Framework**: jQuery with CoffeeSoft Templates
- **Styling**: TailwindCSS with dark theme optimization
- **Component Structure**: Modular component-based architecture
- **State Management**: Local state management with real-time updates
- **Responsive Design**: Mobile-first approach with tablet optimization

### Backend Architecture
- **Pattern**: MVC (Model-View-Controller)
- **Language**: PHP with session management
- **Database**: MySQL with CRUD operations
- **API**: RESTful endpoints with JSON responses
- **File Upload**: Multi-file image upload with validation

### Data Flow
1. Frontend components make AJAX requests to PHP controllers
2. Controllers validate input and interact with models
3. Models perform database operations using CRUD base class
4. Results are returned as JSON responses to frontend
5. Frontend updates UI components based on response data

## Components and Interfaces

### Main Layout Components

#### 1. POS Container (`createPOSContainers`)
- **Purpose**: Main layout wrapper for the entire POS interface
- **Structure**: Dual-pane layout (catalog + order panel)
- **Features**: 
  - Responsive flex layout
  - Theme support (light/dark)
  - Search functionality integration
  - Custom cake builder button

#### 2. Product Catalog Section
- **Search Bar**: Real-time product filtering
- **Category Tabs**: Product classification navigation
- **Product Grid**: Visual product display with images and prices
- **Custom Cake Button**: Special order creation trigger

#### 3. Order Panel Section
- **Order Header**: Current order information and clear button
- **Order Items**: Dynamic list of selected products
- **Order Footer**: Action buttons (Print, Finish, Exit)

### Interactive Components

#### 1. Product Tabs (`createProductTabs`)
- **Categories**: Chocolate, Frutas, Queso, Merengue, Todos
- **Behavior**: Filter products by category selection
- **Visual States**: Active/inactive tab styling
- **Events**: Category change triggers product list update

#### 2. Product Grid (`createProductGrid`)
- **Display**: Card-based product layout
- **Information**: Product image, name, price
- **Interaction**: Click to add product to order
- **Fallback**: Default icon for missing images

#### 3. Order Panel (`orderPanelComponent`)
- **Order Display**: List of selected products with quantities
- **Quantity Controls**: Increment/decrement buttons
- **Item Actions**: Edit and remove buttons per item
- **Totals**: Real-time price calculation
- **Action Buttons**: Print, Finish, and Exit functionality

### Modal Components

#### 1. Product Edit Modal
- **Fields**: Dedication text, order details, image upload
- **File Upload**: Multiple image support with preview
- **Validation**: Form validation before submission
- **Integration**: Updates order item with custom details

#### 2. Payment Modal
- **Payment Options**: Multiple payment methods
- **Partial Payments**: Advance payment functionality
- **Balance Calculation**: Real-time remaining balance
- **Payment Methods**: Efectivo, Tarjeta, Transferencia

#### 3. Receipt/Ticket Modal
- **Format**: Thermal printer compatible layout
- **Content**: Order details, customer info, payment summary
- **Branding**: Company logo and information
- **Print Ready**: Formatted for direct printing

## Data Models

### Order Model
```javascript
{
  id: number,
  folio: string,
  customer_name: string,
  customer_phone: string,
  date_order: date,
  time_order: time,
  notes: text,
  total_pay: decimal,
  status: integer,
  items: [OrderItem]
}
```

### Order Item Model
```javascript
{
  id: number,
  product_id: number,
  name: string,
  price: decimal,
  quantity: integer,
  dedication: string,
  order_details: text,
  images: [ImageFile],
  customer_id: number // for custom cakes
}
```

### Product Model
```javascript
{
  id: number,
  name: string,
  price: decimal,
  description: text,
  image: string,
  category_id: number,
  active: boolean
}
```

### Payment Model
```javascript
{
  id: number,
  order_id: number,
  method_pay: string,
  amount: decimal,
  payment_date: datetime
}
```

## Error Handling

### Frontend Error Handling
- **AJAX Failures**: Display user-friendly error messages
- **Validation Errors**: Real-time form validation feedback
- **Network Issues**: Retry mechanisms for critical operations
- **File Upload Errors**: Size and format validation with clear messaging

### Backend Error Handling
- **Database Errors**: Graceful error responses with logging
- **Validation Failures**: Structured error messages for frontend
- **File Upload Issues**: Proper error codes for different failure types
- **Session Management**: Automatic session validation and renewal

### User Experience Error Handling
- **Loading States**: Visual indicators during operations
- **Confirmation Dialogs**: For destructive actions (clear order, delete items)
- **Success Feedback**: Clear confirmation of completed actions
- **Error Recovery**: Options to retry failed operations

## Testing Strategy

### Unit Testing
- **Component Testing**: Individual component functionality
- **Model Testing**: Database operations and data validation
- **Utility Functions**: Helper functions and calculations

### Integration Testing
- **API Endpoints**: Controller and model integration
- **File Upload**: Image upload and processing workflow
- **Payment Processing**: End-to-end payment flow testing

### User Interface Testing
- **Responsive Design**: Cross-device compatibility testing
- **Touch Interface**: Tablet and mobile interaction testing
- **Browser Compatibility**: Cross-browser functionality verification

### Performance Testing
- **Load Testing**: Multiple concurrent order processing
- **Image Upload**: Large file handling and processing
- **Database Queries**: Query optimization and performance monitoring

## Navigation and User Flow

### Primary User Flow
1. **Order Creation**: Staff creates new order from orders table
2. **Product Selection**: Browse catalog and add products to order
3. **Customization**: Edit products with dedications and images
4. **Payment Processing**: Handle payment with multiple methods
5. **Order Completion**: Print receipt and finalize order
6. **Exit Navigation**: Return to orders table via exit button

### Exit Button Implementation
- **Location**: Order panel footer, positioned after "Finish" button
- **Styling**: Consistent with existing button design (gray/secondary style)
- **Functionality**: Direct navigation back to orders table
- **No Confirmation**: Immediate navigation without confirmation dialog
- **State Preservation**: Current order state maintained for potential return

### Secondary Flows
- **Custom Cake Orders**: Special workflow for personalized cakes
- **Order Modifications**: Edit existing orders and update details
- **Payment Management**: Handle partial payments and balance tracking
- **Receipt Printing**: Generate and print order confirmations

## Technical Implementation Notes

### Component Integration
- All components extend the CoffeeSoft Templates base class
- Consistent event handling patterns across components
- Modular design allows for easy component reuse and testing

### State Management
- Order state maintained in JavaScript objects
- Real-time updates trigger UI re-rendering
- Backend synchronization on all state changes

### Performance Optimization
- Lazy loading for product images
- Debounced search functionality
- Efficient DOM manipulation using jQuery
- Minimal API calls through intelligent caching

### Security Considerations
- File upload validation and sanitization
- Session-based authentication
- SQL injection prevention through prepared statements
- XSS protection through proper data escaping