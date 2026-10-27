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
