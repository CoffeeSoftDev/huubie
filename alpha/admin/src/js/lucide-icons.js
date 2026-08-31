/* ============================================================================
   lucideIcon(name, cls) — iconos Lucide inline (SVG), sin depender del CDN.
   ----------------------------------------------------------------------------
   Uso: ${lucideIcon('users')}  ${lucideIcon('map-pin', 'w-5 h-5')}
   Devuelve un <svg> con stroke=currentColor (hereda el color del texto).

   Ademas expone window.lucide.createIcons(), que es lo que llama tabLayout()
   de coffeeSoft.js para convertir los <i data-lucide> en SVG. Sin el, cuando
   unpkg.com no responde los tabs se pintan sin icono hasta refrescar.
   Agrega aqui nuevos paths copiados de https://lucide.dev cuando hagan falta.
   ============================================================================ */
(function () {

    const PATHS = {
        'building-2' : '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
        'users'      : '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        'map-pin'    : '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
        'file-text'  : '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
        'user'       : '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
        'pencil'     : '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
        'trash-2'    : '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
        'plus'       : '<path d="M5 12h14"/><path d="M12 5v14"/>',
        'check'      : '<path d="M20 6 9 17l-5-5"/>',
        'x'          : '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
        'search'     : '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
        'settings'   : '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
        'shield'     : '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
        'toggle-left': '<rect width="20" height="12" x="2" y="6" rx="6" ry="6"/><circle cx="8" cy="12" r="2"/>',
        'toggle-right': '<rect width="20" height="12" x="2" y="6" rx="6" ry="6"/><circle cx="16" cy="12" r="2"/>',
        'chevron-down': '<path d="m6 9 6 6 6-6"/>',
        'info'       : '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
        'circle-check': '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
        'circle-x'   : '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
        'alert-triangle': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>'
    };

    window.lucideIcon = function (name, cls = 'w-4 h-4') {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}">${PATHS[name] || ''}</svg>`;
    };

    // El CDN gana si alcanzo a cargar: solo se instala el reemplazo cuando falta.
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        return;
    }

    window.lucide = {
        createIcons: function () {
            document.querySelectorAll('[data-lucide]').forEach(el => {
                if (el.tagName.toLowerCase() === 'svg') return;

                const name = el.getAttribute('data-lucide');
                if (!PATHS[name]) return;

                const svg = $(window.lucideIcon(name, el.getAttribute('class') || ''))
                    .attr('data-lucide', name)
                    .attr('data-base-classes', el.getAttribute('data-base-classes') || '')
                    .addClass(`lucide lucide-${name}`);

                $(el).replaceWith(svg);
            });
        }
    };

})();
