// -- Tema del Facturador --

// Se resuelve ANTES de que los modulos pinten: los componentes del framework
// (createfilterBar, createCoffeeTable3, infoCard, tabLayout) reciben el tema de
// una sola vez en su render, asi que cambiarlo implica recargar la pagina.
// Por eso este archivo se carga en el <head>, antes que el CSS del modulo: al
// primer pintado el atributo ya esta puesto y no hay parpadeo oscuro.

const FACTURE_THEME_KEY = 'facture_theme';

const FACTURE_THEME = localStorage.getItem(FACTURE_THEME_KEY) === 'light' ? 'light' : 'dark';

const FACTURE_THEME_IS_LIGHT = FACTURE_THEME === 'light';

document.documentElement.setAttribute('data-facture-theme', FACTURE_THEME);

// La paleta de navbar y sidebar no vive en facture.css: ese archivo esta
// scopeado bajo #root para no pisarlos. Se sirve aqui y ellos la consumen.
const FACTURE_PALETTE = FACTURE_THEME_IS_LIGHT
    ? {
        navbar:   { bg: '#FFFFFF', border: '#1C64F2', text: '#111928', muted: '#6B7280', divider: '#E5E7EB' },
        header:   { bg: '#F3F4F6', statusOnline: '#22c55e' },
        dropdown: { bg: '#FFFFFF', hover: '#F3F4F6', divider: '#E5E7EB' },
        badge:    { bg: '#DBEAFE', text: '#1E40AF' },
        logout:   { border: '#ef4444', hover: '#dc2626' },
        rail:     { bg: '#FFFFFF', border: '#E5E7EB', item: '#6B7280', hoverText: '#111928', hoverBg: '#F3F4F6', activeText: '#1C64F2' },
        swal:     { bg: '#FFFFFF', popup: 'bg-white text-gray-900 rounded-lg shadow-lg' }
    }
    : {
        navbar:   { bg: '#141d2b', border: '#1C64F2', text: '#FFFFFF', muted: '#9CA3AF', divider: '#374151' },
        header:   { bg: '#1F2A37', statusOnline: '#22c55e' },
        dropdown: { bg: '#111928', hover: '#1F2937', divider: '#1F2937' },
        badge:    { bg: '#1e3a8a', text: '#bfdbfe' },
        logout:   { border: '#ef4444', hover: '#dc2626' },
        rail:     { bg: '#141d2b', border: '#374151', item: '#9CA3AF', hoverText: '#FFFFFF', hoverBg: '#1F2A37', activeText: '#A4CAFE' },
        swal:     { bg: '#111928', popup: 'bg-[#1F2A37] text-white rounded-lg shadow-lg' }
    };

function setFactureTheme(theme) {
    localStorage.setItem(FACTURE_THEME_KEY, theme === 'light' ? 'light' : 'dark');
    window.location.reload();
}

function toggleFactureTheme() {
    setFactureTheme(FACTURE_THEME_IS_LIGHT ? 'dark' : 'light');
}

// El body llega con data-bs-theme fijo desde el PHP; aqui se alinea al tema
// elegido para que Bootstrap y sus componentes no se queden en el otro.
document.addEventListener('DOMContentLoaded', () => {
    document.body.setAttribute('data-bs-theme', FACTURE_THEME);
});
