# Design Document

## Overview

The Order Details Redesign enhances the existing `showOrderDetails` modal in the Pedidos system by implementing a dual-card system for different product types and reorganizing the layout for better information hierarchy. The design focuses on creating distinct visual experiences for normal products versus personalized cakes while maintaining responsive functionality across all devices.

The redesign transforms the current single-layout approach into a flexible, component-based system that can adapt to different product types and screen sizes while providing comprehensive order information in an organized manner.

## Architecture

### Component Structure
- **Modal Container**: Main bootbox dialog with enhanced sizing and responsive behavior
- **Layout Manager**: Two-column desktop layout that adapts to single-column on mobile
- **Order Information Panel**: Left-side panel containing customer and financial data
- **Product Display Area**: Right-side area with dynamic card rendering based on product type
- **Card Factory**: Component system that generates appropriate card types based on product data

### Data Flow Enhancement
1. Modal receives order data with product type identification
2. Layout manager determines screen size and applies appropriate layout
3. Order information panel renders customer and financial summary
4. Card factory analyzes each product and generates appropriate card type
5. Responsive system adjusts layout based on viewport changes

## Components and Interfaces

### Enhanced Modal Structure

#### 1. Modal Container (`showOrderDetails`)
```javascript
// Enhanced modal configuration
const modal = bootbox.dialog({
    title: `Enhanced Order Details Header`,
    message: '<div id="orderDetailsContainer" class="min-h-[500px] max-h-[80vh] overflow-hidden"></div>',
    size: 'xl', // Larger size for better content display
    closeButton: true,
    className: 'order-details-enhanced-modal'
});
```

#### 2. Responsive Layout System
```javascript
// Layout detection and application
const layoutManager = {
    isMobile: () => window.innerWidth < 768,
    isTablet: () => window.innerWidth >= 768 && window.innerWidth < 1024,
    isDesktop: () => window.innerWidth >= 1024,
    
    applyLayout: function() {
        const container = $('#orderDetailsContainer');
        if (this.isMobile()) {
            container.addClass('flex flex-col space-y-4');
        } else {
            container.addClass('flex flex-row gap-6');
        }
    }
};
```

### Order Information Panel

#### 1. Customer Information Section
```javascript
renderCustomerInfo(orderData) {
    return `
        <div class="bg-[#283341] rounded-lg p-4 mb-4">
            <h3 class="text-white font-semibold mb-3 flex items-center">
                <i class="icon-user mr-2 text-blue-400"></i>
                Información del Cliente
            </h3>
            <div class="space-y-2">
                <div class="flex justify-between">
                    <span class="text-gray-400">Nombre:</span>
                    <span class="text-white font-medium">${orderData.customer_name}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-400">Teléfono:</span>
                    <span class="text-white">${orderData.customer_phone}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-400">Folio:</span>
                    <span class="text-blue-400 font-medium">${orderData.folio}</span>
                </div>
            </div>
        </div>
    `;
}
```

#### 2. Order Details Section
```javascript
renderOrderInfo(orderData) {
    return `
        <div class="bg-[#283341] rounded-lg p-4 mb-4">
            <h3 class="text-white font-semibold mb-3 flex items-center">
                <i class="icon-calendar mr-2 text-green-400"></i>
                Detalles del Pedido
            </h3>
            <div class="space-y-2">
                <div class="flex justify-between">
                    <span class="text-gray-400">Fecha:</span>
                    <span class="text-white">${orderData.formatted_date_order}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-400">Hora:</span>
                    <span class="text-white">${orderData.time_order}</span>
                </div>
                ${orderData.notes ? `
                <div class="mt-3 pt-3 border-t border-gray-600">
                    <span class="text-gray-400 text-sm">Observaciones:</span>
                    <p class="text-gray-300 mt-1">${orderData.notes}</p>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}
```

#### 3. Financial Summary Section
```javascript
renderFinancialSummary(orderData) {
    const balanceColor = orderData.balance > 0 ? 'text-red-400' : 'text-green-400';
    const balanceIcon = orderData.balance > 0 ? 'icon-alert-circle' : 'icon-check-circle';
    
    return `
        <div class="bg-[#283341] rounded-lg p-4">
            <h3 class="text-white font-semibold mb-3 flex items-center">
                <i class="icon-dollar-sign mr-2 text-yellow-400"></i>
                Resumen Financiero
            </h3>
            <div class="space-y-3">
                <div class="flex justify-between items-center">
                    <span class="text-gray-400">Total:</span>
                    <span class="text-white font-bold text-lg">$${parseFloat(orderData.total_pay).toFixed(2)}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-400">Pagado:</span>
                    <span class="text-green-400 font-semibold">$${parseFloat(orderData.total_paid).toFixed(2)}</span>
                </div>
                <div class="border-t border-gray-600 pt-3">
                    <div class="flex justify-between items-center">
                        <span class="text-gray-400 flex items-center">
                            <i class="${balanceIcon} mr-1"></i>
                            Saldo:
                        </span>
                        <span class="${balanceColor} font-bold text-lg">$${parseFloat(orderData.balance).toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}
```

### Product Card System

#### 1. Card Factory Pattern
```javascript
class ProductCardFactory {
    static createCard(product) {
        if (product.is_custom || product.customer_products) {
            return this.createPersonalizedCard(product);
        } else {
            return this.createNormalCard(product);
        }
    }
    
    static createNormalCard(product) {
        return new NormalProductCard(product);
    }
    
    static createPersonalizedCard(product) {
        return new PersonalizedProductCard(product);
    }
}
```

#### 2. Normal Product Card
```javascript
class NormalProductCard {
    constructor(product) {
        this.product = product;
    }
    
    render() {
        const total = parseFloat(this.product.price) * parseInt(this.product.quantity);
        
        return `
            <div class="bg-[#283341] rounded-lg p-4 mb-4 border border-gray-600">
                <div class="flex gap-4">
                    <!-- Product Image -->
                    <div class="w-20 h-20 rounded-md overflow-hidden bg-[#1F2A37] flex-shrink-0">
                        ${this.renderProductImage()}
                    </div>
                    
                    <!-- Product Info -->
                    <div class="flex-1">
                        <h4 class="text-white font-semibold text-lg mb-1">${this.product.name}</h4>
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-blue-400 font-medium">$${parseFloat(this.product.price).toFixed(2)} c/u</span>
                            <div class="flex items-center gap-2">
                                <span class="text-gray-400 text-sm">Cantidad:</span>
                                <span class="bg-[#1F2A37] text-white px-2 py-1 rounded text-sm font-medium">${this.product.quantity}</span>
                            </div>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-gray-400">Total:</span>
                            <span class="text-white font-bold text-xl">$${total.toFixed(2)}</span>
                        </div>
                        
                        ${this.renderAdditionalInfo()}
                    </div>
                </div>
            </div>
        `;
    }
    
    renderProductImage() {
        if (this.product.image && this.product.image.trim() !== '') {
            const imageUrl = this.product.image.startsWith('http') ? 
                this.product.image : `https://huubie.com.mx/${this.product.image}`;
            return `
                <img src="${imageUrl}" alt="${this.product.name}" 
                     class="object-cover w-full h-full"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="w-full h-full items-center justify-center hidden">
                    <i class="icon-image text-gray-500 text-xl"></i>
                </div>
            `;
        } else {
            return `
                <div class="w-full h-full flex items-center justify-center">
                    <i class="icon-image text-gray-500 text-xl"></i>
                </div>
            `;
        }
    }
    
    renderAdditionalInfo() {
        let additionalInfo = '';
        
        if (this.product.dedication) {
            additionalInfo += `
                <div class="mt-3 pt-3 border-t border-gray-600">
                    <span class="text-gray-400 text-sm">Dedicatoria:</span>
                    <p class="text-gray-300 mt-1">${this.product.dedication}</p>
                </div>
            `;
        }
        
        if (this.product.order_details) {
            additionalInfo += `
                <div class="mt-2">
                    <span class="text-gray-400 text-sm">Observaciones:</span>
                    <p class="text-gray-300 mt-1">${this.product.order_details}</p>
                </div>
            `;
        }
        
        return additionalInfo;
    }
}
```

#### 3. Personalized Product Card
```javascript
class PersonalizedProductCard {
    constructor(product) {
        this.product = product;
    }
    
    render() {
        const total = parseFloat(this.product.price) * parseInt(this.product.quantity);
        
        return `
            <div class="bg-gradient-to-r from-purple-900/20 to-pink-900/20 rounded-lg p-6 mb-6 border-2 border-purple-500/30">
                <!-- Personalized Badge -->
                <div class="flex items-center justify-between mb-4">
                    <h4 class="text-white font-bold text-xl">${this.product.name}</h4>
                    <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-600 text-purple-100">
                        <i class="icon-magic mr-2"></i>
                        Personalizado
                    </span>
                </div>
                
                <!-- Main Content Area -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <!-- Left Column: Images and Basic Info -->
                    <div class="space-y-4">
                        ${this.renderUploadedImages()}
                        ${this.renderBasicInfo()}
                    </div>
                    
                    <!-- Right Column: Customization Details -->
                    <div class="space-y-4">
                        ${this.renderCustomizationDetails()}
                        ${this.renderPricing()}
                    </div>
                </div>
                
                ${this.renderAdditionalInfo()}
            </div>
        `;
    }
    
    renderUploadedImages() {
        if (!this.product.images || this.product.images.length === 0) {
            return `
                <div class="bg-[#1F2A37] rounded-lg p-4 text-center">
                    <i class="icon-image text-gray-500 text-3xl mb-2"></i>
                    <p class="text-gray-400 text-sm">Sin imágenes de referencia</p>
                </div>
            `;
        }
        
        return `
            <div class="bg-[#1F2A37] rounded-lg p-4">
                <h5 class="text-purple-300 font-semibold mb-3 flex items-center">
                    <i class="icon-camera mr-2"></i>
                    Imágenes de Referencia
                </h5>
                <div class="grid grid-cols-2 gap-2">
                    ${this.product.images.map(img => `
                        <div class="aspect-square rounded overflow-hidden bg-gray-700 cursor-pointer hover:opacity-80 transition-opacity">
                            <img src="${img.path.startsWith('http') ? img.path : `https://huubie.com.mx/${img.path}`}" 
                                 alt="${img.original_name || 'Imagen de referencia'}" 
                                 class="object-cover w-full h-full"
                                 onclick="this.showImageModal('${img.path}')">
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    renderBasicInfo() {
        return `
            <div class="bg-[#1F2A37] rounded-lg p-4">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-gray-400">Cantidad:</span>
                    <span class="bg-purple-600 text-white px-3 py-1 rounded font-medium">${this.product.quantity}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-400">Precio Base:</span>
                    <span class="text-purple-300 font-semibold text-lg">$${parseFloat(this.product.price).toFixed(2)}</span>
                </div>
            </div>
        `;
    }
    
    renderCustomizationDetails() {
        if (!this.product.customer_products || this.product.customer_products.length === 0) {
            return `
                <div class="bg-[#1F2A37] rounded-lg p-4">
                    <p class="text-gray-400 text-center">Sin detalles de personalización</p>
                </div>
            `;
        }
        
        // Group customizations by type
        const customizations = this.groupCustomizations(this.product.customer_products);
        
        return `
            <div class="bg-[#1F2A37] rounded-lg p-4">
                <h5 class="text-purple-300 font-semibold mb-3 flex items-center">
                    <i class="icon-settings mr-2"></i>
                    Personalización
                </h5>
                <div class="space-y-3">
                    ${Object.entries(customizations).map(([category, items]) => `
                        <div class="border-b border-gray-600 pb-2 last:border-b-0">
                            <h6 class="text-purple-200 font-medium mb-1">${category}:</h6>
                            ${items.map(item => `
                                <div class="flex justify-between items-center text-sm">
                                    <span class="text-gray-300">${item.custom_details}</span>
                                    <span class="text-purple-300">$${parseFloat(item.custom_price || 0).toFixed(2)}</span>
                                </div>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    renderPricing() {
        const customizationTotal = this.product.customer_products ? 
            this.product.customer_products.reduce((sum, item) => sum + parseFloat(item.custom_price || 0), 0) : 0;
        const finalTotal = (parseFloat(this.product.price) + customizationTotal) * parseInt(this.product.quantity);
        
        return `
            <div class="bg-gradient-to-r from-purple-800/30 to-pink-800/30 rounded-lg p-4 border border-purple-500/30">
                <h5 class="text-purple-300 font-semibold mb-3 flex items-center">
                    <i class="icon-dollar-sign mr-2"></i>
                    Precio Real del Pastel
                </h5>
                <div class="space-y-2">
                    <div class="flex justify-between">
                        <span class="text-gray-300">Precio base:</span>
                        <span class="text-white">$${parseFloat(this.product.price).toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-300">Personalización:</span>
                        <span class="text-purple-300">$${customizationTotal.toFixed(2)}</span>
                    </div>
                    <div class="border-t border-purple-500/30 pt-2">
                        <div class="flex justify-between items-center">
                            <span class="text-purple-200 font-semibold">Total Final:</span>
                            <span class="text-white font-bold text-xl">$${finalTotal.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderAdditionalInfo() {
        let additionalInfo = '';
        
        if (this.product.dedication || this.product.order_details) {
            additionalInfo = `
                <div class="mt-4 pt-4 border-t border-purple-500/30">
                    ${this.product.dedication ? `
                        <div class="mb-3">
                            <span class="text-purple-300 font-medium">Dedicatoria:</span>
                            <p class="text-gray-300 mt-1 bg-[#1F2A37] p-3 rounded">${this.product.dedication}</p>
                        </div>
                    ` : ''}
                    ${this.product.order_details ? `
                        <div>
                            <span class="text-purple-300 font-medium">Observaciones:</span>
                            <p class="text-gray-300 mt-1 bg-[#1F2A37] p-3 rounded">${this.product.order_details}</p>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        return additionalInfo;
    }
    
    groupCustomizations(customizations) {
        const groups = {};
        customizations.forEach(item => {
            const category = item.modifier_name || 'Otros';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(item);
        });
        return groups;
    }
}
```

## Responsive Design Strategy

### Breakpoint System
- **Mobile**: < 768px - Single column, stacked layout
- **Tablet**: 768px - 1024px - Flexible two-column with adjusted spacing
- **Desktop**: > 1024px - Full two-column layout with optimal spacing

### Layout Adaptations
```javascript
const responsiveLayout = {
    mobile: {
        container: 'flex flex-col space-y-4 p-4',
        orderInfo: 'w-full mb-4',
        productArea: 'w-full',
        cardGrid: 'grid-cols-1'
    },
    tablet: {
        container: 'flex flex-col lg:flex-row gap-4 p-4',
        orderInfo: 'w-full lg:w-1/3 mb-4 lg:mb-0',
        productArea: 'w-full lg:w-2/3',
        cardGrid: 'grid-cols-1'
    },
    desktop: {
        container: 'flex flex-row gap-6 p-6',
        orderInfo: 'w-1/3',
        productArea: 'w-2/3',
        cardGrid: 'grid-cols-1'
    }
};
```

## Error Handling

### Image Loading
- Progressive image loading with placeholders
- Fallback icons for missing images
- Error state handling for broken image URLs

### Data Validation
- Null/undefined checks for all product properties
- Graceful handling of missing customization data
- Default values for financial calculations

### Performance Optimization
- Lazy loading for images in personalized cards
- Efficient DOM manipulation using document fragments
- Debounced resize handlers for responsive updates

## Testing Strategy

### Visual Testing
- Cross-browser compatibility testing
- Responsive design validation across devices
- Card rendering accuracy for both product types

### Functional Testing
- Modal opening and closing behavior
- Data loading and error handling
- Interactive elements (image clicks, responsive behavior)

### Performance Testing
- Load time optimization for large orders
- Memory usage monitoring for multiple cards
- Smooth responsive transitions

## Implementation Notes

### CSS Custom Properties
```css
:root {
    --card-normal-bg: #283341;
    --card-personalized-bg: linear-gradient(135deg, rgba(147, 51, 234, 0.1), rgba(219, 39, 119, 0.1));
    --card-border-normal: #4B5563;
    --card-border-personalized: rgba(147, 51, 234, 0.3);
    --text-primary: #FFFFFF;
    --text-secondary: #9CA3AF;
    --accent-purple: #8B5CF6;
    --accent-blue: #60A5FA;
}
```

### Animation Enhancements
- Smooth card transitions on load
- Hover effects for interactive elements
- Loading state animations for better UX

### Accessibility Considerations
- Proper ARIA labels for card types
- Keyboard navigation support
- Screen reader friendly content structure
- High contrast color combinations