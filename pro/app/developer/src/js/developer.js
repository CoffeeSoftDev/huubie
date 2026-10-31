// Helpers del modulo Developer que comparten sus tres secciones (las clases
// portadas de inventory/tenant/js los llaman como globales).

// -- Helpers --

function notify(r) {
    if (r && r.status == 200) {
        alert({ icon: 'success', text: r.message, timer: 1400 });
    } else {
        alert({ icon: 'error', text: (r && r.message) || 'Ocurrió un error', btn1: true });
    }
}

function afterSave(response, reload) {
    notify(response);
    if (response && response.status == 200 && typeof reload === 'function') reload();
}

// Aviso gris con ícono: estados vacíos y notas dentro de paneles y modales
// (Roles y Permisos y el formulario de usuario).
function accessNote(icon, text) {
    return $('<div>', { class: 'flex items-start gap-2 p-3 rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-500' }).append(
        $('<i>', { 'data-lucide': icon, class: 'w-4 h-4 shrink-0 text-gray-400' }),
        $('<span>', { text: text })
    );
}

// Botón compacto con ícono de las cabeceras de panel (Roles y Permisos en
// Accesos; Empresas, Pagos y Módulos en Facturación). primary: el primario del tema (bg-main).
function actionButton(icon, text, onClick, primary = false, disabled = false) {
    const look = primary
        ? 'bg-main text-white hover:bg-main-hover border border-main'
        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-400';
    return $('<button>', {
        type: 'button',
        class: `inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed ${look}`,
        disabled: disabled
    }).append(
        $('<i>', { 'data-lucide': icon, class: 'w-3.5 h-3.5' }),
        $('<span>', { text: text })
    ).on('click', onClick);
}

// Escapa el nombre del registro que se pinta en el titulo de los modales de
// edicion (Empresa, Plan, Cupon, Submodulo, Seccion, Rol, Tipo de permiso).
// Global y unico para no repetir esta misma funcion en cada clase de saas.js
// y access.js (Modules y Permissions ya traian su propia copia privada).
function esc(t) {
    return (t == null ? '' : String(t)).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Convierte un texto a slug: minúsculas, sin acentos, espacios -> guiones.
// 'Inventarios Productos' -> 'inventarios-productos'
function slugify(text) {
    return (text || '')
        .toString()
        .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos (diacríticos)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')   // todo lo no alfanumérico -> guion
        .replace(/^-+|-+$/g, '');       // sin guiones al inicio/fin
}

// Mientras se escribe el Nombre, autogenera el Código (campo de solo lectura).
// Se llama desde el onkeyup del input de nombre en los formularios.
function autoCode(value) {
    $('#code').val(slugify(value));
}
