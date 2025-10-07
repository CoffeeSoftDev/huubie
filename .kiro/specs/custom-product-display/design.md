# Design Document

## Overview

El diseño se enfoca en modificar el método `orderProductList` en la clase `App` para detectar productos personalizados y renderizar una interfaz visual diferenciada. La solución mantiene la compatibilidad con productos regulares mientras introduce un nuevo patrón visual para productos personalizados.

## Architecture

### Component Structure
- **Existing Component**: `orderProductList` method in `App` class
- **Data Source**: `getOrderDetails` API response with `products` array
- **Detection Logic**: Check `is_custom` property on each product object
- **Rendering Strategy**: Conditional rendering based on product type

### Data Flow
1. API returns product data with `is_custom` boolean flag
2. `orderProductList` iterates through products array
3. For each product, check `is_custom` property
4. Apply appropriate rendering template based on product type
5. Maintain existing functionality for regular products

## Components and Interfaces

### Modified Method: `orderProductList`

**Input Interface:**
```javascript
{
  parent: string,           // Container element ID
  json: Array<Product>      // Products array from API
}
```

**Product Interface:**
```javascript
{
  name: string,
  price: number,
  quantity: number,
  is_custom: boolean,       // New detection property
  image?: string,
  dedication?: string,
  order_details?: string,
  images?: Array<ImageObject>
}
```

### Visual Components

#### Regular Product Card
- Maintains existing design
- Shows product image or fallback icon
- Standard background colors

#### Custom Product Card
- **Background**: Purple theme (`bg-purple-900/20` or similar)
- **Icon**: `icon-birthday` in place of image
- **Label**: "personalizado" span below product name
- **Image Container**: Purple background with centered icon

## Data Models

### Product Detection Logic
```javascript
const isCustomProduct = product.is_custom === true;
```

### Styling Classes
- **Custom Card**: `bg-purple-900/20 border-purple-500/30`
- **Custom Icon Container**: `bg-purple-600 text-purple-200`
- **Custom Label**: `text-purple-300 text-sm italic`

## Error Handling

### Fallback Scenarios
1. **Missing `is_custom` property**: Treat as regular product
2. **Invalid `is_custom` value**: Treat as regular product
3. **Missing product data**: Show existing error state
4. **Rendering errors**: Graceful degradation to regular product view

### Validation
- Check if `is_custom` exists and is boolean
- Validate product object structure before rendering
- Ensure icon classes are available in the system

## Testing Strategy

### Unit Testing Areas
1. **Product Type Detection**: Verify `is_custom` flag detection
2. **Conditional Rendering**: Test both product types render correctly
3. **Styling Application**: Verify purple theme is applied correctly
4. **Fallback Behavior**: Test handling of missing/invalid data

### Integration Testing
1. **API Integration**: Test with real API responses containing custom products
2. **UI Consistency**: Verify visual consistency across different screen sizes
3. **Performance**: Ensure no performance degradation with mixed product types

### Visual Testing
1. **Custom Product Display**: Verify purple card with icon and label
2. **Regular Product Display**: Ensure existing functionality unchanged
3. **Mixed Lists**: Test lists containing both product types
4. **Responsive Design**: Test on different viewport sizes

## Implementation Notes

### Code Organization
- Keep existing `orderProductList` structure
- Add conditional logic for custom products
- Extract custom product template for maintainability
- Preserve all existing functionality

### Performance Considerations
- Minimal impact on rendering performance
- No additional API calls required
- Efficient conditional rendering

### Accessibility
- Maintain semantic HTML structure
- Ensure proper contrast ratios for purple theme
- Add appropriate ARIA labels for custom products

### Browser Compatibility
- Use existing CSS framework (TailwindCSS)
- Leverage existing icon system
- No new dependencies required