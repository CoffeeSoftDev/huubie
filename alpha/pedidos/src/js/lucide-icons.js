/* ============================================================================
   lucideIcon(name, cls) — iconos Lucide inline (SVG), reutilizable.
   ----------------------------------------------------------------------------
   Uso: ${lucideIcon('calendar')}  ${lucideIcon('printer', 'w-5 h-5')}
   Devuelve un <svg> con stroke=currentColor (hereda el color del texto).
   Agrega aqui nuevos paths copiados de https://lucide.dev cuando hagan falta.
   ============================================================================ */
(function () {

    const PATHS = {
        'calendar'   : '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
        'plus'       : '<path d="M5 12h14"/><path d="M12 5v14"/>',
        'circle-plus': '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/>',
        'lock'       : '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
        'printer'    : '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
        'check'      : '<path d="M20 6 9 17l-5-5"/>',
        'check-check': '<path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/>',
        'rotate-cw'  : '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
        'clock'      : '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
        'x'          : '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
    };

    window.lucideIcon = function (name, cls = 'w-4 h-4') {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}">${PATHS[name] || ''}</svg>`;
    };

})();
