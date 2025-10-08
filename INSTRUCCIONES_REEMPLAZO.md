# Instrucciones para reemplazar createPersonalizedCard

## Paso 1: Abre el archivo
Abre: `dev/pedidos/src/js/coffee.js`

## Paso 2: Encuentra el método
Busca el método `createPersonalizedCard(product)` (aproximadamente línea 358)

## Paso 3: Reemplaza TODO el método desde la línea que dice:
```javascript
createPersonalizedCard(product) {
```

Hasta el cierre del método (el `}` que cierra createPersonalizedCard)

## Paso 4: Pega este código completo:

```javascript
createPersonalizedCard(product) {
    const total = parseFloat(product.price || 0) * parseInt(product.quantity || 1);
    const hasDedication = product.dedication && product.dedication.trim() !== '';
    const hasDetails = product.order_details && product.order_details.trim() !== '';
    const hasImages = product.images && Array.isArray(product.images) && product.images.length > 0;
    const hasCustomization = product.customer_products && product.customer_products.length > 0;

    // Calculate total with customizations
    const customizationTotal = product.customer_products ? 
        product.customer_products.reduce((sum, item) => sum + parseFloat(item.custom_price || 0), 0) : 0;
    const finalTotal = (parseFloat(product.price || 0) + customizationTotal) * parseInt(product.quantity || 1);

    return `
        <div class="bg-gradient-to-r from-purple-900/20 to-pink-900/20 rounded-lg p-5 border-2 border-purple-500/30 relative">
            <!-- Header: Title and Badge -->
            <div class="flex items-center gap-4 mb-6">
                <h4 class="text-white font-bold text-2xl uppercase">${product.name || 'Pastel Personalizado'}</h4>
                <span class="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold bg-purple-600 text-white lowercase">
                    personalizado
                </span>
            </div>

            <!-- Cantidad en top-right -->
            <div class="absolute top-5 right-6 text-right">
                <span class="text-gray-400 text-sm">Cantidad: <span class="text-white font-bold text-xl">${product.quantity || 1}</span></span>
            </div>

            <!-- Top Section: Images + Dedication/Observations -->
            <div class="flex gap-6 mb-6 pr-32">
                <!-- Images Grid (3 columns) -->
                ${hasImages ? `
                <div class="flex gap-3">
                    ${product.images.slice(0, 3).map(img => {
                        const thumbUrl = img.path.startsWith('http') ? img.path : `https://huubie.com.mx/${img.path}`;
                        return `
                            <div class="w-32 h-32 rounded-lg overflow-hidden bg-gray-700">
                                <img src="${thumbUrl}" 
                                     alt="${img.original_name || 'Imagen'}" 
                                     class="object-cover w-full h-full">
                            </div>
                        `;
                    }).join('')}
                </div>
                ` : ''}

                <!-- Dedication and Observations -->
                ${(hasDedication || hasDetails) ? `
                <div class="flex gap-12 flex-1">
                    ${hasDedication ? `
                    <div class="flex-1">
                        <span class="text-gray-400 text-sm font-medium">Dedicatoria:</span>
                        <p class="text-white text-base">${product.dedication}</p>
                    </div>
                    ` : ''}
                    ${hasDetails ? `
                    <div class="flex-1">
                        <span class="text-gray-400 text-sm font-medium">Observaciones:</span>
                        <p class="text-white text-base">${product.order_details}</p>
                    </div>
                    ` : ''}
                </div>
                ` : ''}
            </div>

            <!-- Personalization Section -->
            ${hasCustomization ? `
            <div class="mb-6 pr-32">
                <h5 class="text-purple-300 font-bold text-lg mb-4 uppercase">Personalización:</h5>
                ${this.renderPersonalizationGrid(product.customer_products)}
            </div>
            ` : ''}

            <!-- Total at bottom-right -->
            <div class="absolute bottom-5 right-6 text-right">
                <span class="text-gray-400 text-sm block mb-1 uppercase">Precio:</span>
                <p class="text-white font-bold text-4xl">$${finalTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
        </div>
    `;
}
```

## Paso 5: Guarda el archivo

Presiona Ctrl+S para guardar los cambios.
