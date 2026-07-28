/*
 * Tema "Arcilla Invernal" para Tailwind (Play CDN).
 * Remapea la escala "blue" de Tailwind al acento terracota de la paleta del Visor,
 * de modo que todas las clases blue (bg, text, ring, border) del sistema
 * (botones, tabs activos, focus rings, badges) usen terracota sin tener que
 * editar componente por componente.
 *
 * Debe cargarse JUSTO DESPUÉS de <script src="https://cdn.tailwindcss.com"></script>.
 */
if (typeof tailwind !== 'undefined') {
    tailwind.config = {
        theme: {
            extend: {
                colors: {
                    // Rampa terracota (acento principal = 600 #C05A40, hover = 700 #A84A33)
                    blue: {
                        50:  '#FBF3EF',
                        100: '#F7E3DC',
                        200: '#EFC9BC',
                        300: '#E8A68F', // salmón
                        400: '#D9826A',
                        500: '#C8694C',
                        600: '#C05A40', // terracota (acento)
                        700: '#A84A33', // hover
                        800: '#8F3D2A',
                        900: '#6E2F20',
                        950: '#4A1F16'
                    }
                }
            }
        }
    };
}
