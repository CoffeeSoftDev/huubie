/* ──────────────────────────────────────────────────────────────
   pg-core.js — Motor COMPARTIDO del sandbox (Playground + Forge).
   Única fuente del selector de viewport (móvil/laptop/completo),
   del zoom del preview y del lienzo edge-to-edge. Antes vivía
   duplicado en playground.js y forge.js y divergía en cada mejora
   (p.ej. el mockup de teléfono llegó a uno y no al otro).

   Contrato con la página anfitriona (playground.php / forge.php):
   - Globals: `pg` (estado con .viewport y .zoom) y, opcionales,
     pgSaveSettings() y pgOnViewportApplied(mode) — hook donde cada
     página remata a su manera (fondo del panel, nav del Live, zoom).
   - DOM: .pg-sandbox-body > .pg-device-shell > iframes
     (#pgSandboxFrame y, en Forge, #fgLiveFrame), botones
     .pg-vp-btn[data-vp] y #pgZoomLabel.
   - CSS: .pg-device-shell / .pg-vp-fixed / .pg-vp-phone viven en
     playground.css (forge.php también la incluye).
   - Cargar este archivo ANTES de playground.js / forge.js.
   ────────────────────────────────────────────────────────────── */

const PG_VIEWPORTS = {
    mobile: { w: 390 },
    laptop: { w: 1280 },
    full:   { w: 0 }
};

/* ── Viewport del preview ──
 * 'laptop' centra un ancho fijo (.pg-vp-fixed), 'mobile' dibuja el mockup de
 * teléfono (.pg-vp-phone + .pg-device-shell) y 'full' deja el iframe llenando
 * el 100% del panel. El ancho del modo fijo viaja en la var CSS --pg-vp-w. */
function pgApplyViewport() {
    const mode = PG_VIEWPORTS[pg.viewport] ? pg.viewport : 'full';
    pg.viewport = mode;
    const $body  = $('.pg-sandbox-body');
    const $frame = $('#pgSandboxFrame');
    $body.toggleClass('pg-vp-fixed', mode === 'laptop');
    $body.toggleClass('pg-vp-phone', mode === 'mobile');
    if (mode !== 'full') {
        $body.css('--pg-vp-w', PG_VIEWPORTS[mode].w + 'px');
    } else {
        // Ancho completo: sin residuos del modo fijo; el iframe llena el contenedor.
        $body.css('--pg-vp-w', '');
        $frame.css({ width: '', height: '' });
    }
    $('.pg-vp-btn').each(function () {
        $(this).toggleClass('is-active', $(this).data('vp') === mode);
    });
    pgSyncStageViewport();
    if (typeof pgOnViewportApplied === 'function') pgOnViewportApplied(mode);
}
function pgSetViewport(mode) {
    pg.viewport = PG_VIEWPORTS[mode] ? mode : 'full';
    pgApplyViewport();
    if (typeof pgSaveSettings === 'function') pgSaveSettings();
}

/* A ancho completo y en el teléfono el contenido debe ocupar TODO el lienzo:
 * marca el <body> del preview con .pg-vp-edge (el CSS del wrap de cada página
 * quita su padding de presentación; en laptop se conserva). Con el iframe
 * sandboxeado no hay acceso same-origin al documento: el aviso viaja por
 * postMessage al bridge que el wrap inyecta en el <head> del preview. */
function pgSyncStageViewport() {
    const fr = document.getElementById('pgSandboxFrame');
    if (!fr) return;
    const edge = pg.viewport !== 'laptop';
    try {
        const doc = fr.contentDocument || (fr.contentWindow && fr.contentWindow.document);
        if (doc && doc.body) { doc.body.classList.toggle('pg-vp-edge', edge); return; }
    } catch (e) { /* sin acceso: cae al bridge */ }
    try { if (fr.contentWindow) fr.contentWindow.postMessage({ pgEdge: edge }, '*'); } catch (e) {}
}

/* ── Zoom del preview ──
 * Escala el CONTENIDO del iframe (propiedad CSS `zoom`, que reflowea el layout
 * a diferencia de transform:scale). Se reaplica en cada render (onload) porque
 * el iframe recarga. Tres vías, en orden:
 *   1) documento same-origin → zoom interno directo;
 *   2) iframe sandboxeado (srcdoc con bridge inyectado) → postMessage;
 *   3) cross-origin real (Live del Forge en otro dominio) → transform del
 *      ELEMENTO iframe desde fuera, dimensionado para ocupar el panel exacto. */
function pgApplyZoom() {
    const z = (pg.zoom || 100) / 100;
    $('#pgZoomLabel').text((pg.zoom || 100) + '%');
    // Frame visible: el Live del Forge si existe y está visible; si no, el Preview.
    const $live  = $('#fgLiveFrame');
    const isLive = $live.length && !$live.hasClass('hidden');
    const fr = document.getElementById(isLive ? 'fgLiveFrame' : 'pgSandboxFrame');
    if (!fr) return;

    // Con viewport de dispositivo (laptop/teléfono) el ANCHO lo controla el CSS;
    // no debemos sobreescribirlo con escalado externo.
    const $body   = $('.pg-sandbox-body');
    const vpFixed = $body.hasClass('pg-vp-fixed') || $body.hasClass('pg-vp-phone');

    let innerOk = false;
    try {
        const doc = fr.contentDocument || (fr.contentWindow && fr.contentWindow.document);
        if (doc && doc.documentElement) { doc.documentElement.style.zoom = z; innerOk = true; }
    } catch (e) { innerOk = false; }
    // Sandboxeado (origen opaco): el zoom viaja por postMessage al bridge del wrap.
    if (!innerOk && fr.hasAttribute('sandbox')) {
        try { if (fr.contentWindow) { fr.contentWindow.postMessage({ pgZoom: z }, '*'); innerOk = true; } } catch (e) {}
    }

    if (innerOk || vpFixed) {
        // Zoom interno OK (o ancho fijo por CSS): limpiar cualquier escalado
        // externo previo y volver al iframe normal (el width lo da CSS).
        fr.style.position = fr.style.top = fr.style.left = '';
        fr.style.transform = fr.style.width = fr.style.height = '';
    } else {
        // Escalado externo (cross-origin): iframe en ABSOLUTO sobre el panel,
        // dimensionado en píxeles reales del contenedor divididos por el zoom;
        // al escalarlo ocupa EXACTAMENTE el contenedor sin huecos.
        // OJO: el padre directo es .pg-device-shell (display:contents → rect
        // vacío); el contenedor real de medidas es .pg-sandbox-body.
        const host = fr.closest('.pg-sandbox-body');
        const r = host ? host.getBoundingClientRect() : { width: 0, height: 0 };
        const navH   = (typeof FG_NAV_H !== 'undefined') ? FG_NAV_H : 40;
        const navOff = (isLive && $body.hasClass('fg-live-nav-on')) ? navH : 0;
        fr.style.position = 'absolute';
        fr.style.top = navOff + 'px';
        fr.style.left = '0';
        fr.style.transformOrigin = 'top left';
        fr.style.transform = 'scale(' + z + ')';
        fr.style.width  = (r.width  / z) + 'px';
        fr.style.height = ((r.height - navOff) / z) + 'px';
    }
}
function pgSetZoom(z) {
    pg.zoom = Math.max(25, Math.min(200, Math.round(z / 5) * 5));   // 25%–200%, pasos de 5
    pgApplyZoom();
    if (typeof pgSaveSettings === 'function') pgSaveSettings();
}

// Detecta si el HTML ya es un documento completo (head/tailwind/tema propios).
// Solo cuenta si EMPIEZA como documento: un fragmento cuyo <script> arma strings
// "<html>/<body>" (p.ej. ventana de impresión con document.write) no lo es —
// tratarlo como doc completo lo dejaba sin Tailwind/fuentes (render "pelón").
function pgIsFullDoc(html) {
    const s = String(html || '').replace(/^(\s+|<!--[\s\S]*?-->)+/, '');
    return /^(<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>])/i.test(s);
}
