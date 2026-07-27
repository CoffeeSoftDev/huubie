// -- Paleta Tailwind del Facturador --

if (window.tailwind) {
    tailwind.config = {
        theme: {
            extend: {
                colors: {
                    brand: {
                        50:  '#FBF1ED',
                        100: '#F5E3DC',
                        200: '#F0C4B5',
                        300: '#E9A38F',
                        400: '#E08A70',
                        500: '#C05A40',
                        600: '#A84A33',
                        700: '#8F3D2A',
                        800: '#6E2F20',
                        900: '#4E2117'
                    },
                    ink: {
                        50:  '#F9FAFB',
                        100: '#F3F4F6',
                        200: '#E5E7EB',
                        300: '#D1D5DB',
                        400: '#9CA3AF',
                        500: '#6B7280',
                        600: '#4B5563',
                        700: '#374151',
                        900: '#111928'
                    }
                }
            }
        }
    };
}
