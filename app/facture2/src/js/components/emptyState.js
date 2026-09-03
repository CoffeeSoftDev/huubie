// EmptyState — la pantalla cuando no hay nada que mostrar.
//
// Una tabla sin filas no explica nada: quien la mira no sabe si el dia no tuvo
// ventas, si el reporte todavia no se ha subido o si algo fallo. Y alrededor
// quedan los botones de siempre —generar, imprimir, rehacer— ofreciendo trabajar
// sobre datos que no existen.
//
// Este bloque dice las tres cosas que hacen falta: QUE falta, POR QUE falta y POR
// DONDE se arregla. La regla que lo acompana es del modulo, no del componente:
// mientras se pinta un vacio, las acciones que operan sobre los datos se esconden
// (ver syncActionButtons en tickets.js).
//
// Tres motivos, tres lecturas distintas:
//   · vacio  — no hay datos todavia. Lleva a donde se cargan.
//   · filtro — hay datos, pero el filtro los dejo fuera. Lleva a limpiarlo.
//   · error  — no se pudo consultar. Lleva a reintentar.
class EmptyState {

    // Cada motivo trae su icono y el tono de su marco. El texto NO vive aqui: lo
    // pone la pantalla, que es la unica que sabe de que dia o de que filtro habla.
    static get MOTIVOS() {
        return {
            vacio:  { icon: 'inbox',          tone: 'text-gray-400' },
            filtro: { icon: 'filter-x',       tone: 'text-gray-400' },
            error:  { icon: 'alert-triangle', tone: 'text-amber-400' }
        };
    }

    static get DEFAULTS() {
        return {
            parent: 'root',
            id:     'emptyState',
            class:  'h-full min-h-[220px] flex flex-col items-center justify-center text-center px-6 py-10',
            json:   {
                motivo: 'vacio',
                icon:   '',
                title:  'No hay nada que mostrar',
                text:   '',
                // Una sola salida, y opcional: un vacio con tres botones vuelve a
                // ser una pantalla que pide decidir. { text, icon, href } o
                // { text, icon, onClick }.
                action: null
            }
        };
    }

    static esc(str) {
        return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    static render(options) {
        const defaults = EmptyState.DEFAULTS;
        const o        = options || {};
        const opts     = Object.assign({}, defaults, o);

        opts.json = Object.assign({}, defaults.json, o.json || {});

        const esc    = EmptyState.esc;
        const j      = opts.json;
        const motivo = EmptyState.MOTIVOS[j.motivo] || EmptyState.MOTIVOS.vacio;
        const icon   = j.icon || motivo.icon;
        const accion = j.action;

        const wrap = $('<div>', { id: opts.id, class: opts.class });

        wrap.html(`
            <div class="w-14 h-14 rounded-full bg-[#0E1521] border border-[#374151] flex items-center justify-center">
                <i data-lucide="${esc(icon)}" class="w-6 h-6 ${motivo.tone}"></i>
            </div>
            <h3 class="mt-3 text-sm font-bold text-gray-300">${esc(j.title)}</h3>
            ${j.text ? `<p class="mt-1.5 max-w-[420px] text-[12px] text-gray-400 leading-relaxed">${esc(j.text)}</p>` : ''}
            ${accion ? `
                <button type="button" id="${opts.id}Action"
                        class="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold text-white bg-[#1C64F2] hover:bg-[#1A56DB] transition-colors">
                    ${accion.icon ? `<i data-lucide="${esc(accion.icon)}" class="w-4 h-4"></i>` : ''}
                    ${esc(accion.text)}
                </button>
            ` : ''}
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();

        if (accion) {
            $(`#${opts.id}Action`).on('click', () => {
                if (typeof accion.onClick === 'function') return accion.onClick();
                if (accion.href) window.location.href = accion.href;
            });
        }
    }
}
