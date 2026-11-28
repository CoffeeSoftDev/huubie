// -- Foto de producto e insumo --
// La comparten el Catálogo de venta (Productos y Paquetes) y el Catálogo de
// insumos de Inventarios (Insumos y Productos): los dos cargan este archivo.
// Usa esc() y warnBox(), que cada página define en su catalogo.js.

// Las fotos subidas antes solo existen en producción: se reintenta ahí una vez.
// Si tampoco carga, queda el cuadro vacío (el mismo que pinta el ctrl sin foto).
const CATALOGO_FILES_REMOTE = 'https://huubie.com.mx';

// data-icon: el ícono del cuadro vacío (pastel en productos, caja en paquetes, cubo en insumos).
function productPhotoError(img) {
    if (!img.dataset.fileFallback) {
        img.dataset.fileFallback = '1';
        img.src = CATALOGO_FILES_REMOTE + new URL(img.src, location.origin).pathname;
        return;
    }

    $(img).replaceWith(`<div class="cp-foto cp-foto-vacia"><i class="${esc(img.dataset.icon || 'icon-birthday')}"></i></div>`);
}

// La ruta guardada (pro_files/...) relativa a la raíz del sitio, como la pinta el ctrl.
function productPhotoUrl(path) {
    if (!path) return '';
    if (/^(https?:|data:)/i.test(path)) return path;

    return '/' + String(path).replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
}

// La foto lista para guardar: JPEG de máximo `max` px por lado (igual que inventory).
// Va sobre blanco para que lo transparente de un PNG no salga negro. "" si no se puede abrir.
function compressPhoto(file, max = 800) {
    return new Promise((resolve) => {
        if (!file || !/^image\//.test(file.type)) return resolve('');

        const url = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            const scale  = Math.min(1, max / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width  = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);

            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve('');
        };
        img.src = url;
    });
}

// -- Vista previa --

// Clic en la foto de una tabla: la foto en grande. Nombre y SKU salen de su celda (cellTitle).
function photoPreview(owner, img) {
    const cell = $(img).closest('td');
    const name = cell.find('.cp-celda-titulo').first().text();
    const sku  = cell.find('.cp-celda-sub').first().text();

    owner.csModal({
        id: 'modalPhotoPreview',
        title: name || 'Foto',
        subtitle: sku,
        lucideIcon: 'image',
        width: 'max-w-lg',
        saveText: false,
        cancelText: 'Cerrar',
        body: `<div class="cp-foto-vista"><img src="${esc(img.currentSrc || img.src)}" alt="${esc(name)}"></div>`
    });
}

// -- Campo de foto de la ficha --
// Se achica en el navegador (compressPhoto) y viaja como dataURL en image_b64;
// image_remove = 1 la quita. Sin tocarla, los dos van vacíos y la foto se queda.

// Va en un bloque 'html' de csModal con id 'photoField'. El label lleva las clases de los de csModal.
// La foto es el botón: un clic sobre ella abre el selector de archivos. La cámara de la esquina lo avisa.
function photoFieldHtml() {
    return `
        <label class="block text-xs font-semibold text-gray-500 mb-1.5">Foto</label>
        <div class="cp-foto-campo">
            <div class="cp-foto-thumb" role="button" tabindex="0">
                <span class="cp-foto-slot"></span>
                <span class="cp-foto-camara"><i data-lucide="camera" class="w-4 h-4"></i></span>
            </div>
            <button type="button" class="cp-foto-quitar hidden">Quitar</button>
            <input type="file" accept="image/jpeg,image/png,image/webp" class="hidden">
        </div>
    `;
}

// Liga el #photoField del modal. Devuelve lo que viaja al guardar; se actualiza solo.
// icon: el del cuadro vacío, el mismo que pinta la tabla.
function mountPhoto(modalId, image = '', icon = 'icon-birthday') {
    const field = $(`#${modalId} #photoField`);
    const file  = field.find('input[type=file]');
    const photo = { image_b64: '', image_remove: 0 };

    const paint = (src) => {
        const hint = src ? 'Cambiar foto' : 'Subir foto';

        field.find('.cp-foto-slot').html(src
            ? `<img src="${esc(src)}" alt="Foto" class="cp-foto" data-icon="${esc(icon)}" onerror="productPhotoError(this)">`
            : `<div class="cp-foto cp-foto-vacia"><i class="${esc(icon)}"></i></div>`);

        field.find('.cp-foto-thumb').attr('title', hint).attr('aria-label', hint);
        field.find('.cp-foto-quitar').toggleClass('hidden', !src);
    };

    field.on('click', '.cp-foto-thumb', () => file.trigger('click'));

    // Con teclado: Enter o espacio sobre la foto hacen lo mismo que el clic.
    field.on('keydown', '.cp-foto-thumb', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;

        e.preventDefault();
        file.trigger('click');
    });

    field.on('click', '.cp-foto-quitar', () => {
        Object.assign(photo, { image_b64: '', image_remove: 1 });
        paint('');
    });

    file.on('change', async () => {
        const picked = file[0].files[0];

        file.val('');

        if (!picked) return;

        const dataUrl = await compressPhoto(picked);

        if (!dataUrl) return warnBox('No se pudo leer la foto. Usa una imagen JPG, PNG o WEBP.');

        Object.assign(photo, { image_b64: dataUrl, image_remove: 0 });
        paint(dataUrl);
    });

    paint(productPhotoUrl(image));

    return photo;
}

// Foto a la izquierda y los campos `ids` a la derecha, en el lugar del primero.
// csModal los pinta uno tras otro; al guardar se leen por #id, así que moverlos no los pierde.
function photoBeside(modalId, ids) {
    const modal  = $(`#${modalId}`);
    const fields = ids.map((id) => modal.find(`#${id}`).closest('.flex-wrap > div')[0]);
    const row    = $('<div class="w-full cp-ident"></div>').insertBefore(fields[0]);

    row.append(
        $('<div class="cp-ident-foto"></div>').append(modal.find('#photoField')),
        $('<div class="cp-ident-campos flex flex-wrap"></div>').append(fields)
    );
}
