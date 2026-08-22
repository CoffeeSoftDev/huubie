// -- Tema Wansoft --

// Gemelo de facture/src/js/facture-theme.js. Se resuelve ANTES de que el modulo
// pinte: los componentes del framework (createfilterBar, createCoffeeTable3,
// coffeeForm) reciben el tema una sola vez en su render.
//
// El Facturador 2 es de tema claro y no alterna: la terminal Wansoft es blanca
// con bandas azules, y un modo oscuro cambiaria la marca, no solo el fondo. Por
// eso WANSOFT_THEME es una constante y no hay toggle.
//
// La paleta se declara aqui, no en el JS del modulo (que va sin un solo hex, por
// TRM-007): navbar y rail no pueden leerla del CSS porque wansoft-theme.css esta
// scopeado bajo #root para no pisarlos.

const WANSOFT_THEME = 'light';

document.documentElement.setAttribute('data-wansoft-theme', WANSOFT_THEME);

// -- Globales de tema que consumen los modulos --

// Importacion, Ventas, Tickets y Catalogos viven en /app/facture2/src/js/ y son
// copias propias de la terminal: un cambio aqui no toca el Facturador. Nacieron de
// facture y siguen leyendo sus dos globales de tema, asi que se declaran aqui —no
// se carga facture-theme.js, que las resolveria por localStorage y podria abrirlos
// oscuros.
const FACTURE_THEME          = WANSOFT_THEME;
const FACTURE_THEME_IS_LIGHT = true;

// El atributo que activa facture-theme.css. Con el puesto, toda la traduccion de
// oscuro a claro que ya existe en el Facturador se aplica sola, y wansoft-theme.css
// solo tiene que repintar el azul encima.
document.documentElement.setAttribute('data-facture-theme', WANSOFT_THEME);

const WANSOFT_PALETTE = {
    navbar:   { bg: '#2B4FD8', border: '#4667E0', text: '#FFFFFF', muted: 'rgba(255,255,255,.78)', divider: '#4667E0' },
    header:   { bg: '#2340BC', statusOnline: '#31C48D' },
    dropdown: { bg: '#FFFFFF', hover: '#F3F4F6', divider: '#E5E7EB' },
    badge:    { bg: '#DCE3F3', text: '#2340BC' },
    logout:   { border: '#E02424', hover: '#C81E1E' },
    swal:     { bg: '#FFFFFF', popup: 'bg-white text-gray-900 rounded-lg shadow-lg' }
};

// Datos de la terminal que la banda superior rotula. Son fijos mientras el modulo
// no tenga backend: cuando exista, esta constante la reemplaza la respuesta de su
// propio ctrl.
const WANSOFT_TERMINAL = {
    marca:   'wansoft',
    usuario: 'Pruebas',
    turno:   '1',
    version: '25.0.6.4',
    soporte: '(81) 4445 3800'
};

document.addEventListener('DOMContentLoaded', () => {
    document.body.setAttribute('data-bs-theme', WANSOFT_THEME);
});
