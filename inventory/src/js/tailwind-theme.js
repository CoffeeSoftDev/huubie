/*
 * Temas de inventory para Tailwind (Play CDN).
 *
 * Las escalas `blue` (acento) y `gray` (neutros de los contenedores) no son hex
 * fijos: apuntan a variables CSS que redefine el tema activo en src/css/themes.css.
 * Así un mismo `bg-blue-600` o `border-gray-200` se repinta al cambiar de tema,
 * igual que en erp-pro/pro, donde los componentes solo consumen tokens.
 *
 * Cada variable trae como respaldo el valor del tema Claro: una página que no
 * cargue themes.css se ve exactamente como antes.
 *
 * Los valores van como canales RGB sueltos ("192 90 64") y no como hex porque
 * Tailwind los consume como rgb(var(--x) / <alpha-value>): así siguen
 * funcionando los modificadores de opacidad del tipo bg-blue-600/10.
 *
 * Debe cargarse JUSTO DESPUÉS de <script src="https://cdn.tailwindcss.com"></script>.
 */
(function () {
    // El tema guardado se estampa en <html> ANTES de pintar nada. Este script
    // corre en el <head>, así que la página nunca asoma con el tema anterior.
    try {
        var saved = localStorage.getItem('inventory:theme');
        if (saved) document.documentElement.setAttribute('data-theme', saved);
    } catch (e) { /* sin localStorage (modo privado): arranca en Claro */ }

    if (typeof tailwind === 'undefined') return;

    function scale(token, fallback) {
        var out = {};
        Object.keys(fallback).forEach(function (k) {
            out[k] = 'rgb(var(--' + token + '-' + k + ', ' + fallback[k] + ') / <alpha-value>)';
        });
        return out;
    }

    tailwind.config = {
        theme: {
            extend: {
                colors: {
                    // Acento. Respaldo: rampa terracota del tema Claro (600 = #C05A40).
                    blue: scale('brand', {
                        50:  '251 243 239',
                        100: '247 227 220',
                        200: '239 201 188',
                        300: '232 166 143',
                        400: '217 130 106',
                        500: '200 105 76',
                        600: '192 90 64',
                        700: '168 74 51',
                        800: '143 61 42',
                        900: '110 47 32',
                        950: '74 31 22'
                    }),
                    // Neutros de contenedores. Respaldo: el gray de Tailwind de siempre.
                    gray: scale('gray', {
                        50:  '249 250 251',
                        100: '243 244 246',
                        200: '229 231 235',
                        300: '209 213 219',
                        400: '156 163 175',
                        500: '107 114 128',
                        600: '75 85 99',
                        700: '55 65 81',
                        800: '31 41 55',
                        900: '17 24 39',
                        950: '3 7 18'
                    })
                }
            }
        }
    };
})();
