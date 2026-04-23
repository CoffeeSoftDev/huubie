// update version 1.4

/*
 actualizacion de infoCards
 actualizacion de createLayout
 actualizacion de coffeTable3
 actualizacion de crete Table
 createCoffeeForm
 update table.
*/

const CF_REGEX = {
    texto: /^[a-zA-ZÀ-ÖØ-öø-ÿ\s]+$/,
    texto_clean: /[^a-zA-ZÀ-ÖØ-öø-ÿ\s]+/g,
    numero: /^\d+$/,
    numero_clean: /[^0-9]/g,
    cifra: /^-?\d+(\.\d+)?$/,
    email: /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/,
    tel: /^[0-9+\-() ]+$/,
    tel_clean: /[^0-9+\-() ]/g,
};

const CF_CSS = {
    input: 'tw-input w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-[#003360] dark:focus:border-[#0a4a85] bg-white dark:bg-gray-700',
    select: 'tw-input w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-[#003360] dark:focus:border-[#0a4a85] bg-white dark:bg-gray-700 appearance-none cursor-pointer',
    textarea: 'tw-input w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-[#003360] dark:focus:border-[#0a4a85] bg-white dark:bg-gray-700 resize-y',
    label: 'block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5',
    error: 'tw-error text-xs text-red-500 dark:text-red-400 mt-1 hidden',
    btnPrimary: 'tw-btn w-full rounded-lg bg-[#003360]/90 px-4 py-2 text-sm font-semibold text-white hover:bg-[#003360] active:bg-[#003360] focus:outline-none focus:ring-2 focus:ring-[#003360] focus:ring-offset-1 dark:focus:ring-offset-gray-800',
    btnInfo: 'tw-btn w-full rounded-lg bg-[#0078D7]/90 px-4 py-2 text-sm font-semibold text-white hover:bg-[#0078D7] active:bg-[#0078D7] focus:outline-none focus:ring-2 focus:ring-[#0078D7] focus:ring-offset-1 dark:focus:ring-offset-gray-800',
    btnSuccess: 'tw-btn w-full rounded-lg bg-[#7aab20]/90 px-4 py-2 text-sm font-semibold text-white hover:bg-[#7aab20] active:bg-[#7aab20] focus:outline-none focus:ring-2 focus:ring-[#7aab20] focus:ring-offset-1 dark:focus:ring-offset-gray-800',
    btnDanger: 'tw-btn w-full rounded-lg bg-[#9e1b32]/90 px-4 py-2 text-sm font-semibold text-white hover:bg-[#9e1b32] active:bg-[#9e1b32] focus:outline-none focus:ring-2 focus:ring-[#9e1b32] focus:ring-offset-1 dark:focus:ring-offset-gray-800',
    btnWarning: 'tw-btn w-full rounded-lg bg-[#FFC107] px-4 py-2 text-sm font-semibold text-[#003360] hover:bg-[#FFC107]/80 active:bg-[#FFC107]/80 focus:outline-none focus:ring-2 focus:ring-[#FFC107] focus:ring-offset-1 dark:focus:ring-offset-gray-800',
    btnOutline: 'tw-btn w-full rounded-lg border border-[#003360] bg-white dark:bg-gray-700 px-4 py-2 text-sm font-semibold text-[#003360] dark:text-gray-200 hover:bg-[#003360] hover:text-white active:bg-[#003360] focus:outline-none focus:ring-2 focus:ring-[#003360] focus:ring-offset-1 dark:focus:ring-offset-gray-800',
    btnSecondary: 'tw-btn w-full rounded-lg bg-gray-500 dark:bg-gray-600 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-600 dark:hover:bg-gray-500 active:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800',
    btnLight: 'tw-btn w-full rounded-lg bg-gray-100 dark:bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-200 dark:hover:bg-gray-300 active:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-1 dark:focus:ring-offset-gray-800',
    btnDark: 'tw-btn w-full rounded-lg bg-gray-800 dark:bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900 dark:hover:bg-black active:bg-black focus:outline-none focus:ring-2 focus:ring-gray-700 focus:ring-offset-1 dark:focus:ring-offset-gray-800',
    btnLink: 'tw-btn w-full rounded-lg bg-transparent px-4 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none',
    radio: 'w-4 h-4 text-[#003360] border-gray-300 dark:border-gray-600 focus:ring-[#003360] accent-[#003360]',
    checkbox: 'w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-[#003360] focus:ring-[#003360] accent-[#003360]',
    file: 'tw-input w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-[#e6eef5] dark:file:bg-[#0a2540] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-[#003360] dark:file:text-[#7bafe6] hover:file:bg-[#cddfee] dark:hover:file:bg-[#0f3358]',
    groupAddon: 'inline-flex items-center justify-center px-3 rounded-l-lg border border-r-0 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 text-gray-500 dark:text-gray-300 text-sm',
};

const CF_BTN_COLORS = {
    primary: 'btnPrimary',
    secondary: 'btnSecondary',
    success: 'btnSuccess',
    danger: 'btnDanger',
    warning: 'btnWarning',
    info: 'btnInfo',
    light: 'btnLight',
    dark: 'btnDark',
    link: 'btnLink',
    outline: 'btnOutline',
};

class Complements {

    constructor(link, div_modulo) {
        this._link = link;
        this._div_modulo = div_modulo;
    }

    ObjectMerge(target, source) {
        // Iterar sobre todas las claves del objeto fuente
        for (const key in source) {
            // Verificar si la propiedad es propia del objeto fuente
            if (source.hasOwnProperty(key)) {
                // Verificar si el valor es un objeto y si el target tiene la misma propiedad
                if (typeof source[key] === 'object' && source[key] !== null) {
                    // Si el target no tiene la propiedad o no es un objeto, inicializarla como un objeto vacÃ­o
                    if (!target[key] || typeof target[key] !== 'object') {
                        target[key] = {};
                    }
                    // Llamada recursiva para combinar sub-objetos
                    this.ObjectMerge(target[key], source[key]);
                } else {
                    // Si no es un objeto, asignar el valor directamente
                    target[key] = source[key];
                }
            }
        }
        return target;
    }

    closedModal(data) {
        if (data === true || data.success === true) {
            alert();
            $('.bootbox-close-button').click();
        } else console.error(data);
    }

    dropdown(options) {
        let defaults = [
            { icon: "icon-pencil", text: "Editar", onClick: "alert('Editar')" },
            { icon: "icon-trash", text: "Eliminar", onClick: "alert('Eliminar')" },
        ];

        let opts = options != undefined ? options : defaults;

        const $ul = $("<ul>", { class: "dropdown-menu", "aria-labelledby": "dropdownMenu" });
        //Hago una iteraciÃ³n sobre el array de etiquetas li
        opts.forEach((m) => {
            let html = m.icon != "" ? `<i class="text-info ${m.icon}"></i>` : "<i class='icon-minus'></i>";
            html += m.text != "" ? m.text : "";

            const $a = $("<a>", { ...m, class: "pt-1 pb-1 pointer dropdown-item", onclick: m.onClick, html });
            const $li = $("<li>").append($a);
            $ul.append($li);
        });


        //Creo el boton principal ...
        const $button = $("<button>", {
            class: "btn btn-aliceblue btn-sm",
            id: "dropdownMenu",
            type: "button",
            "data-bs-toggle": "dropdown",
            "aria-expanded": "false",
            html: '<i class="icon-dot-3 text-info"></i>',
        });

        //Se puede hacer un return aquÃ­ y retorna el objeto jQuery
        const $container = $("<div>", { class: "dropdown" });
        $container.append($button, $ul);
        //Yo hago el return aquÃ­ porque convierto el objeto a un string.
        return $container.prop("outerHTML");
    }

    useFetch(options) {

        // Valores predeterminados
        let defaults = {
            method: 'POST',
            data: { opc: 'ls' },
            url: this._link, // La URL debe ser especificada en las opciones
            success: () => { } // FunciÃ³n vacÃ­a por defecto
        };

        // Mezclar los valores predeterminados con las opciones proporcionadas
        let opts = Object.assign({}, defaults, options);

        // Validar que la URL estÃ© definida
        if (!opts.url) {
            console.error('URL es obligatoria.');
            return;
        }

        // Realizar la peticiÃ³n fetch
        fetch(opts.url, {
            method: opts.method,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(opts.data),
        })
            .then((response) => response.json())
            .then((data) => {
                // Llamar a la funciÃ³n success si se proporciona
                if (typeof opts.success === 'function') {
                    opts.success(data);
                }
            })
            .catch((error) => {
                console.error('Error en la peticiÃ³n:', error);
            });
    }

    createExcel(options) {
        const defaults = {
            parent: "root",
            tableId: "myTable",
            fileName: "export",
            onSuccess: () => { },
            onError: () => { }
        };

        const opts = Object.assign({}, defaults, options);

        const rgbToHex = (rgb) => {
            if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return null;
            const match = rgb.match(/\d+/g);
            if (!match) return null;
            return match.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('').toUpperCase();
        };

        const getColorFromElement = (element) => {
            const classList = element.className;

            const colorMap = {
                'bg-green-50': 'E8F5E9', 'bg-green-100': 'C6EFCE', 'bg-green-200': 'A5D6A7', 'bg-green-300': '81C784', 'bg-green': '00B050',
                'bg-blue-50': 'E3F2FD', 'bg-blue-100': 'BDD7EE', 'bg-blue-200': '90CAF9', 'bg-blue-300': '64B5F6', 'bg-blue': '4472C4',
                'bg-yellow-50': 'FFFDE7', 'bg-yellow-100': 'FFE699', 'bg-yellow-200': 'FFF59D', 'bg-yellow-300': 'FFF176', 'bg-yellow': 'FFC000',
                'bg-red-50': 'FFEBEE', 'bg-red-100': 'FFC7CE', 'bg-red-200': 'EF9A9A', 'bg-red-300': 'E57373', 'bg-red': 'FF0000',
                'bg-gray-50': 'F9FAFB', 'bg-gray-100': 'F3F4F6', 'bg-gray-200': 'E5E7EB', 'bg-gray-300': 'D1D5DB', 'bg-gray': '808080',
                'bg-purple-50': 'F3E5F5', 'bg-purple-100': 'E4DFEC', 'bg-purple-200': 'CE93D8', 'bg-purple-300': 'BA68C8', 'bg-purple': '7030A0',
                'bg-orange-50': 'FFF3E0', 'bg-orange-100': 'FFD9B3', 'bg-orange-200': 'FFCC80', 'bg-orange-300': 'FFB74D', 'bg-orange': 'FF6600',
                'bg-pink-50': 'FCE4EC', 'bg-pink-100': 'F8BBD0', 'bg-pink-200': 'F48FB1', 'bg-pink-300': 'F06292', 'bg-pink': 'E91E63',
                'bg-indigo-50': 'E8EAF6', 'bg-indigo-100': 'C5CAE9', 'bg-indigo-200': '9FA8DA', 'bg-indigo-300': '7986CB', 'bg-indigo': '3F51B5',
                'bg-teal-50': 'E0F2F1', 'bg-teal-100': 'B2DFDB', 'bg-teal-200': '80CBC4', 'bg-teal-300': '4DB6AC', 'bg-teal': '009688',
                'bg-[#283341]': '283341', 'bg-[#1F2A37]': '1F2A37'
            };

            // Ordenar por longitud descendente para matchear primero la clase mas especifica
            // (ej: 'bg-gray-200' antes que 'bg-gray', evita que shades caigan en la base oscura)
            const sortedEntries = Object.entries(colorMap).sort((a, b) => b[0].length - a[0].length);
            for (const [className, color] of sortedEntries) {
                if (classList.includes(className)) return color;
            }

            const bgColor = window.getComputedStyle(element).backgroundColor;
            return rgbToHex(bgColor);
        };

        const getTextColor = (element) => {
            const classList = element.className;

            if (classList.includes('text-white')) return 'FFFFFF';
            if (classList.includes('text-red')) return 'FF0000';
            if (classList.includes('text-green')) return '00FF00';
            if (classList.includes('text-blue')) return '0000FF';

            const color = window.getComputedStyle(element).color;
            return rgbToHex(color) || '000000';
        };

        const exportTable = async () => {
            alert({
                icon: "info",
                title: "Exportando...",
                text: "Generando archivo Excel, por favor espera.",
                btn1: false
            });

            const table = document.getElementById(opts.tableId);

            if (!table) {
                alert({
                    icon: "error",
                    title: "Error",
                    text: "No se encontró la tabla para exportar.",
                    btn1: true,
                    btn1Text: "Ok"
                });
                opts.onError('Table not found');
                return;
            }

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Datos');

            const rows = table.querySelectorAll('tr');
            const excelData = [];

            const parseCurrency = (text) => {
                if (typeof text !== 'string') return null;
                // Normaliza espacios no rompibles y todos los whitespace
                const trimmed = text.replace(/\u00a0/g, ' ').trim();
                if (!trimmed) return null;
                // Debe contener el simbolo $ y al menos un digito
                if (!/\$/.test(trimmed) || !/\d/.test(trimmed)) return null;
                // Acepta: $1,500.00 | $ 1,500.00 | -$1,500.00 | $-1,500.00 | ($1,500.00)
                const currencyRegex = /^\(?\s*-?\s*\$\s*-?\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*\)?$|^\(?\s*-?\s*\$\s*-?\s*\d+(?:\.\d+)?\s*\)?$/;
                if (!currencyRegex.test(trimmed)) return null;
                const isNegative = /^\(.*\)$/.test(trimmed) || /-/.test(trimmed);
                const cleaned = trimmed.replace(/[^\d.]/g, '');
                if (cleaned === '' || isNaN(cleaned)) return null;
                const num = parseFloat(cleaned);
                return isNegative ? -num : num;
            };

            rows.forEach((row) => {
                const cells = row.querySelectorAll('th, td');
                const rowData = [];
                const rowStyles = [];

                cells.forEach((cell) => {
                    const text = (cell.innerText || cell.textContent || '').trim();
                    const isHeader = cell.tagName === 'TH';
                    const numericValue = isHeader ? null : parseCurrency(text);
                    const isCurrency = numericValue !== null;

                    rowData.push(isCurrency ? numericValue : text);

                    const bgColor = getColorFromElement(cell);
                    const textColor = getTextColor(cell);
                    const isBold = cell.classList.contains('font-bold') ||
                        cell.classList.contains('fw-bold') ||
                        isHeader;
                    const textAlign = cell.classList.contains('text-center') ? 'center' :
                        cell.classList.contains('text-right') || cell.classList.contains('text-end') ? 'right' : 'left';

                    rowStyles.push({
                        bgColor,
                        textColor,
                        isBold,
                        textAlign,
                        isHeader,
                        isCurrency
                    });
                });

                excelData.push({ data: rowData, styles: rowStyles });
            });

            excelData.forEach((rowInfo) => {
                const excelRow = worksheet.addRow(rowInfo.data);

                excelRow.eachCell((cell, colNumber) => {
                    const style = rowInfo.styles[colNumber - 1];

                    cell.font = {
                        bold: style.isBold,
                        color: { argb: 'FF' + style.textColor },
                        size: style.isHeader ? 12 : 11,
                        name: 'Calibri'
                    };

                    if (style.bgColor) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FF' + style.bgColor }
                        };
                    }

                    if (style.isCurrency) {
                        cell.numFmt = '"$"#,##0.00';
                    }

                    const cellText = cell.value != null ? cell.value.toString() : '';
                    cell.alignment = {
                        horizontal: style.isCurrency ? 'right' : style.textAlign,
                        vertical: 'middle',
                        wrapText: cellText.includes('\n')
                    };

                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                        left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                        right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
                    };
                });

                let maxLines = 1;
                excelRow.eachCell((cell) => {
                    const lines = cell.value ? cell.value.toString().split('\n').length : 1;
                    maxLines = Math.max(maxLines, lines);
                });
                excelRow.height = maxLines > 1 ? maxLines * 15 : 20;
            });

            worksheet.columns.forEach((column) => {
                let maxLength = 10;
                column.eachCell({ includeEmpty: true }, (cell) => {
                    const cellLength = cell.value ? cell.value.toString().length : 0;
                    maxLength = Math.max(maxLength, cellLength);
                });
                column.width = Math.min(maxLength + 3, 50);
            });

            const finalFileName = `${opts.fileName}.xlsx`;

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            if (window.showSaveFilePicker) {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: finalFileName,
                        types: [{
                            description: 'Archivo Excel',
                            accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
                        }]
                    });

                    const writable = await handle.createWritable();
                    await writable.write(blob);
                    await writable.close();

                    opts.onSuccess(finalFileName);
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        console.error('Error al guardar:', err);
                        alert({
                            icon: "error",
                            title: "Error",
                            text: "No se pudo guardar el archivo.",
                            btn1: true,
                            btn1Text: "Ok"
                        });
                        opts.onError(err);
                    }
                }
            } else {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = finalFileName;
                link.click();
                URL.revokeObjectURL(link.href);

                opts.onSuccess(finalFileName);
            }
        };

        exportTable();
    }

    loader(options = {}) {
        const opts = Object.assign({ parent: '', text: '', size: 'xs', type: 'quantum' }, options);
        const sizes = { xs: 10, sm: 14, md: 24, lg: 36 };
        const s = sizes[opts.size] || 10;
        const fontSize = s < 14 ? 12 : 14;

        const keyframes = {
            aurora: `@keyframes coffeeiaAurora{0%{border-radius:50%;transform:scale(1) rotate(0deg);background:linear-gradient(135deg,#ec4899,#3b82f6)}25%{background:linear-gradient(135deg,#8b5cf6,#a855f7)}50%{border-radius:40% 60% 60% 40%/60% 40% 60% 40%;transform:scale(1.05) rotate(180deg);background:linear-gradient(135deg,#6366f1,#8b5cf6)}75%{background:linear-gradient(135deg,#d946ef,#ec4899)}100%{border-radius:50%;transform:scale(1) rotate(360deg);background:linear-gradient(135deg,#ec4899,#3b82f6)}}`,
            nebula: `@keyframes coffeeiaNebula{0%{border-radius:60% 40% 30% 70%/60% 30% 70% 40%;background:linear-gradient(135deg,#3b82f6,#8b5cf6)}33%{background:linear-gradient(135deg,#ec4899,#d946ef)}50%{border-radius:30% 60% 70% 40%/50% 60% 30% 60%}66%{background:linear-gradient(135deg,#a855f7,#6366f1)}100%{border-radius:60% 40% 30% 70%/60% 30% 70% 40%;background:linear-gradient(135deg,#3b82f6,#8b5cf6)}}`,
            crystal: `@keyframes coffeeiaCrystal{0%{border-radius:50%;transform:rotate(0deg);background:linear-gradient(135deg,#6366f1,#3b82f6)}50%{border-radius:45% 55% 60% 40%/55% 40% 60% 45%;transform:rotate(180deg);background:linear-gradient(135deg,#8b5cf6,#ec4899)}100%{border-radius:50%;transform:rotate(360deg);background:linear-gradient(135deg,#6366f1,#3b82f6)}}`,
            quantum: `@keyframes coffeeiaQuantum{0%{border-radius:50%;transform:translate(0,0);background:#ec4899}25%{background:#3b82f6}50%{border-radius:40% 60% 50% 50%;transform:translate(1px,-1px);background:#8b5cf6}75%{background:#a855f7}100%{border-radius:50%;transform:translate(0,0);background:#ec4899}}`
        };

        const animations = {
            aurora: 'coffeeiaAurora 2s ease-in-out infinite',
            nebula: 'coffeeiaNebula 2.5s ease-in-out infinite',
            crystal: 'coffeeiaCrystal 3s ease-in-out infinite',
            quantum: 'coffeeiaQuantum 2s steps(8) infinite'
        };

        if (!document.getElementById('coffeeia-loader-css')) {
            const style = document.createElement('style');
            style.id = 'coffeeia-loader-css';
            style.textContent = Object.values(keyframes).join('');
            document.head.appendChild(style);
        }

        const animation = animations[opts.type] || animations.nebula;
        const textHtml = opts.text ? `<span style="color:#374151;font-weight:500;font-size:${fontSize}px">${opts.text}</span>` : '';

        const html = `
            <div class="coffeeia-loader" style="display:inline-flex;align-items:center;gap:8px">
                <div style="width:${s}px;height:${s}px;border-radius:50%;animation:${animation}"></div>
                ${textHtml}
            </div>
        `;

        if (opts.parent) {
            const target = opts.parent.startsWith('#') || opts.parent.startsWith('.') ? opts.parent : '#' + opts.parent;
            $(target).append(html);
        }

        return html;
    }

    cfBindLiveValidation(container) {
        container.find('input, textarea').on('input', function () {
            let el = $(this);
            let tipo = el.attr('data-tipo');
            let val = el.val();

            if (tipo === 'texto' && !CF_REGEX.texto.test(val))
                el.val(val.replace(CF_REGEX.texto_clean, ''));

            if (tipo === 'numero' && !CF_REGEX.numero.test(val))
                el.val(val.replace(CF_REGEX.numero_clean, ''));

            if (tipo === 'cifra' && !CF_REGEX.cifra.test(val))
                el.val(val.replace('--', '-').replace('..', '.').replace('.-', '.').replace('-.', '-0.')
                    .replace(/^\./, '0.').replace(/[^0-9.\-]/g, '')
                    .replace(/(\.[^.]+)\./g, '$1').replace(/(\d)\-/g, '$1'));

            if (tipo === 'tel' && !CF_REGEX.tel.test(val))
                el.val(val.replace(CF_REGEX.tel_clean, ''));

            if (tipo === 'email') {
                el.removeClass('is-invalid');
                let errSpan = el.parent().find('.tw-error');
                if (el.val().trim() !== '' && !CF_REGEX.email.test(el.val())) {
                    el.addClass('is-invalid');
                    if (errSpan.length) errSpan.text('Ingrese un correo valido').removeClass('hidden');
                } else if (errSpan.length) {
                    errSpan.addClass('hidden');
                }
            }

            if (el.val().trim() !== '') {
                el.removeClass('is-invalid');
                el.parent().find('.tw-error').addClass('hidden');
            }
        });

        container.find('input, textarea').on('blur', function () {
            $(this).val($(this).val().trim());
        });

        container.find('select').on('change', function () {
            let el = $(this);
            if (el.val() && el.val() !== '0') {
                el.removeClass('is-invalid');
                el.closest('div').parent().find('.tw-error').addClass('hidden');
            }
        });
    }

    cfValidateForm(container) {
        let valid = true;

        container.find('[required]').each(function () {
            let el = $(this);
            let val = el.val() ? el.val().trim() : '';
            let isEmpty = val === '' || val === '0';

            let parent = el.is('select') ? el.closest('div').parent() : el.parent();
            let errSpan = parent.find('.tw-error');

            if (isEmpty) {
                valid = false;
                el.addClass('is-invalid');
                el.focus();
                if (errSpan.length) errSpan.text('El campo es requerido').removeClass('hidden');
            } else {
                el.removeClass('is-invalid');
                if (errSpan.length) errSpan.addClass('hidden');
            }
        });

        container.find('[data-tipo="email"]').each(function () {
            let el = $(this);
            if (el.val().trim() !== '' && !CF_REGEX.email.test(el.val())) {
                valid = false;
                el.addClass('is-invalid');
            }
        });

        return valid;
    }

    cfAutofill(containerId, data) {
        let container = $('#' + containerId);
        if (!container.length) return;

        for (let key in data) {
            let el = container.find(`[name="${key}"]`);
            if (!el.length) continue;
            el.val(data[key]);
            if (el.is('select')) el.trigger('change');
        }
    }

    cfToTailwindGrid(bsClass) {
        let result = bsClass;
        result = result.replace(/\bcol-(sm|md|lg|xl)-(\d{1,2})\b/g, (_, bp, n) => `${bp}:col-span-${n}`);
        result = result.replace(/\bcol-(\d{1,2})\b/g, (_, n) => `col-span-${n}`);
        result = result.replace(/\boffset-(sm|md|lg|xl)-(\d{1,2})\b/g, (_, bp, n) => `${bp}:col-start-${Number(n) + 1}`);
        result = result.replace(/\boffset-(\d{1,2})\b/g, (_, n) => `col-start-${Number(n) + 1}`);
        result = result.replace(/\b(mb-\d|mt-\d|p-\d|fw-bold|text-lg|text-uppercase|line|hidex|resize|text-end)\b/g, '').trim();
        return result;
    }

    cfThemedClass(str, theme) {
        if (!str) return str;
        const tokens = str.split(/\s+/).filter(Boolean);
        if (theme !== 'dark') {
            return tokens.filter(t => !t.startsWith('dark:')).join(' ');
        }
        const darkTokens = tokens.filter(t => t.startsWith('dark:')).map(t => t.slice(5));
        const isColorVal = (v) => /^(white|black|transparent|current|inherit|[a-z]+-\d{2,3})(\/\d+)?$/.test(v);
        const propPrefix = (t) => {
            let base = t.replace(/-\[[^\]]*\]/g, '');
            const m = base.match(/^((?:[a-z]+:)*(?:bg|text|border|ring|placeholder|fill|stroke|accent|outline|caret|divide|from|to|via|decoration))-(.+)$/);
            if (m && isColorVal(m[2])) return m[1] + '-COLOR';
            return base.replace(/-\d+(\.\d+)?(\/\d+)?$/, '');
        };
        const darkProps = new Set(darkTokens.map(propPrefix));
        const lightFiltered = tokens.filter(t => {
            if (t.startsWith('dark:')) return false;
            return !darkProps.has(propPrefix(t));
        });
        return [...lightFiltered, ...darkTokens].join(' ');
    }

}

// add component
class Components extends Complements {

    constructor(link, div_modulo) {
        super(link, div_modulo);
    }



    coffeeForm(options) {
        const self = this;

        const defaults = {
            parent: 'root',
            id: 'coffeeForm',
            class: 'grid grid-cols-12 gap-x-4 gap-y-1',
            type: 'default',
            Element: 'div',
            json: [],
            data: {},
            autofill: false,
            prefijo: '',
            color: 'primary',
            color_default: 'primary',
            theme: 'light',
            card: false,
            showRequired: true,
            onSave: () => { },
            onAdd: () => { },
            onUpdate: () => { },
            onDelete: () => { },
        };

        const opts = Object.assign({}, defaults, options);

        const css = {};
        for (const k in CF_CSS) css[k] = self.cfThemedClass(CF_CSS[k], opts.theme);

        const makeLabel = (text, forId, required) => {
            let lbl = $('<label>', {
                class: css.label,
                for: forId
            });
            lbl.html(text + (opts.showRequired && required ? '<span class="text-red-400 ml-0.5">*</span>' : ''));
            return lbl;
        };

        let themeWrap = $('<div>', {
            class: opts.theme === 'dark' ? 'dark' : ''
        });
        let card = $('<div>', {
            class: opts.card
                ? self.cfThemedClass('bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-6 fade-in', opts.theme)
                : 'fade-in',
        });
        themeWrap.append(card);

        let container;
        if (opts.Element === 'form') {
            container = $('<form>', {
                id: opts.id,
                class: opts.class
            });
            container.attr('novalidate', true);
        } else {
            container = $('<div>', {
                id: opts.id,
                class: opts.class
            });
        }

        for (const x of opts.json) {
            let div_col = self.cfToTailwindGrid(x.class || 'col-sm-4') + ' mt-1';
            let div_hijo = $('<div>', {
                class: div_col
            });

            let required = x.required === false ? false : true;
            let aux_name = x.name ? x.name : x.id;

            if (x.showLabel !== false && x.lbl) {
                div_hijo.append(makeLabel(x.lbl, opts.prefijo + x.id, required));
            }

            let attr_default = {
                id: opts.prefijo + x.id,
                'data-tipo': x.tipo,
                name: aux_name,
                value: x.value,
                placeholder: x.placeholder,
            };

            if (required) attr_default.required = '';
            if (x.disabled) attr_default.disabled = '';

            let color;

            switch (x.opc) {

                case 'code':
                    div_hijo.empty();
                    let codeText = JSON.stringify(x.json, null, 2);
                    div_hijo.addClass('rounded-lg bg-gray-900 dark:bg-gray-950 p-4 overflow-x-auto');
                    let pre = $('<pre>', {
                        class: 'text-xs text-gray-200 font-mono whitespace-pre'
                    }).text(codeText);
                    div_hijo.append(pre);
                    break;

                case 'radio':
                    if (x.data) {
                        let radioGroup = $('<div>', {
                            class: 'flex flex-wrap gap-4 mt-1'
                        });
                        $.each(x.data, function (_, item) {
                            let radioLabel = $('<label>', {
                                class: 'inline-flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300',
                                for: item.id,
                            });
                            let rd = $('<input>', {
                                type: 'radio',
                                class: x.className || 'w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 focus:ring-blue-500 accent-blue-600',
                                name: x.name || x.id,
                                value: item.id,
                                id: item.id,
                            });
                            if (item.checked) rd.prop('checked', true);
                            if (x.onchange) rd.attr('onchange', x.onchange);
                            radioLabel.append(rd, document.createTextNode(item.valor));
                            radioGroup.append(radioLabel);
                        });
                        div_hijo.append(radioGroup);
                    } else {
                        let rdSingle = $('<input>', {
                            type: 'radio',
                            class: x.className || css.radio,
                            name: x.name || x.id,
                            value: x.value,
                            id: opts.prefijo + x.id,
                        });
                        if (x.checked) rdSingle.prop('checked', true);
                        if (x.onchange) rdSingle.attr('onchange', x.onchange);

                        let rdLabel = $('<label>', {
                            class: 'inline-flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300',
                            text: x.text || x.valor,
                            for: opts.prefijo + x.id,
                        });
                        div_hijo.append(rdSingle, rdLabel);
                    }
                    break;

                case 'checkbox':
                    if (x.data) {
                        let cbGroup = $('<div>', {
                            class: 'flex flex-wrap gap-4 mt-1'
                        });
                        $.each(x.data, function (_, item) {
                            let cbLabel = $('<label>', {
                                class: x.classLabel || 'inline-flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300',
                                for: item.id,
                            });
                            let cb = $('<input>', {
                                type: 'checkbox',
                                class: x.className || 'w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 accent-blue-600',
                                name: item.id,
                                value: 'true',
                                id: item.id,
                            });
                            if (item.checked) cb.prop('checked', true);
                            if (x.onchange) cb.attr('onchange', x.onchange);
                            cbLabel.append(cb, document.createTextNode(item.valor));
                            cbGroup.append(cbLabel);
                        });
                        div_hijo.append(cbGroup);
                    } else {
                        div_hijo.empty();
                        let cbId = opts.prefijo + x.id;
                        let cbSingle = $('<input>', {
                            type: 'checkbox',
                            class: x.className || css.checkbox,
                            name: x.name || x.id,
                            value: true,
                            id: cbId,
                        });
                        if (x.onchange) cbSingle.attr('onchange', x.onchange);

                        let cbLbl = $('<label>', {
                            class: x.classLabel || 'inline-flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300',
                            text: x.text || x.valor,
                            for: cbId,
                        });
                        div_hijo.append(cbSingle, cbLbl);
                    }
                    break;

                case 'list-group':
                    let divGroup = $('<div>', {
                        class: 'flex flex-col gap-1'
                    });
                    x.data.forEach(function (item) {
                        let a = $('<a>', {
                            class: 'flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors'
                        });
                        let iconText = $('<span>', {
                            class: 'text-sm text-gray-600 dark:text-gray-300'
                        });
                        if (item.ico) iconText.prepend($('<i>', { class: item.ico + ' mr-2' }));
                        iconText.append(item.text);

                        let badge = $('<span>', {
                            class: 'text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
                            text: item.notifications,
                        });
                        a.append(iconText, badge);
                        divGroup.append(a);
                    });
                    div_hijo.append(divGroup);
                    break;

                case 'input':
                    let align = '';
                    if (x.tipo === 'cifra' || x.tipo === 'numero') align = ' text-right';

                    let htmlType = x.type || 'text';
                    if (x.tipo === 'email') htmlType = 'email';
                    if (x.tipo === 'tel') htmlType = 'tel';

                    let attrInput = Object.assign({}, attr_default, {
                        class: css.input + align,
                        type: htmlType,
                        onkeyup: x.onkeyup || '',
                    });
                    if (x.onchange) attrInput.onchange = x.onchange;
                    if (x.readonly) attrInput.readonly = '';

                    div_hijo.append($('<input>', attrInput));
                    div_hijo.append($('<span>', { class: css.error }));
                    break;

                case 'input-group':
                    let inputGroup = $('<div>', {
                        class: 'flex'
                    });

                    let valType = x.type || 'text';
                    let alignGrp = '';
                    if (x.tipo === 'cifra' || x.tipo === 'numero') alignGrp = ' text-right';

                    if (x.tipo === 'cifra' || x.tipo === 'numero') {
                        let iconPre = $('<span>', {
                            class: css.groupAddon
                        });
                        if (x.icon) iconPre.html(`<i class="${x.icon}"></i>`);
                        inputGroup.append(iconPre);
                    }

                    let attrGrp = Object.assign({}, attr_default, {
                        class: css.input + ' rounded-l-none' + alignGrp,
                        type: valType,
                        onkeyup: x.onkeyup || '',
                    });
                    if (x.cat) attrGrp.cat = x.cat;
                    if (x.readonly) attrGrp.readonly = '';
                    if (x.onchange) attrGrp.onchange = x.onchange;

                    inputGroup.append($('<input>', attrGrp));

                    if (x.tipo !== 'cifra' && x.tipo !== 'numero') {
                        let iconApp = $('<span>', {
                            class: 'inline-flex items-center justify-center px-3 rounded-r-lg border border-l-0 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 text-gray-500 dark:text-gray-300 text-sm',
                        });
                        if (x.icon) iconApp.html(`<i class="${x.icon}"></i>`);
                        inputGroup.append(iconApp);
                    }

                    div_hijo.append(inputGroup);
                    div_hijo.append($('<span>', { class: css.error }));
                    break;

                case 'textarea':
                    div_hijo.append($('<textarea>', {
                        class: css.textarea,
                        id: opts.prefijo + x.id,
                        'data-tipo': x.tipo,
                        name: x.name || x.id,
                        text: x.value,
                        placeholder: x.placeholder,
                        cols: x.cols,
                        rows: x.rows || 3,
                        required: x.required || false,
                    }));
                    div_hijo.append($('<span>', { class: css.error }));
                    break;

                case 'input-file-btn':
                    div_hijo.append($('<input>', {
                        class: css.file,
                        id: opts.prefijo + x.id,
                        'data-tipo': x.tipo,
                        name: x.name || x.id,
                        type: 'file',
                    }));
                    break;

                case 'input-file':
                    color = x.color_btn || opts.color_default;
                    let cssKeyFile = CF_BTN_COLORS[color] || 'btnOutline';

                    let iptFile = $('<input>', {
                        class: 'hidden',
                        type: 'file',
                        accept: x.accept || '.xlsx, .xls',
                        id: opts.prefijo + x.id,
                        onchange: x.fn,
                    });

                    let lblBtn = $('<label>', {
                        class: css[cssKeyFile] + ' mt-4 cursor-pointer text-center',
                        html: `  ${x.text} `,
                        for: opts.prefijo + x.id,
                    });

                    div_hijo.append(iptFile, lblBtn);
                    break;

                case 'btn':
                    color = x.color_btn || opts.color_default;
                    let cssKeyBtn = CF_BTN_COLORS[color] || 'btnOutline';
                    let iconBtn = x.icon ? `<i class="${x.icon}"></i>` : '';
                    let textBtn = x.text || '';

                    if (!x.lbl) {
                        div_hijo.append($('<label>', {
                            class: css.label,
                            html: '&nbsp;',
                            'aria-hidden': 'true'
                        }));
                    }

                    div_hijo.append($('<button>', {
                        class: css[cssKeyBtn] + ' w-full ' + (x.className || ''),
                        html: `${iconBtn}  ${textBtn} `,
                        type: 'button',
                        id: opts.prefijo + x.id,
                        onclick: x.fn,
                    }));
                    break;

                case 'btn-submit':
                    color = x.color_btn || opts.color_default;
                    let cssKeySub = CF_BTN_COLORS[color] || 'btnPrimary';
                    let iconSub = (x.icon || x.icono) ? `<i class="${x.icon || x.icono} mr-1"></i> ` : '';

                    if (!x.lbl) {
                        div_hijo.append($('<label>', {
                            class: css.label,
                            html: '&nbsp;',
                            'aria-hidden': 'true'
                        }));
                    }

                    div_hijo.append($('<button>', {
                        class: css[cssKeySub] + ' ' + (x.className || ''),
                        html: iconSub + (x.text || 'Enviar'),
                        type: 'submit',
                        id: opts.prefijo + x.id,
                        onclick: x.fn,
                    }));
                    break;

                case 'button':
                    color = x.color_btn || opts.color_default;
                    let cssKeyButton = CF_BTN_COLORS[color] || 'btnPrimary';
                    let iconButton = x.icon ? `<i class="${x.icon}"></i>` : '';
                    let textButton = x.text || '';

                    let buttonEvents = {};
                    if (x.fn) buttonEvents.onclick = x.fn;
                    if (x.onClick) buttonEvents.click = x.onClick;

                    if (!x.lbl) {
                        div_hijo.append($('<label>', {
                            class: css.label,
                            html: '&nbsp;',
                            'aria-hidden': 'true'
                        }));
                    }

                    div_hijo.append($('<button>', {
                        class: css[cssKeyButton] + ' ' + (x.className || ''),
                        html: `${iconButton} ${textButton} `,
                        id: opts.prefijo + x.id,
                        type: 'button',
                        ...buttonEvents,
                    }));
                    break;

                case 'select':
                    let selectWrap = $('<div>', {
                        class: 'relative'
                    });

                    let select = $('<select>', {
                        class: css.select + ' pr-8',
                        id: opts.prefijo + x.id,
                        name: x.name || x.id,
                        onchange: x.onchange,
                        placeholder: x.placeholder,
                    });

                    if (x.selected) {
                        select.html(`<option value="0"> ${x.selected} </option>`);
                    }

                    if (x.data) {
                        $.each(x.data, function (_, item) {
                            let bandera = false;
                            if (String(item.id) == String(x.value)) bandera = true;
                            select.append($('<option>', {
                                value: item.id,
                                text: item.valor,
                                selected: bandera,
                            }));
                        });
                    }

                    let chevron = $('<div>', {
                        class: 'pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5',
                        html: '<svg class="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>',
                    });

                    selectWrap.append(select, chevron);
                    div_hijo.append(selectWrap);
                    div_hijo.append($('<span>', { class: css.error }));
                    break;

                case 'input-calendar':
                    let calGroup = $('<div>', {
                        class: 'flex'
                    });

                    let calAddon = $('<span>', {
                        class: css.groupAddon,
                        html: '<i class="icon-calendar-2"></i>',
                    });

                    let calInput = $('<input>', {
                        type: 'date',
                        class: css.input + ' rounded-l-none',
                        id: opts.prefijo + x.id,
                        'data-tipo': x.tipo,
                        name: x.name || x.id,
                        value: x.value,
                        placeholder: x.placeholder || 'dd/mm/aaaa',
                    });

                    if (required) calInput.attr('required', '');
                    if (x.disabled) calInput.attr('disabled', '');
                    if (x.readonly) calInput.attr('readonly', '');
                    if (x.onchange) calInput.attr('onchange', x.onchange);

                    calGroup.append(calAddon, calInput);
                    div_hijo.append(calGroup);
                    div_hijo.append($('<span>', { class: css.error }));
                    break;

                case 'btn-select':
                    let bsGroup = $('<div>', {
                        class: 'flex'
                    });

                    let bsSelect = $('<select>', {
                        class: css.select + ' rounded-r-none pr-8',
                        id: opts.prefijo + x.id,
                        name: x.name || x.id,
                        onchange: x.onchange,
                    });
                    if (required) bsSelect.attr('required', '');

                    if (x.selected) {
                        bsSelect.html(`<option value="0"> ${x.selected} </option>`);
                    }

                    if (x.data) {
                        $.each(x.data, function (_, item) {
                            let bandera = String(item.id) == String(x.value);
                            bsSelect.append($('<option>', {
                                value: item.id,
                                text: item.valor,
                                selected: bandera,
                            }));
                        });
                    }

                    let bsBtn = $('<button>', {
                        type: 'button',
                        id: x.btnId || (opts.prefijo + x.id + '_btn'),
                        class: 'px-3 rounded-r-lg border border-l-0 border-gray-300 dark:border-gray-600 bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium transition-colors',
                        html: x.btnIcon ? `<i class="${x.btnIcon}"></i>` : (x.btnText || '+'),
                    });
                    if (x.fn) bsBtn.attr('onclick', x.fn);
                    if (x.btnFn) bsBtn.attr('onclick', x.btnFn);
                    if (x.btnOnClick) bsBtn.on('click', x.btnOnClick);

                    let bsBtnIcon = x.icon ? $('<i>', { class: x.icon }) : null;
                    if (bsBtnIcon) bsBtn.append(bsBtnIcon);

                    bsGroup.append(bsSelect, bsBtn);
                    div_hijo.append(bsGroup);
                    div_hijo.append($('<span>', { class: css.error }));
                    break;

                default:
                    if (x.opc) {
                        const { class: _, ...xWithoutClass } = x;
                        div_hijo.append($('<' + x.opc + '>', xWithoutClass));
                    }
                    break;
            }

            container.append(div_hijo);
        }

        if (opts.type === 'btn') {
            let cssKeyAuto = CF_BTN_COLORS[opts.color] || 'btnPrimary';
            let divBtn = $('<div>', {
                class: 'mt-3 col-span-12 flex justify-center'
            });
            let btnSubmit = $('<button>', {
                class: css[cssKeyAuto] + ' sm:w-1/3',
                text: 'Aceptar',
                id: 'btnAceptar',
                type: 'submit',
            });
            divBtn.append(btnSubmit);
            container.append(divBtn);
        }

        card.append(container);
        $(`#${opts.parent}`).html(themeWrap);

        if (opts.autofill) self.cfAutofill(opts.id, opts.autofill);

        self.cfBindLiveValidation(container);

        if (opts.Element === 'form') {
            container.on('submit', function (e) {
                e.preventDefault();
                if (!self.cfValidateForm(container)) return;

                let formData = new FormData(container[0]);
                let result = Object.assign({}, opts.data);
                formData.forEach(function (val, key) { result[key] = val; });

                opts.onSave(result);
            });
        }

        return container;
    }

    detailCard(options = {}) {
        const defaults = {
            parent: "body",
            title: "",
            subtitle: "",
            class: "space-y-2",
            data: [],
        };

        const opts = Object.assign({}, defaults, options);

        const isCols2 = opts.class.includes("cols-2");
        let contentClass = isCols2
            ? `grid grid-cols-2 ${opts.class.replace("cols-2", "")}`
            : `flex flex-col ${opts.class}`;

        let infoHtml = `<div class="${contentClass}">`;

        opts.data.forEach(item => {
            if (item.type === "div") {
                infoHtml += `<div class="${item.class || ''}">${item.html || ''}</div>`;
            } else if (item.type === "status") {
                infoHtml += `
                <div class="flex items-center mb-1">
                    <span class="text-gray-400 font-medium flex items-center text-base">
                        ${item.icon ? `<i class="${item.icon} mr-2"></i>` : ""}
                        ${item.text}:
                    </span>
                    <span class="ml-2 px-3 py-1 rounded-full text-xs font-bold ${item.color || "bg-gray-500"}">${item.value}</span>
                </div>
            `;
            } else if (item.type === "observacion") {
                infoHtml += `
                <div class="col-span-2 mt-2">
                    <label class="text-gray-400 font-medium text-base mb-1 block">${item.text || "Observación"}:</label>
                    <div class="bg-[#28324c] rounded p-3 text-gray-300 min-h-[80px]">${item.value || ""}</div>
                </div>
            `;
            } else {
                infoHtml += `
                <div class="flex items-center mb-1">
                    <span class="text-gray-400 font-medium flex items-center text-base">
                        ${item.icon ? `<i class="${item.icon} mr-2"></i>` : ""}
                        ${item.text}:
                    </span>
                    <span class="ml-2 font-semibold text-white text-base">${item.value}</span>
                </div>
            `;
            }
        });

        infoHtml += `</div>`;

        const html = `
        <div class="text-white rounded-xl p-3 min-w-[320px]">
            ${infoHtml}
        </div>
    `;

        $(`#${opts.parent}`).html(html);
    }

    createItemCard(options) {
        let defaults = {
            parent: 'cardGridContainer',
            json: [
                {
                    titulo: "Evento",
                    descripcion: "Dar de alta un nuevo evento",
                    imagen: "/alpha/src/img/eventos.svg",
                    enlace: "/alpha/eventos/",
                    padding: ""
                },
                {
                    titulo: "Evento",
                    descripcion: "Dar de alta un nuevo evento",
                    imagen: "/alpha/src/img/eventos.svg",
                    enlace: "/alpha/eventos/",
                    padding: ""
                }
            ]
        };

        let opts = Object.assign({}, defaults, options);

        // 📜 Título principal del grupo de tarjetas
        let title = $('<h3>', {
            class: 'text-lg font-semibold text-white mb-2 px-4',
            text: opts.title || ''
        });

        // 📜 Contenedor principal del grid de tarjetas
        let container = $('<div>', {
            class: 'w-full flex gap-4 justify-start p-4'
        });

        // 🔄 Generar cada tarjeta a partir de la data
        opts.json.forEach(item => {
            let imgContent = '';

            if (Array.isArray(item.img)) {
                imgContent = '<div class="flex gap-2 mb-2">';
                item.img.forEach(i => {
                    imgContent += `<img class="w-14 h-14 bg-[#233876] rounded-lg" src="${i.src}" alt="${i.title}">`;
                });
                imgContent += '</div>';
            } else if (item.imagen) {
                imgContent = `<img class="w-14 h-14 ${item.padding} bg-[#233876] rounded-lg group-hover:scale-110 transition-transform mb-2" src="${item.imagen}" alt="${item.titulo}">`;
            }


            let card = $(
                `<div class="group w-50 h-[200px] bg-[#333D4C] rounded-lg shadow-lg overflow-hidden p-4 flex flex-col justify-between cursor-pointer transition-all hover:shadow-xl hover:scale-105">
                  ${imgContent}
                <div class="flex-grow flex flex-col justify-center">
                    <h2 class="text-lg font-semibold text-white font-[Poppins] group-hover:text-blue-400">${item.titulo}</h2>
                    ${item.descripcion ? `<p class="text-gray-400 font-[Poppins]">${item.descripcion}</p>` : ""}
                </div>
            </div>`
            ).click(() => {
                if (item.enlace)
                    window.location.href = item.enlace;

                if (item.onClick)
                    item.onClick();


            });

            container.append(card);
        });

        // 🎯 Insertar el grid en el DOM
        $('#' + opts.parent).append(title, container);
    }


    //

    swalQuestion(options = {}) {

        /*--  plantilla --*/
        let objSwal = {
            title: "",
            text: " ",
            icon: "warning",
            scrollbarPadding: false,
            showCancelButton: true,
            confirmButtonText: "Aceptar",
            cancelButtonText: "Cancelar",
            ...options.opts,
            customClass: {
                title: "text-2xl font-semibold",
                content: "text-gray-300",
                confirmButton:
                    "bg-[#1C64F2] hover:bg-[#0E9E6E] text-white py-2 px-4 rounded",
                cancelButton:
                    "bg-[#111928] text-white border border-gray-500 py-2 px-4 rounded hover:bg-[#111928]",
            },
        };


        var defaults = {

            data: { opc: "ls" },
            extends: false,
            fn: '',

            ...options,

            methods: ''

        };

        let opts = Object.assign(defaults, options);


        let extends_swal = Swal.fire(objSwal);



        if (options.extends) {

            return extends_swal;

        } else {

            extends_swal.then((result) => {

                if (result.isConfirmed) {


                    fn_ajax(opts.data, this._link, "").then((data) => {

                        if (opts.fn) {
                            window[opts.fn]();

                        } else if (opts.methods) {
                            // Obtener las llaves de los mÃ©todos
                            let methodKeys = Object.keys(opts.methods);
                            methodKeys.forEach((key) => {
                                const method = opts.methods[key];
                                method(data);
                            });

                        }


                    });
                }
            });



        }




    }

    createTable(options) {

        var defaults = {

            extends: false,
            parent: this.div_modulo,
            idFilterBar: '',

            parent: 'lsTable',
            coffeesoft: false,
            fn_coffeesoft: 'createCoffeTable3',

            conf: {
                datatable: true,
                fn_datatable: 'simple_data_table',
                beforeSend: true,
                pag: 15,
            },

            methods: {
                send: (data) => { }
            }

        };

        const dataConfig = Object.assign(defaults.conf, options.conf);
        let opts = Object.assign(defaults, options);
        if (dataConfig.datatable && opts.coffeesoft) opts.scrollable = false;
        const idFilter = options.idFilterBar ? options.idFilterBar : '';

        if (idFilter) {

            const sendData = { tipo: 'text', opc: 'ls', ...options.data };

            $(`#${idFilter}`).validar_contenedor(sendData, async (datos) => {

                if (dataConfig.beforeSend) $(`#${options.parent}`).Loading();

                const data = await useFetch({ url: this._link, data: datos });

                if (!options.extends) {

                    let attr_table_filter = {
                        data: data,
                        f_size: '14',
                        id: 'tbSearch'
                    };

                    attr_table_filter = Object.assign(attr_table_filter, opts.attr);

                    opts.methods.send(data);

                    if (opts.success)
                        opts.success(data);

                    if (opts.coffeesoft) {

                        attr_table_filter.parent = opts.parent;
                        if (dataConfig.datatable) attr_table_filter.scrollable = false;
                        this[opts.fn_coffeesoft](attr_table_filter);

                    } else {

                        $('#' + options.parent).rpt_json_table2(attr_table_filter);
                    }

                    if (dataConfig.datatable) {
                        window[dataConfig.fn_datatable]('#' + attr_table_filter.id, dataConfig.pag, dataConfig.filterColumns);
                    }

                    if (typeof lucide !== 'undefined') lucide.createIcons();

                }

            });

        } else {

            let sendData = {
                opc: 'ls',
                ...opts.data
            };

            $(`#${opts.parent}`).Loading();

            useFetch({ url: this._link, data: sendData }).then((data) => {

                if (!opts.extends) {

                    opts.methods.send(data);
                    this.processData(data, opts, dataConfig);

                    if (typeof lucide !== 'undefined') lucide.createIcons();

                }

            });

        }

    }

    createForm(options) {
        // Conf:
        let defaults = {

            parent: 'formsContent',
            id: 'idForm',
            autofill: false,
            plugin: 'content_json_form',
            plugin_validation: 'validation_form',
            extends: false,
            type: 'div',
            class: 'row',
            methods: {
                send: (data = '') => { }
            },
        };

        let formulario = [
            {
                opc: "input",
                lbl: "Producto",
                class: 'col-12'
            },

            {
                opc: "btn-submit",
                id: "btnEnviar",
                text: 'Guardar',
                class: 'col-12'
            },


        ];



        // Reemplazar formulario:
        const jsonForm = options.json || formulario;
        // Fusionar opciones con valores por defecto
        const opts = Object.assign(defaults, options);
        opts.methods = Object.assign({}, defaults.methods, options.methods);  // Asegurar que los mÃ©todos personalizados se fusionen correctamente

        $('#' + opts.parent)[opts.plugin]({ data: jsonForm, class: opts.class, type: 'default', id: opts.id, Element: opts.type });



        if (opts.autofill) {
            // Init process auto inputs
            for (const frm in opts.autofill) {
                // Buscar elementos en el DOM cuyo atributo name coincida con la clave
                const $element = $('#' + opts.id).find(`[name="${frm}"]`);

                if ($element.length > 0) {
                    // Establecer valor dependiendo del tipo de elemento
                    if ($element.is('select')) {
                        // Seleccionar la opciÃ³n correcta en el select
                        $element.val(opts.autofill[frm]).trigger('change');
                    } else {
                        // Para otros elementos como input o textarea
                        $element.val(opts.autofill[frm]);
                    }


                } else {

                }
            }
        }


        let dataForm = {
            tipo: 'text',
            opc: 'set',
            ...options.data
        };

        var extends_ajax;



        $("#" + opts.parent).validation_form(dataForm, (datos) => {

            if (options.beforeSend)
                options.beforeSend();



            extends_ajax = fn_ajax(datos, this._link, '');

            if (!opts.extends) {

                extends_ajax.then((data) => {

                    // $("#" + opts.parent)[0].reset();
                    if (opts.success)
                        opts.success(data);

                    if (opts.methods.send)
                        opts.methods.send(data);

                });

            }


        });
        // return extends_ajax;
        // if(opts.extends){
        //     return extends_ajax;
        // }



    }

    form(options) {
        var defaults = {
            json: [],

            class: "row",
            parent: "",
            Element: "div",

            id: "containerForm",
            prefijo: "",
            icon: "icon-dollar",

            color: "primary",
            color_btn: "outline-primary",
            color_default: "primary",
            text_btn: "Aceptar",
            fn: "EnviarDatos()",
            id_btn: "btnAceptar",
            required: true,
        };

        let opts = Object.assign(defaults, options);

        // Creamos el contenedor
        var div = $("<div>", { class: opts.class, id: opts.id });

        opts.json.map((item, index) => {

            const propierties = { ...item }; // Crear una copia del objeto para evitar modificar el original
            delete propierties.class;
            delete propierties.classElement;
            delete propierties.default;
            delete propierties.opc;

            var children = $("<div>", {
                class: item.class ? "my-2 " + item.class : "col-12 ",
            }).append(
                $("<label>", {
                    class: "fw-semibold ",
                    html: item.lbl,
                })
            );

            // config. attr
            var attr = {
                class: " form-control input-sm " + item.classElement,
                id: item.id,
                name: item.id ? item.id : item.name,
                ...propierties,
            };

            const htmlElements = item.opc ? item.opc : item.element;
            switch (htmlElements) {
                case "input":
                    // Agregar clase de alineaciÃ³n segÃºn el tipo de `item`
                    if (item.tipo === "cifra" || item.tipo === "numero") {
                        attr.class += " text-end";
                    }

                    var element = $("<input>", attr);
                    break;

                case "input-calendar":
                    // Crear contenedor del grupo de input
                    var element = $("<div>", {
                        class: "input-group date calendariopicker",
                    });

                    element.append($("<input>", attr));
                    element.append(
                        $("<span>", { class: "input-group-text" }).append(
                            $("<i>", { class: "icon-calendar-2" })
                        )
                    );
                    break;

                case "select":
                    attr.class = "form-select input-sm " + item.classElement;
                    var element = $("<select>", attr);

                    if (item.default) {
                        element.append($("<option>", { value: "0", text: item.default }));
                    }

                    $.each(item.data, function (_, option) {
                        const isSelected = option.id === item.value;

                        element.append(
                            $("<option>", {
                                value: option.id,
                                text: option.valor,
                                selected: isSelected,
                            })
                        );
                    });

                    break;

                case "textarea":
                    // Crear el elemento textarea
                    attr.class = "form-control resize" + item.classElement;
                    var element = $("<textarea>", attr);
                    break;

                case 'dropdown':

                    // data default.
                    let defaults = [
                        { icon: "icon-pencil", text: "Editar", onClick: () => alert() },
                        { icon: "icon-trash", text: "Eliminar", onClick: () => alert() },
                    ];

                    let opts = Object.assign(defaults, item.data);

                    var $button = $("<button>", {
                        class: "btn btn-outline-primary btn-sm ",
                        id: item.id || "dropdownMenu",
                        type: "button",
                        "data-bs-toggle": "dropdown",
                        "aria-expanded": "false",
                        html: `<i class="${item.iconClass || 'icon-dot-3 text-info'}"></i>`,
                    });


                    var $ul = $("<ul>", { class: "dropdown-menu" });

                    opts.forEach((dropdownItem) => {
                        const $li = $("<li>");

                        // Construir el contenido dinÃ¡mico con Ã­conos y texto
                        let html = dropdownItem.icon && dropdownItem.icon !== ""
                            ? `<i class="text-info ${dropdownItem.icon}"></i>`
                            : "<i class='icon-minus'></i>";
                        html += dropdownItem.text && dropdownItem.text !== ""
                            ? ` ${dropdownItem.text}`
                            : "";

                        const $a = $("<a>", {
                            class: "dropdown-item",
                            id: dropdownItem.id,
                            href: dropdownItem.href || "#",
                            html: html, // Usar el HTML construido con Ã­conos y texto
                        });

                        if (dropdownItem.onClick) {
                            $a.on("click", dropdownItem.onClick);
                        }

                        $li.append($a);
                        $ul.append($li);
                    });
                    var element = $("<div>", { class: "dropdown" }).append($button, $ul);
                    break;


            }

            children.append(element);

            div.append(children);
        });

        $("#" + opts.parent).append(div);
    }

    //

    ModalForm(options) {

        // ConfiguraciÃ³n para formularios.
        const idFormulario = options.id ? options.id : 'modalForm';
        const components = options.components
            ? options.components
            : $("<form>", { novalidate: true, id: idFormulario, class: "" }); // Componente form.


        let defaults = {
            id: idFormulario,
            autofill: false,
            bootbox: {
                title: 'Modal example',
                closeButton: true,
                message: components,
                id: 'modal'
            },
            json: [
                {
                    opc: 'input-group',
                    class: 'col-12',
                    label: 'Nombre'
                },
                {
                    opc: 'btn-submit',
                    text: 'Guardar',
                    class: 'col-12'
                }
            ],
            plugin: 'content_json_form',
            autovalidation: true,
            data: { opc: 'setForm' }
        };

        const opts = this.ObjectMerge(defaults, options);
        let modal = bootbox.dialog(opts.bootbox); // Crear componente modal.

        // Proceso de construccion de un formulario
        $('#' + opts.id)[opts.plugin]({ data: opts.json, type: '' });


        let formData = new FormData($("#" + opts.id)[0]);



        // Proceso de autovalidacion
        if (opts.autovalidation) {


            let options_validation = {
                tipo: "text",
                opc: "save-frm",
            };

            let formData = new FormData($("#" + opts.id)[0]);

            console.log(formData);

            options_validation = Object.assign(options_validation, opts.data);


            $("#" + opts.id).validation_form(options_validation, (data) => {

                console.log("#" + opts.id)
                let formData = new FormData($("#" + opts.id)[0]);

                console.log(formData);


            });



        }










    }

    createModalForm(options) {

        const idFormulario = options.id ? options.id : 'frmModal';

        const components = options.components

            ? options.components
            : $("<form>", { novalidate: true, id: idFormulario, class: "" });



        let defaults = {
            id: idFormulario,
            autofill: false,
            bootbox: {
                title: 'Modal example',
                closeButton: true,
                message: components,
            },
            json: [{ opc: 'label', text: 'Agrega tu formulario', class: 'col-12' }],
            autovalidation: true,
            data: { opc: 'sendForm' }
        };

        const conf = this.ObjectMerge(defaults, options);


        // Operations.
        let SuccessForm = () => {

            if (conf.autovalidation) {
                let options_validation = {
                    tipo: "text",
                    opc: "save-frm",
                };
                $("#" + conf.id).validar_contenedor({ tipo: 'text' }, (ok) => {
                    let formData = new FormData($('#' + conf.id)[0]);
                    const datos = {};
                    formData.forEach((value, key) => (datos[key] = value));
                    // Agregar datos dinÃ¡micos
                    const dynamicData = {};
                    if (conf.dynamicValues)
                        Object.keys(conf.dynamicValues).forEach((key) => {
                            dynamicData[key] = $(conf.dynamicValues[key]).val();
                        });
                    const data = Object.assign(datos, conf.data, dynamicData);
                    useFetch({
                        url: this._link,
                        data: data,
                        success: (request) => {
                            if (conf.success) conf.success(request);
                            modal.modal('hide');
                        }
                    })
                });
            }

        }

        let CancelForm = () => { modal.modal('hide'); }


        conf.json.push(

            {
                opc: "button",
                id: 'btnSuccess',
                className: "w-full",
                onClick: () => SuccessForm(),
                text: "Aceptar",
                class: "col-6"
            },

            {
                opc: "button",
                id: 'btnExit',
                inert: true,
                className: "w-full",
                onClick: () => CancelForm(),
                text: "Cancelar",
                color_btn: "danger",
                class: "col-6"
            },
        );


        // Components.
        let modal = bootbox.dialog(conf.bootbox);
        $('#' + conf.id).content_json_form({ data: conf.json, type: '' });




        /* propiedades de autofill*/

        if (conf.autofill) {
            // Init process auto inputs
            for (const frm in conf.autofill) {
                // Buscar elementos en el DOM cuyo atributo name coincida con la clave
                const $element = $('#' + conf.id).find(`[name="${frm}"]`);

                if ($element.length > 0) {
                    // Establecer valor dependiendo del tipo de elemento
                    if ($element.is('select')) {
                        // Seleccionar la opciÃ³n correcta en el select
                        $element.val(conf.autofill[frm]).trigger('change');
                    } else {
                        // Para otros elementos como input o textarea
                        $element.val(conf.autofill[frm]);
                    }

                } else {
                }
            }
        }





















        // if (options.beforeSend)
        //     options.beforeSend();


        // if (conf.autovalidation) {

        //     let options_validation = {
        //         // tipo: "text",
        //         opc: "save-frm",
        //     };

        //     options_validation = Object.assign(options_validation, conf.data);


        //     $("#" + conf.id).validation_form(options_validation, (formData) => {

        //         const datos = {};
        //         formData.forEach((value, key) => datos[key] = value);

        //     console.log(2,conf.data);
        //         fn_ajax(datos, this._link, '').then((data) => {



        //             if (conf.success)
        //                 conf.success(data);


        //             modal.modal('hide');

        //         });

        //         // fetch(this._link, {
        //         //     method: 'POST', // MÃ©todo HTTP
        //         //     body: datos, // FormData como cuerpo de la solicitud

        //         // }).then(response => { }).then(data => {


        //         // })



        //     });


        // } else {
        //     return modal;
        // }


        // return modal;




    }

    createModal(options) {

        let components = $('<div>');


        let defaults = {
            id: '',
            bootbox: {
                title: 'Modal example',
                closeButton: true,
                message: ' ',
            },

            extends: false,

            data: { opc: 'lsModal' }
        };

        const opts = this.ObjectMerge(defaults, options);



        fn_ajax(opts.data, this._link, '').then((data) => {
            let modal = bootbox.dialog(opts.bootbox);


            if (opts.success)
                options.success(data);

            // modal.modal('hide');


        });

    }

    createfilterBar(options) {

        let defaults = {
            id: 'idFilterBar',
            parent: 'filterBar',
            coffeesoft: false,

            json: [
                {
                    opc: "input-calendar",
                    id: "iptDate",
                    tipo: "text",
                    class: "col-6 col-sm-3",
                    lbl: "Fecha de movimiento",
                },
                {
                    opc: "btn",
                    fn: "Buscar()",
                    color: 'primary',
                    text: "Buscar",
                    class: "col-sm-2",
                },
            ]

        };

        //  Combinar objetos
        let opts = Object.assign(defaults, options);

        if (opts.coffeesoft) {
            this.coffeeForm({
                parent: opts.parent,
                id: opts.id,
                showRequired: false,
                // class: 'grid grid-cols-12 gap-x-4 gap-y-1',
                json: opts.data,
                theme: opts.theme || 'light',
                card: opts.card === true,
                prefijo: opts.prefijo || '',
            });
            return;
        }

        $(`#${opts.parent}`).content_json_form({ data: opts.data, type: '', id: opts.id });



    }

    createTab(options) {
        let txt = "";

        var defaults = {
            data: [],
            id: "myTab",
            parent: "tabs",
        };

        // Carga opciones por defecto
        var opts = Object.assign({}, defaults, options);

        // Creamos el contenedor
        var div = $("<div>", {
            class: " ",
        });

        var ul = $("<ul>", {
            class: "nav nav-tabs",
            id: opts.id,
        });

        var div_content = $("<div>", {
            class: "tab-content ",
        });

        for (const x of opts.data) {
            let active = "";
            let tab_active = "";
            if (x.active) {
                active = "active";
                tab_active = "show active";
            }

            var li = $("<li>", {
                class: "nav-item",
            });

            // if(x.fn)



            // li.html(`<a class="nav-link ${active}"
            //     id="${x.id}-tab"  data-bs-toggle="tab" href="#${x.id}"  onclick="${x.fn}"> ${x.tab}</a>  `);
            li.append(
                $('<a>', {
                    class: "nav-link " + active,
                    id: x.id + "-tab",
                    "data-bs-toggle": "tab",
                    href: "#" + x.id,
                    onclick: x.fn,
                    text: x.tab
                })
            );
            var div_tab = $("<div>", {
                class: "tab-pane fade  mt-2 " + tab_active,
                id: x.id,
            });

            if (x.contenedor) {
                // let div_contenedor = $("<div>", {
                //     class: "row",
                // });

                for (const y of x.contenedor) {
                    var div_cont = $("<div>", {
                        class: y.class,
                        id: y.id,
                    });

                    div_tab.append(div_cont);
                }

                // div_tab.append(div_contenedor);
            }

            ul.append(li);
            div_content.append(div_tab);
        }

        div.append(ul);
        div.append(div_content);
        $(`#${opts.parent}`).html(div);
    }

    createLayaout(options = {}) {
        const defaults = {
            design: true,
            content: this._div_modulo,
            parent: '',
            clean: false,
            data: { id: "rptFormat", class: "col-12" },
        };

        const opts = Object.assign({}, defaults, options);
        const lineClass = opts.design ? ' block ' : '';

        const div = $("<div>", {
            class: opts.data.class,
            id: opts.data.id,
        });

        const row = opts.data.contenedor ? opts.data.contenedor : opts.data.elements;

        row.forEach(item => {
            let div_cont;

            switch (item.type) {

                case 'div':

                    div_cont = $("<div>", {
                        class: (item.class ? item.class : 'row') + ' ' + lineClass,
                        id: item.id,
                    });

                    if (item.children) {
                        item.children.forEach(child => {
                            child.class = (child.class ? child.class + ' ' : '') + lineClass;

                            if (child.type) {

                                div_cont.append($(`<${child.type}>`, child));

                            } else {

                                div_cont.append($("<div>", child));
                            }

                        });
                    }

                    div.append(div_cont);

                    break;

                default:

                    const { type, ...attr } = item;


                    div_cont = $("<" + item.type + ">", attr);

                    div.append(div_cont);
                    break;
            }
        });


        // aplicar limpieza al contenedor

        if (opts.clean)
            $("#" + opts.content ? opts.content : opts.parent).empty();


        if (!opts.parent) {
            $("#" + opts.content).html(div);
        } else {
            $("#" + opts.parent).html(div);
        }

    }

    createNavBar(options) {
        let defaults = {
            logoSrc: 'https://erp-varoch.com/DEV/src/img/user.png',
            logoAlt: 'logo',
            onLogoClick: 'location.reload()',
            onMenuClick: '#',
            themeClass: 'bg-dia',
            menuItems: [
                { icon: 'icon-sun-inv-1', visible: false },
                { icon: 'icon-bell', visible: false },
                {
                    icon: 'icon-mail',
                    visible: false,
                    submenu: '<div id="mensage"><li>Hola</li></div>'
                },
                {
                    id: 'li_user',
                    visible: true,
                    submenu: '<li onClick="redireccion(\'perfil/perfil.php\');"></li>'
                }
            ]
        };
        let opts = $.extend({}, defaults, options);
        // Create header element
        let $header = $('<header>', { class: opts.themeClass });
        // Create section for logo and menu button
        let $section = $('<section>')
            .append(

                $('<span>', {
                    type: 'button',
                    id: 'btnSidebar',
                    html: $('<i>', { class: 'icon-menu ' }),
                    click: function () {
                        if (opts.onMenuClick && typeof opts.onMenuClick === 'function') {
                            opts.onMenuClick();
                        }
                    }
                })

            )
            .append(


                $('<img>', {
                    class: 'd-block mx-4 w-10 h-10',
                    src: opts.logoSrc,
                    alt: opts.logoAlt,
                    click: function () {
                        if (opts.onLogoClick) {
                            eval(opts.onLogoClick);
                        }
                    }
                })
            );
        $header.append($section);

        // Create nav element
        let $nav = $('<nav>');
        let $ul = $('<ul>', { class: 'theme', id: 'navbar' });

        // Create menu items
        opts.menuItems.forEach((item, index) => {
            if (!item.visible) return; // Skip hidden items

            let $li = $('<li>', { id: item.id || null })
                .append($('<i>', { class: item.icon }));

            if (item.submenu) {
                let $submenu = $('<ul>').append(item.submenu);
                $li.append($submenu);
            }

            $ul.append($li);
        });

        $nav.append($ul);
        $header.append($nav);

        // Append to body or specific parent
        $(opts.parent || 'body').prepend($header);



    }


    createTableForm2(options) {

        // 📜 ** Definición de configuración por defecto **

        let defaults = {
            id: options.id || 'root', // Identificador de referencia
            parent: 'root',
            title: '',
            classForm: 'col-12 border rounded-3 p-3',
            success: (data) => { },
            table: {
                id: 'contentTable',
                parent: 'contentTable' + (options.id || 'root'),
                idFilterBar: 'filterBar',
                message: false,
                data: { opc: "ls" },
                conf: {
                    datatable: false,
                    fn_datatable: 'simple_data_table',
                    beforeSend: false,
                    pag: 10,
                },

            },

            form: {
                parent: 'contentForm',
                id: 'formRecetas',
                autovalidation: true,
                plugin: 'content_json_form',
                json: [
                    { opc: "input", lbl: "Nombre", id: "nombre", class: "col-12", tipo: "texto", required: true },
                    {
                        opc: "select", lbl: "Categoría", id: "categoria", class: "col-12", data: [

                            { id: "1", valor: "Platillo" },
                            { id: "2", valor: "Bebida" },
                            { id: "3", valor: "Extras" }
                        ]
                    },
                    { opc: "input", lbl: "Cantidad", id: "cantidad", class: "col-12", tipo: "numero" },
                    { opc: "btn-submit", id: "btnAgregar", text: "Agregar", class: "col-12" }
                ],

                success: (data) => { }



            },

            success: (data) => {

            }
        };

        let opts = this.ObjectMerge(defaults, options);
        let opts_table = Object.assign({}, defaults.table, options.table);

        // 🔵 Corrección del error en la asignación de `success`
        opts.form.success = (data) => {
            this.createTable(opts_table);
            opts.success(data);
            $('#contentForm')[0].reset();

        };

        // 📜 **Funciones para abrir y cerrar el formulario**
        const OpenForm = (form, tb, btn) => {
            $(tb).removeClass("col-md-12").addClass("col-md-8");
            $(form).parent().removeClass("d-none");
            $(btn).addClass("d-none");
        };

        const closeForm = (form, tb, btn) => {
            $(form).parent().addClass("d-none");
            $(tb).removeClass("col-md-8").addClass("col-md-12");
            $(btn).removeClass("d-none");
        };


        // 🔵 **Generación del Layout sin usar primaryLayout**


        let layout = `
        <div class="row p-2">

            <div class="col-12 col-md-4  m-0">

            <div class="${opts.classForm}" id="${opts.form.id}" novalidate>
                <div class="col-12 mb-2 d-flex justify-content-between">
                        <span class="fw-bold fs-5">${opts.title}</span>
                        <button type="button" class="btn-close" aria-label="Close" id="btnClose" ></button>
                        </div>
                        <form class="mt-3 " id="${opts.form.parent}" ></form>
                </div>

            </div>

            <div class="col-12 col-md-8" id="layoutTable">
            <div class="">
                <button type="button" class="btn btn-primary btn-sm d-none" id="addRecetasSub">
                <i class="icon-plus"></i></button>
            </div>

            <div class="m-0 p-0" id="${opts.table.parent}">
                <table class="table table-bordered table-hover table-sm">
                    <thead class="text-white">
                        <tr>
                            <th>Subreceta</th>
                            <th>Cantidad</th>
                            <th><i class="icon-cog"></i></th>
                        </tr>
                    </thead>
                    <tbody id="tbRecetasSub"></tbody>
                </table>
            </div>
            </div>
        </div>`;

        $("#" + opts.parent).append(layout);

        // 📜 **Asignar eventos después de agregar el layout**
        $("#btnClose").on("click", function () {
            closeForm(`#${opts.form.id}`, "#layoutTable", "#addRecetasSub");
        });

        $("#addRecetasSub").on("click", function () {
            OpenForm(`#${opts.form.id}`, "#layoutTable", "#addRecetasSub");
        });

        // Renderizar el formulario y la tabla
        this.createForm(opts.form);
        this.createTable(opts_table);
    }

    createTableForm(options) {
        let name = options.id ? options.id : 'tableForm';

        // 📜 ** Definición de configuración por defecto **


        let defaults = {
            id: name, // Identificador de referencia
            parent: 'root',
            title: '',
            classForm: 'col-12 border rounded-3 p-3',

            table: {
                id: 'contentTable' * name,
                parent: 'contentTable' + name,
                idFilterBar: 'filterBar',
                message: false,
                data: { opc: "ls" },

                conf: {
                    datatable: false,
                    fn_datatable: 'simple_data_table',
                    // beforeSend: false,
                    pag: 10,
                },

            },

            form: {
                parent: 'contentForm' + name,
                id: 'form' + name,
                autovalidation: true,
                plugin: 'content_json_form',
                json: [

                ],

                success: (data) => { }



            },

            success: (data) => {

            }
        };

        let opts = this.ObjectMerge(defaults, options);
        let opts_table = Object.assign({}, defaults.table, options.table);

        // 🔵 Corrección del error en la asignación de `success`
        opts.form.success = (data) => {
            this.createTable(opts_table);
            opts.success(data);
            $('#contentForm' + name)[0].reset();

        };

        // 📜 **Funciones para abrir y cerrar el formulario**
        const OpenForm = (form, tb, btn) => {
            $(tb).removeClass("col-md-12").addClass("col-md-8");
            $(form).parent().removeClass("d-none");
            $(btn).addClass("d-none");
        };

        const closeForm = (form, tb, btn) => {
            $(form).parent().addClass("d-none");
            $(tb).removeClass("col-md-8").addClass("col-md-12");
            $(btn).removeClass("d-none");
        };


        // 🔵 **Generación del Layout sin usar primaryLayout**


        let layout = `
        <div class="row p-2">

            <div class="col-12 col-md-4  m-0">

            <div class="${opts.classForm}" id="${opts.id}"  novalidate>
                <div class="col-12 mb-2 d-flex justify-content-between">
                        <span class="fw-bold fs-5">${opts.title}</span>
                        <button type="button" class="btn-close" aria-label="Close" id="btnClose" ></button>

                </div>
                        <form class="mt-3 " id="${opts.form.parent}" ></form>
            </div>

            </div>

            <div class="col-12 col-md-8" id="layoutTable">
            <div class="">
                <button type="button" class="btn btn-primary btn-sm d-none" id="addRecetasSub">
                <i class="icon-plus"></i></button>
            </div>

            <div class="m-0 p-0" id="${opts.table.parent}">

            </div>
            </div>
        </div>`;

        $("#" + opts.parent).append(layout);

        // 📜 **Asignar eventos después de agregar el layout**
        $("#btnClose").on("click", function () {
            closeForm(`#${opts.id}`, "#layoutTable", "#addRecetasSub");
        });

        $("#addRecetasSub").on("click", function () {
            OpenForm(`#${opts.id}`, "#layoutTable", "#addRecetasSub");
        });


        // Renderizar el formulario y la tabla
        this.createForm(opts.form);
        this.createTable(opts_table);
    }

    createCoffeTable(options) {
        const defaults = {
            theme: 'light',
            subtitle: null,
            dark: false,
            parent: "root",
            id: "coffeeSoftGridTable",
            title: null,
            data: { thead: [], row: [] },
            center: [],
            right: [],
            color_th: "bg-[#003360] text-gray-100",
            color_row: "bg-white hover:bg-gray-50",
            color_group: "bg-gray-200",
            class: "w-full table-auto text-sm text-gray-800",
            onEdit: () => { },
            onDelete: () => { },
            extends: true,
            f_size: 12,
            includeColumnForA: false,
            border_table: "border border-gray-300",
            border_row: "border-t border-gray-300",
            color_row_alt: "bg-gray-100",
            striped: false,
            hover: false,
            hoverColor: 'hover:bg-gray-100 '
        };

        if (options.theme === 'dark') {
            defaults.dark = true;
            defaults.color_th = "bg-[#0F172A] text-white";
            defaults.color_row = "bg-[#1E293B] text-white";
            defaults.color_group = "bg-[#334155] text-white";
            defaults.class = "w-full table-auto text-sm text-white";
            defaults.border_table = "";
            defaults.border_row = "border-t border-gray-700";
            defaults.color_row_alt = "bg-[#111827]";
        }
        else if (options.theme === 'corporativo') {
            defaults.color_th = "bg-[#003360] text-white";
            defaults.color_row = "";
            defaults.color_group = "bg-gray-100 ";
            defaults.class = "w-full text-sm ";
            defaults.border_table = "border rounded-lg  border-gray-300";
            defaults.border_row = "border-t border-gray-300";
            defaults.color_row_alt = "bg-gray-100";
        }

        else if (options.theme === 'light') {
            defaults.color_th = "bg-gray-100 text-gray-600";
            defaults.color_row = "";
            defaults.color_group = "bg-gray-100 ";
            defaults.class = "w-full text-sm ";
            defaults.border_table = "border rounded-lg border-gray-300";
            defaults.border_row = "border-t border-gray-300";
            defaults.color_row_alt = "bg-gray-50";
        }

        else if (options.theme === 'shadcdn') {
            defaults.color_th = "bg-[#111827] text-white";
            defaults.color_row = "bg-white text-[#111827]";
            defaults.color_group = "bg-[#F1F5F9]";
            defaults.class = "w-full table-auto text-sm";
            defaults.border_table = "border rounded-md border-[#CBD5E1]";
            defaults.border_row = "border-t border-[#E2E8F0]";
            defaults.color_row_alt = "bg-[#F8FAFC]";
        }
        else {
            defaults.color_th = "bg-[#F2F5F9] text-[#003360]";
            defaults.color_row = "bg-white hover:bg-gray-600";
            defaults.color_group = "bg-gray-200";
            defaults.class = "w-full table-auto text-sm text-gray-800";
            defaults.border_table = "border rounded-lg  border-gray-300";
            defaults.border_row = "border-t border-gray-200";
            defaults.color_row_alt = "bg-gray-50";
        }

        const opts = Object.assign({}, defaults, options);
        const container = $("<div>", {
            class: "rounded-lg h-full table-responsive ",
        });

        if (opts.title) {
            const titleRow = $(`
            <div class="flex flex-col py-2 ">
                <span class="text-lg font-semibold ${opts.dark ? 'text-gray-100' : 'text-gray-800'}">${opts.title}</span>
                ${opts.subtitle ? `<p class="text-sm ${opts.dark ? 'text-gray-400' : 'text-gray-600'} mt-1">${opts.subtitle}</p>` : ''}
            </div>`);
            container.append(titleRow);
        }

        const table = $("<table>", { id: opts.id, class: ` border-separate border-spacing-0 ${opts.border_table} ${opts.class}` });
        const thead = $("<thead>");

        if (opts.data.thead) {
            if (opts.extends) {
                const columnHeaders = opts.data.thead;
                if (Array.isArray(columnHeaders)) {
                    const headerRow = $('<tr>');
                    columnHeaders.forEach(column => {
                        if (typeof column === 'string') {
                            headerRow.append(`<th class="text-center px-3 py-2 ${opts.color_th}">${column}</th>`);
                        } else {
                            const complexHeaderRow = $('<tr>');
                            Object.keys(column).forEach(key => {
                                const cell = (typeof column[key] === 'object')
                                    ? $('<th>', column[key])
                                    : $('<th>', { text: column[key], class: `text-center ${opts.color_th}` });
                                complexHeaderRow.append(cell);
                            });
                            thead.append(complexHeaderRow);
                        }
                    });
                    thead.append(headerRow);

                } else {
                    columnHeaders.forEach(columnGroup => {
                        const headerGroup = $("<tr>");
                        Object.keys(columnGroup).forEach(key => {
                            const cell = (typeof columnGroup[key] === 'object')
                                ? $('<th>', columnGroup[key])
                                : $('<th>', { text: key });
                            headerGroup.append(cell);
                        });
                        thead.append(headerGroup);
                    });
                }
            } else {
                const simpleHeaderRow = $('<tr>');
                opts.data.thead.forEach(header => {
                    simpleHeaderRow.append(`<th class="text-center px-3 py-2 capitalize ${opts.color_th}">${header}</th>`);
                });
                thead.append(simpleHeaderRow);
            }
        } else {
            const autoHeaderRow = $("<tr>");
            for (let clave in opts.data.row[0]) {
                if (clave != "opc" && clave != "id") {
                    clave = (clave == 'btn' || clave == 'btn_personalizado' || clave == 'a' || clave == 'dropdown') ? '<i class="icon-gear"> </i>' : clave;
                    autoHeaderRow.append($("<th>", {
                        class: `px-2 py-2 ${opts.color_th} capitalize text-center font-semibold`,
                        style: `font-size:${opts.f_size}px;`
                    }).html(clave));
                }
            }
            thead.append(autoHeaderRow);
        }

        table.append(thead);
        const tbody = $("<tbody>");

        opts.data.row.forEach((data, i) => {

            // 🚩 Detectamos fila de agrupación horizontal
            if (data.colgroup) {
                const isCustom = typeof data.colgroup === 'object' && data.colgroup.class;
                const colspan = opts.data.thead?.length || Object.keys(data).length - 2; // exclude id, colgroup
                const labelKey = Object.keys(data).find(key => !['id', 'colgroup'].includes(key));
                const labelText = data[labelKey] || "";
                const paddingClass = isCustom ? "" : (labelText ? " py-2 " : " py-1 ");
                const colgroupColor = isCustom ? data.colgroup.class : opts.color_group;
                const content = isCustom ? "" : labelText;
                const tdClass = isCustom
                    ? `h-[2px] ${colgroupColor}`
                    : `px-3 ${paddingClass} font-semibold lowercase capitalize ${opts.border_row} ${colgroupColor}`;

                const colgroupRow = $("<tr>").append(
                    $("<td>", {
                        colspan: colspan,
                        class: tdClass,
                        html: content
                    })
                );

                tbody.append(colgroupRow);
                return; // Salta esta iteración
            }



            let bg_grupo = "";

            if (data.opc) {
                if (data.opc == 1) {
                    bg_grupo = opts.color_group + " font-bold";
                } else if (data.opc == 2) {
                    bg_grupo = opts.color_group + " text-primary fw-bold ";
                }
            }



            let colorBg = bg_grupo || (opts.striped && i % 2 === 0 ? opts.color_row_alt : opts.color_row);

            let hoverClass = "";
            if (opts.hover && !bg_grupo) {
                if (opts.hoverColor) {
                    hoverClass = opts.hoverColor;
                } else {
                    hoverClass = opts.theme === 'dark' ? 'hover:bg-[#334155]' : 'hover:bg-gray-50';
                }
            }

            delete data.opc;

            const tr = $("<tr>", {
                class: `${hoverClass}`,
            });



            Object.keys(data).forEach((key, colIndex) => {
                if (["btn", "a", "dropdown", "id"].includes(key)) return;

                const align =
                    opts.center.includes(colIndex) ? "text-center" :
                        opts.right.includes(colIndex) ? "text-right" : "text-left";

                let tdText = data[key];
                let cellAttributes = {
                    id: `${key}_${data.id}`,
                    style: `font-size:${opts.f_size}px;`,
                    class: `${align} ${opts.border_row} px-2 py-2 truncate ${colorBg} `,
                    html: tdText
                };



                // Si opts.extends está activo y data[key] es objeto, sobrescribe atributos
                if (opts.extends && typeof data[key] === 'object' && data[key] !== null) {
                    cellAttributes = Object.assign(cellAttributes, data[key]);
                    cellAttributes.class += `${align} px-2 py-2 ${opts.border_row} ${colorBg} `;
                }

                tr.append($("<td>", cellAttributes));
            });

            let actions = '';

            if (data.a?.length) {
                actions = $("<td>", { class: `px-2 py-2 text-center ${colorBg} ${opts.border_row}` });
                const actionsWrapper = $("<div>", { class: "flex justify-end items-center" });
                data.a.forEach(atributos => {
                    const button_a = $("<a>", atributos);
                    actionsWrapper.append(button_a);
                });
                actions.append(actionsWrapper);
                tr.append(actions);
            }

            if (data.dropdown) {
                actions = $("<td>", { class: `px-2 py-2 relative justify-center items-center ${colorBg} ${opts.border_row}` });

                const wrapper = $("<div>", {
                    class: "relative"
                });

                const btn = $("<button>", {
                    class: "icon-dot-3 text-gray-600 hover:text-blue-600",
                    click: function (e) {
                        e.stopPropagation();
                        $("ul.dropdown-menu").hide(); // cerrar todos los menús antes

                        $(this).next("ul").toggle();
                    }
                });

                const menu = $("<ul>", {
                    class: "dropdown-menu absolute top-full right-0 mt-2 w-44 z-10 bg-white border rounded-md shadow-md hidden"
                });

                data.dropdown.forEach((item) =>
                    menu.append(`
                    <li><a onclick="${item.onclick}"text-left class="block px-4 py-2 text-sm hover:bg-gray-100 text-gray-800">
                    <i class="${item.icon} "></i> ${item.text}</a></li>`)
                );





                wrapper.append(btn, menu);
                actions.append(wrapper);

                // Cerrar todos los dropdowns al hacer clic fuera
                $(document).on("click", () => {
                    $("ul.dropdown-menu").hide();
                });
            }

            tr.append(actions);
            tbody.append(tr);
        });

        table.append(tbody);
        container.append(table);
        $(`#${opts.parent}`).html(container);

        $("<style>").text(`
        #${opts.id} th:first-child { border-top-left-radius: 0.5rem; }
        #${opts.id} th:last-child { border-top-right-radius: 0.5rem; }
        #${opts.id} tr:last-child td:first-child { border-bottom-left-radius: 0.5rem; }
        #${opts.id} tr:last-child td:last-child { border-bottom-right-radius: 0.5rem; }
        `).appendTo("head");
    }

    createCoffeTable2(options) {
        const defaults = {
            theme: 'light',
            subtitle: null,
            dark: false,
            parent: "root",
            id: "coffeeSoftGridTable2",
            title: null,
            data: { thead: [], row: [] },
            center: [],
            right: [],
            fixed: [],
            selectable: false,
            folding: false,
            collapsed: false,
            emptyMessage: "No se encontraron registros",
            emptyIcon: "icon-calendar-1",
            color_th: "bg-[#003360] text-gray-100",
            color_row: "",
            color_group: "bg-gray-200",
            class: "w-full table-auto text-sm text-gray-800",
            extends: true,
            f_size: 12,
            border_table: "",
            border_row: "border-t border-gray-300",
            color_row_alt: "bg-gray-100",
            striped: false,
            hover: false,
            bordered: false,
        };

        if (options.theme === 'corporativo') {
            defaults.color_th = "bg-[#003360] text-white";
            defaults.color_row = "";
            defaults.color_group = "bg-gray-100";
            defaults.class = "w-full text-sm";
            defaults.border_table = "rounded-lg";
            defaults.border_row = "border-t border-gray-300";
            defaults.color_row_alt = "bg-gray-100";
        }

        if (options.theme === 'dark') {
            defaults.dark = true;
            defaults.color_th = "bg-[#0F172A] text-white";
            defaults.color_row = "bg-[#1E293B] text-white";
            defaults.color_group = "bg-[#334155] text-white";
            defaults.class = "w-full text-sm text-white";
            defaults.border_table = "";
            defaults.border_row = "border-t border-gray-700";
            defaults.color_row_alt = "bg-[#111827]";
        }

        const opts = Object.assign({}, defaults, options);

        const container = $("<div>", { class: "rounded-lg h-full" });

        if (opts.title) {
            const titleRow = $(`
            <div class="flex flex-col py-2">
                <span class="text-lg font-semibold ${opts.dark ? 'text-gray-100' : 'text-gray-800'}">${opts.title}</span>
                ${opts.subtitle ? `<p class="text-sm ${opts.dark ? 'text-gray-400' : 'text-gray-600'} mt-1">${opts.subtitle}</p>` : ''}
            </div>`);
            container.append(titleRow);
        }

        if (!opts.data.row || opts.data.row.length === 0) {
            const emptyState = $(`
                <div class="flex flex-col items-center justify-center py-12 px-4 rounded-lg">
                    <i class="${opts.emptyIcon} text-4xl text-gray-400 mb-3"></i>
                    <p class="text-base font-medium text-gray-500">${opts.emptyMessage}</p>
                    <p class="text-sm text-gray-400 mt-1">Intenta ajustar los filtros de búsqueda</p>
                </div>
            `);
            container.append(emptyState);
            $(`#${opts.parent}`).html(container);
            return;
        }

        const tableWrapper = $("<div>", {
            class: "overflow-x-auto relative rounded-lg border border-gray-300",
            css: {
                maxWidth: "100%",
                borderRadius: "0.5rem",
                overflow: "auto",
                position: "relative"
            }
        });

        const table = $("<table>", {
            id: opts.id,
            class: `border-separate border-spacing-0 ${opts.border_table} ${opts.class}`,
            css: {
                borderCollapse: "separate",
                borderSpacing: "0",
                position: "relative"
            }
        });

        const thead = $("<thead>");
        const fixedStyles = [];
        let leftOffset = 0;
        let colIdx = 0;

        const borderColor = opts.dark ? 'border-gray-700' : 'border-gray-100';
        const borderedClass = opts.bordered ? `border ${borderColor}` : '';

        // Generar thead desde opts.data.thead si existe, sino desde las claves del primer row
        if (opts.data.thead && opts.data.thead.length > 0) {
            if (opts.extends) {
                const columnHeaders = opts.data.thead;
                if (Array.isArray(columnHeaders)) {
                    const headerRow = $('<tr>');
                    columnHeaders.forEach((column, idx) => {
                        colIdx = idx + 1;
                        const isFixed = opts.fixed.includes(colIdx);

                        if (typeof column === 'string') {
                            let thClass = `text-center px-3 py-2 ${opts.color_th} capitalize font-semibold ${borderedClass}`;
                            if (isFixed) {
                                thClass += ` sticky z-20 border-r border-gray-300`;
                                fixedStyles.push({ col: colIdx, left: leftOffset });
                                leftOffset += 150;
                            }
                            headerRow.append($("<th>", {
                                class: thClass,
                                style: `font-size:${opts.f_size}px;`,
                                'data-col': colIdx
                            }).html(column));
                        } else {
                            const complexHeaderRow = $('<tr>');
                            Object.keys(column).forEach(key => {
                                const cell = (typeof column[key] === 'object')
                                    ? $('<th>', column[key])
                                    : $('<th>', { text: column[key], class: `text-center ${opts.color_th}` });
                                complexHeaderRow.append(cell);
                            });
                            thead.append(complexHeaderRow);
                        }
                    });
                    thead.append(headerRow);
                }
            } else {
                const simpleHeaderRow = $('<tr>');
                opts.data.thead.forEach((header, idx) => {
                    colIdx = idx + 1;
                    const isFixed = opts.fixed.includes(colIdx);
                    let thClass = `text-center px-3 py-2 capitalize ${opts.color_th} font-semibold ${borderedClass}`;
                    if (isFixed) {
                        thClass += ` sticky z-20 border-r border-gray-300`;
                        fixedStyles.push({ col: colIdx, left: leftOffset });
                        leftOffset += 150;
                    }
                    simpleHeaderRow.append($("<th>", {
                        class: thClass,
                        style: `font-size:${opts.f_size}px;`,
                        'data-col': colIdx
                    }).html(header));
                });
                thead.append(simpleHeaderRow);
            }
        } else {
            // Auto-generar thead desde las claves del primer row (excluyendo colgroup rows)
            const firstDataRow = opts.data.row.find(r => !r.colgroup);
            if (firstDataRow) {
                const autoHeaderRow = $("<tr>");
                for (let clave in firstDataRow) {
                    if (["btn", "a", "dropdown", "id", "opc", "colgroup"].includes(clave)) continue;

                    colIdx++;

                    const isFixed = opts.fixed.includes(colIdx);
                    let displayClave = clave;
                    let thClass = `px-2 py-2 ${opts.color_th} capitalize text-center font-semibold ${borderedClass}`;

                    if (isFixed) {
                        thClass += ` sticky z-20 border-r border-gray-300`;
                        fixedStyles.push({ col: colIdx, left: leftOffset });
                        leftOffset += 150;
                    }

                    autoHeaderRow.append($("<th>", {
                        class: thClass,
                        style: `font-size:${opts.f_size}px;`,
                        'data-col': colIdx
                    }).html(displayClave));
                }
                thead.append(autoHeaderRow);
            }
        }

        table.append(thead);

        // Calcular el número total de columnas para colspan
        const totalCols = colIdx;

        const tbody = $("<tbody>");
        let currentGroupId = null;
        let groupIndex = 0;

        opts.data.row.forEach((data, i) => {
            // 🚩 Detectamos fila de agrupación horizontal (colgroup)
            if (data.colgroup) {
                const isCustom = typeof data.colgroup === 'object' && data.colgroup.class;
                const colspan = totalCols || opts.data.thead?.length || Object.keys(data).filter(k => !['id', 'colgroup'].includes(k)).length;
                const labelKey = Object.keys(data).find(key => !['id', 'colgroup'].includes(key));
                const labelText = data[labelKey] || "";
                const paddingClass = isCustom ? "" : (labelText ? " py-2 " : " py-1 ");
                const colgroupColor = isCustom ? data.colgroup.class : opts.color_group;
                const content = isCustom ? "" : labelText;
                const tdClass = isCustom
                    ? `h-[2px] ${colgroupColor}`
                    : `px-3 ${paddingClass} font-semibold lowercase capitalize ${opts.border_row} ${colgroupColor}`;

                const colgroupRow = $("<tr>").append(
                    $("<td>", {
                        colspan: colspan,
                        class: tdClass,
                        html: content
                    })
                );

                tbody.append(colgroupRow);
                return;
            }

            let bg_grupo = "";
            let isGroupRow = false;

            if (data.opc) {
                if (data.opc == 1) {
                    bg_grupo = opts.color_group + " capitalize font-semibold ";
                    isGroupRow = true;
                    groupIndex++;
                    currentGroupId = `group_${opts.id}_${groupIndex}`;
                }
            }

            let colorBg = bg_grupo || (opts.striped && i % 2 === 0 ? opts.color_row_alt : opts.color_row);

            if (opts.hover && !bg_grupo) {
                colorBg += opts.theme === 'dark' ? ' hover:bg-[#334155]' : ' hover:bg-gray-50';
            }

            const originalOpc = data.opc;
            delete data.opc;

            const tr = $("<tr>");

            if (originalOpc) {
                tr.attr('data-opc', originalOpc);
            }

            if (opts.folding && isGroupRow) {
                tr.attr('data-group-header', currentGroupId);
                tr.attr('data-collapsed', opts.collapsed ? 'true' : 'false');
            } else if (opts.folding && currentGroupId && originalOpc != 2) {
                tr.attr('data-group-member', currentGroupId);
                if (opts.collapsed) {
                    tr.addClass('hidden');
                }
            }

            let colIdx = 0;
            let isFirstCell = true;

            Object.keys(data).forEach((key) => {
                if (["btn", "a", "dropdown", "id"].includes(key)) return;

                colIdx++;

                const align = opts.center.includes(colIdx) ? "text-center" : opts.right.includes(colIdx) ? "text-right" : "text-left";
                const isFixed = opts.fixed.includes(colIdx);
                const fixedInfo = fixedStyles.find(f => f.col === colIdx);

                let tdText = data[key];

                if (opts.folding && isGroupRow && isFirstCell && originalOpc == 1) {
                    const iconClass = opts.collapsed ? 'icon-right-open' : 'icon-down-open';
                    tdText = `<span class="folding-icon select-none mr-2 inline-block transition-transform duration-200"><i class="${iconClass}"></i></span>${tdText}`;
                    isFirstCell = false;
                } else if (isFirstCell) {
                    isFirstCell = false;
                }

                let cellClass = ` ${align} ${opts.border_row} px-2 py-2 truncate ${colorBg} `;

                if (opts.bordered) {
                    cellClass += ` border ${borderColor} `;
                }

                if (opts.folding && isGroupRow && colIdx === 1 && originalOpc == 1) {
                    cellClass += ` cursor-pointer select-none `;
                }

                if (isFixed && fixedInfo) {
                    cellClass += ` sticky z-10 border-r border-gray-300 `;
                    if (!colorBg && !bg_grupo) {
                        cellClass += opts.theme === 'dark' ? ' bg-[#1E293B] ' : ' bg-gray-100 ';
                    }
                }

                let cellAttributes = {
                    id: `${key}_${data.id}`,
                    style: `font-size:${opts.f_size}px;${isFixed && fixedInfo ? `left:${fixedInfo.left}px;` : ''}`,
                    class: cellClass,
                    html: tdText,
                    'data-col': colIdx,
                    'data-row': i
                };

                if (opts.folding && isGroupRow && colIdx === 1 && originalOpc == 1) {
                    cellAttributes['data-folding-trigger'] = currentGroupId;
                }

                if (opts.selectable) {
                    cellAttributes.tabindex = 0;
                }

                if (opts.extends && typeof data[key] === 'object' && data[key] !== null) {
                    const originalDataCol = colIdx;
                    const originalDataRow = i;
                    const originalTabindex = cellAttributes.tabindex;

                    const customData = data[key];

                    if (customData.html !== undefined) {
                        cellAttributes.html = customData.html;
                    }
                    if (customData.class !== undefined) {
                        cellAttributes.class = `${cellAttributes.class} ${customData.class}`;
                    }

                    cellAttributes['data-col'] = originalDataCol;
                    cellAttributes['data-row'] = originalDataRow;

                    if (opts.selectable) {
                        cellAttributes.tabindex = originalTabindex;
                    }

                    if (isFixed && fixedInfo) {
                        cellAttributes.class += ` sticky z-10 border-r border-gray-300 `;
                        cellAttributes.style = `font-size:${opts.f_size}px;left:${fixedInfo.left}px;`;

                        const hasCustomBg = customData.class && /bg-\[.*?\]|bg-\w+-\d+|bg-\w+/.test(customData.class);
                        if (!hasCustomBg && !colorBg && !bg_grupo) {
                            cellAttributes.class += opts.theme === 'dark' ? ' bg-[#1E293B] ' : ' bg-gray-100 ';
                        }
                    }

                    if (opts.folding && isGroupRow && colIdx === 1 && originalOpc == 1) {
                        const iconClass = opts.collapsed ? 'icon-right-open' : 'icon-down-open';
                        cellAttributes.html = `<span class="folding-icon select-none mr-2 inline-block transition-transform duration-200"><i class="${iconClass}"></i></span>${cellAttributes.html}`;
                        cellAttributes['data-folding-trigger'] = currentGroupId;
                        cellAttributes.class += ` cursor-pointer select-none`;
                    }
                }

                tr.append($("<td>", cellAttributes));
            });

            // Botones de acción 'a'
            if (data.a?.length) {
                const actions = $("<td>", { class: `px-2 py-2 text-center align-middle ${colorBg} ${opts.border_row}` });
                data.a.forEach(atributos => {
                    const button_a = $("<a>", atributos);
                    actions.append(button_a);
                });
                tr.append(actions);
            }

            tbody.append(tr);
        });

        table.append(tbody);
        tableWrapper.append(table);
        container.append(tableWrapper);
        $(`#${opts.parent}`).html(container);





        if (opts.fixed.length > 0) {
            const bgHeader = opts.theme === 'dark' ? '#374151' : opts.theme === 'corporativo' ? '#003360' : '#003360';
            const bgDefault = opts.theme === 'dark' ? '#283341' : '#F3F4F6';

            let fixedCSS = `
                #${opts.id} { 
                    position: relative; 
                }
                #${opts.id} th[data-col], 
                #${opts.id} td[data-col] { 
                    min-width: 150px; 
                    max-width: 150px;
                    width: 150px;
                }
            `;

            fixedStyles.forEach(({ col, left }) => {
                fixedCSS += `
                    #${opts.id} th[data-col="${col}"],
                    #${opts.id} td[data-col="${col}"] {
                        position: sticky !important;
                        left: ${left}px !important;
                        z-index: 10 !important;
                        min-width: 150px !important;
                        max-width: 150px !important;
                        width: 150px !important;
                    }
                    #${opts.id} th[data-col="${col}"] {
                        z-index: 20 !important;
                        background-color: ${bgHeader} !important;
                    }
                `;
            });

            const bgGroup = opts.theme === 'dark' ? '#334155' : '#E5E7EB';

            $(`#${opts.id} td[data-col]`).each(function () {
                const $cell = $(this);
                const colNum = $cell.attr('data-col');
                const $row = $cell.closest('tr');
                const rowOpc = $row.attr('data-opc');

                if (opts.fixed.includes(parseInt(colNum))) {
                    const cellClasses = $cell.attr('class') || '';
                    const hasBgClass = /bg-\[.*?\]|bg-\w+-\d+|bg-\w+/.test(cellClasses);

                    if (hasBgClass) {
                        const computedBg = window.getComputedStyle($cell[0]).backgroundColor;
                        if (computedBg && computedBg !== 'rgba(0, 0, 0, 0)') {
                            fixedCSS += `
                                #${opts.id} tr[data-row="${$cell.attr('data-row')}"] td[data-col="${colNum}"] {
                                    background-color: ${computedBg} !important;
                                }
                            `;
                        }
                    } else {
                        const bgColor = (rowOpc == '1' || rowOpc == '2') ? bgGroup : bgDefault;
                        fixedCSS += `
                            #${opts.id} tr[data-row="${$cell.attr('data-row')}"] td[data-col="${colNum}"] {
                                background-color: ${bgColor} !important;
                            }
                        `;
                    }
                }
            });

            $("<style>").text(fixedCSS).appendTo("head");
        }

        if (opts.selectable) {
            const focusColor = opts.theme === 'dark' ? 'ring-blue-500' : 'ring-blue-400';
            const focusCSS = `
                #${opts.id} td[tabindex]:focus {
                    outline: none;
                    box-shadow: inset 0 0 0 2px ${opts.theme === 'dark' ? '#3B82F6' : '#60A5FA'};
                    position: relative;
                    z-index: 5;
                }
            `;
            $("<style>").text(focusCSS).appendTo("head");

            $(`#${opts.id}`).on('keydown', 'td[tabindex]', function (e) {
                const $current = $(this);
                const currentRow = parseInt($current.attr('data-row'));
                const currentCol = parseInt($current.attr('data-col'));
                let $next = null;

                switch (e.key) {
                    case 'ArrowUp':
                        e.preventDefault();
                        $next = $(`#${opts.id} td[data-row="${currentRow - 1}"][data-col="${currentCol}"]`);
                        break;
                    case 'ArrowDown':
                        e.preventDefault();
                        $next = $(`#${opts.id} td[data-row="${currentRow + 1}"][data-col="${currentCol}"]`);
                        break;
                    case 'ArrowLeft':
                        e.preventDefault();
                        $next = $(`#${opts.id} td[data-row="${currentRow}"][data-col="${currentCol - 1}"]`);
                        break;
                    case 'ArrowRight':
                        e.preventDefault();
                        $next = $(`#${opts.id} td[data-row="${currentRow}"][data-col="${currentCol + 1}"]`);
                        break;
                    case 'Enter':
                        e.preventDefault();
                        $next = $(`#${opts.id} td[data-row="${currentRow + 1}"][data-col="${currentCol}"]`);
                        break;
                    case 'Tab':
                        e.preventDefault();
                        if (e.shiftKey) {
                            $next = $current.prev('td[tabindex]');
                            if ($next.length === 0) {
                                $next = $current.parent().prev('tr').find('td[tabindex]:last');
                            }
                        } else {
                            $next = $current.next('td[tabindex]');
                            if ($next.length === 0) {
                                $next = $current.parent().next('tr').find('td[tabindex]:first');
                            }
                        }
                        break;
                }

                if ($next && $next.length > 0) {
                    $next.focus();
                    $next[0].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }
            });
        }

        if (opts.folding) {
            $(`#${opts.id}`).on('click', 'td[data-folding-trigger]', function (e) {
                e.stopPropagation();
                const groupId = $(this).attr('data-folding-trigger');
                const $headerRow = $(`#${opts.id} tr[data-group-header="${groupId}"]`);
                const isCollapsed = $headerRow.attr('data-collapsed') === 'true';
                const $members = $(`#${opts.id} tr[data-group-member="${groupId}"]`);
                const $icon = $(this).find('.folding-icon i');

                if (isCollapsed) {
                    $members.removeClass('hidden');
                    $headerRow.attr('data-collapsed', 'false');
                    $icon.removeClass('icon-right-open').addClass('icon-down-open');
                } else {
                    $members.addClass('hidden');
                    $headerRow.attr('data-collapsed', 'true');
                    $icon.removeClass('icon-down-open').addClass('icon-right-open');
                }
            });
        }

        $("<style>").text(`
        #${opts.id} {
            border-collapse: separate !important;
            border-spacing: 0 !important;
        }
        #${opts.id} thead tr:first-child th:first-child {
            border-top-left-radius: 0.5rem !important;
        }
        #${opts.id} thead tr:first-child th:last-child {
            border-top-right-radius: 0.5rem !important;
        }
        #${opts.id} tbody tr:last-child td:first-child {
            border-bottom-left-radius: 0.5rem !important;
        }
        #${opts.id} tbody tr:last-child td:last-child {
            border-bottom-right-radius: 0.5rem !important;
        }
        `).appendTo("head");
    }

    /**
     * createCoffeTable3 - Versión con bordes tradicionales y primera columna flexible
     * Diferencias con v2:
     * - Bordes completos estilo tabla tradicional (border-collapse: collapse)
     * - Primera columna fixed con ancho automático (no fijo de 200px)
     * - Columnas fixed subsecuentes mantienen 200px
     */
    createCoffeTable3(options) {
        const defaults = {
            theme: 'light',
            subtitle: null,
            dark: false,
            parent: "root",
            id: "coffeeSoftGridTable2",
            title: null,
            data: { thead: [], row: [] },
            center: [],
            right: [],
            fixed: [],
            fixedWidth: 200,
            colMinWidth: 150,
            selectable: false,
            folding: false,
            collapsed: false,
            scrollable: true,
            emptyMessage: "No se encontraron registros",
            emptyIcon: "icon-calendar-1",
            color_th: "bg-[#003360] text-gray-100",
            color_row: "",
            color_group: "bg-gray-200",
            class: "w-full table-auto text-sm text-gray-800",
            extends: true,
            f_size: 12,
            border_table: "border border-gray-200 rounded-lg",
            border_row: "border-b border-gray-200",
            color_row_alt: "bg-gray-100",
            striped: false,
            hover: false,
            bordered: false,
            border_color: "",
            border_group: "border-gray-300",
        };

        if (options.theme === 'light') {
            defaults.color_th = "bg-gray-200 text-gray-600";
            defaults.color_row = "";
            defaults.color_group = "bg-gray-100";
            defaults.class = "w-full text-sm";
            defaults.border_table = "border border-gray-200 rounded-lg";
            defaults.border_row = "border-b border-gray-200";
            defaults.border_color = "border-gray-200";
            defaults.color_row_alt = "bg-gray-50";
        }

        if (options.theme === 'corporativo') {
            defaults.color_th = "bg-[#003360] text-white";
            defaults.color_row = "";
            defaults.color_group = "bg-gray-100";
            defaults.class = "w-full text-sm";
            defaults.border_table = "border border-gray-200 rounded-lg";
            defaults.border_row = "border-b border-gray-200";
            defaults.color_row_alt = "bg-gray-100";
        }

        if (options.theme === 'dark') {
            defaults.dark = true;
            defaults.color_th = "bg-[#374151] text-gray-300";
            defaults.color_row = "bg-[#283341]";
            defaults.color_group = "bg-[#334155] text-white";
            defaults.class = "w-full table-auto text-sm text-gray-300";
            defaults.border_table = "";
            defaults.border_row = "border-t border-gray-700";
            defaults.color_row_alt = "bg-[#111827]";
        }

        if (options.theme === 'slate') {
            defaults.color_th = "bg-slate-700 text-slate-100";
            defaults.color_row = "";
            defaults.color_group = "bg-slate-100";
            defaults.class = "w-full text-sm";
            defaults.border_table = "border border-slate-200 rounded-lg";
            defaults.border_row = "border-b border-slate-200";
            defaults.color_row_alt = "bg-slate-50";
        }

        const opts = Object.assign({}, defaults, options);

        if (!('scrollable' in options)) {
            opts.scrollable = opts.fixed.length > 0;
        }

        const getFixedWidth = (col) => {
            if (typeof opts.fixedWidth === 'object') return opts.fixedWidth[col] || 200;
            return opts.fixedWidth;
        };

        const container = $("<div>", { class: "rounded-lg h-full" });

        if (opts.title) {
            const titleRow = $(`
            <div class="flex flex-col py-2">
                <span class="text-lg font-semibold ${opts.dark ? 'text-gray-100' : 'text-gray-800'}">${opts.title}</span>
                ${opts.subtitle ? `<p class="text-sm ${opts.dark ? 'text-gray-400' : 'text-gray-600'} mt-1">${opts.subtitle}</p>` : ''}
            </div>`);
            container.append(titleRow);
        }

        if (!opts.data.row || opts.data.row.length === 0) {
            const emptyState = $(`
                <div class="flex flex-col items-center justify-center py-12 px-4 rounded-lg">
                    <i class="${opts.emptyIcon} text-4xl text-gray-400 mb-3"></i>
                    <p class="text-base font-medium text-gray-500">${opts.emptyMessage}</p>
                    <p class="text-sm text-gray-400 mt-1">Intenta ajustar los filtros de búsqueda</p>
                </div>
            `);
            container.append(emptyState);
            $(`#${opts.parent}`).html(container);
            return;
        }

        const tableWrapper = $("<div>", {
            class: `relative ${opts.scrollable ? 'overflow-x-auto' : ''}`,
        });

        const table = $("<table>", {
            id: opts.id,
            class: `border-separate border-spacing-0 ${opts.border_table} ${opts.class}`
        });

        const thead = $("<thead>");
        const fixedStyles = [];
        let leftOffset = 0;
        let colIdx = 0;

        const borderColor = opts.border_color || (opts.dark ? 'border-gray-700' : 'border-gray-200');
        const borderedClass = opts.bordered
            ? (typeof opts.bordered === 'string' ? opts.bordered : `border-r ${borderColor}`)
            : '';

        // Generar thead desde opts.data.thead si existe, sino desde las claves del primer row
        if (opts.data.thead && opts.data.thead.length > 0) {
            if (opts.extends) {
                const columnHeaders = opts.data.thead;
                if (Array.isArray(columnHeaders)) {
                    const headerRow = $('<tr>');
                    columnHeaders.forEach((column, idx) => {
                        colIdx = idx + 1;
                        const isFixed = opts.fixed.includes(colIdx);

                        if (typeof column === 'string') {
                            let thClass = `text-center px-3 py-2 ${opts.color_th} capitalize font-semibold ${borderedClass}`;
                            let thStyle = `font-size:${opts.f_size}px;`;
                            if (isFixed) {
                                const fw = getFixedWidth(colIdx);
                                thClass += ` sticky z-20 border-r border-gray-200`;
                                thStyle += `left:${leftOffset}px;min-width:${fw}px;width:${fw}px;`;
                                fixedStyles.push({ col: colIdx, left: leftOffset, width: fw });
                                leftOffset += fw;
                            }
                            headerRow.append($("<th>", {
                                class: thClass,
                                style: thStyle,
                                'data-col': colIdx
                            }).html(column));
                        } else {
                            const complexHeaderRow = $('<tr>');
                            Object.keys(column).forEach(key => {
                                const cell = (typeof column[key] === 'object')
                                    ? $('<th>', column[key])
                                    : $('<th>', { text: column[key], class: `text-center ${opts.color_th}` });
                                complexHeaderRow.append(cell);
                            });
                            thead.append(complexHeaderRow);
                        }
                    });
                    thead.append(headerRow);
                }
            } else {
                const simpleHeaderRow = $('<tr>');
                opts.data.thead.forEach((header, idx) => {
                    colIdx = idx + 1;
                    const isFixed = opts.fixed.includes(colIdx);
                    let thClass = `text-center px-3 py-2 capitalize ${opts.color_th} font-semibold ${borderedClass}`;
                    let thStyle = `font-size:${opts.f_size}px;`;
                    if (isFixed) {
                        const fw = getFixedWidth(colIdx);
                        thClass += ` sticky z-20 border-r border-gray-200`;
                        thStyle += `left:${leftOffset}px;min-width:${fw}px;width:${fw}px;`;
                        fixedStyles.push({ col: colIdx, left: leftOffset, width: fw });
                        leftOffset += fw;
                    }
                    simpleHeaderRow.append($("<th>", {
                        class: thClass,
                        style: thStyle,
                        'data-col': colIdx
                    }).html(header));
                });
                thead.append(simpleHeaderRow);
            }
        } else {
            // Auto-generar thead desde las claves del primer row (excluyendo colgroup rows)
            const firstDataRow = opts.data.row.find(r => !r.colgroup);
            if (firstDataRow) {
                const autoHeaderRow = $("<tr>");
                for (let clave in firstDataRow) {
                    if (["id", "opc", "colgroup"].includes(clave)) continue;

                    colIdx++;

                    const isFixed = opts.fixed.includes(colIdx);
                    let displayClave = (clave == 'btn' || clave == 'a' || clave == 'dropdown') ? '<i class="icon-gear"> </i>' : clave;
                    let thClass = `px-2 py-2 ${opts.color_th} capitalize text-center font-semibold ${borderedClass}`;
                    let thStyle = `font-size:${opts.f_size}px;`;

                    if (isFixed) {
                        const fw = getFixedWidth(colIdx);
                        thClass += ` sticky z-20 border-r border-gray-200`;
                        thStyle += `left:${leftOffset}px;min-width:${fw}px;width:${fw}px;`;
                        fixedStyles.push({ col: colIdx, left: leftOffset, width: fw });
                        leftOffset += fw;
                    }

                    autoHeaderRow.append($("<th>", {
                        class: thClass,
                        style: thStyle,
                        'data-col': colIdx
                    }).html(displayClave));
                }
                thead.append(autoHeaderRow);
            }
        }

        table.append(thead);

        // Calcular el número total de columnas para colspan
        const totalCols = colIdx;

        const tbody = $("<tbody>");
        let currentGroupId = null;
        let groupIndex = 0;

        opts.data.row.forEach((data, i) => {
            // 🚩 Detectamos fila de agrupación horizontal (colgroup)
            if (data.colgroup) {
                const isCustom = typeof data.colgroup === 'object' && data.colgroup.class;
                const colspan = totalCols || opts.data.thead?.length || Object.keys(data).filter(k => !['id', 'colgroup'].includes(k)).length;
                const labelKey = Object.keys(data).find(key => !['id', 'colgroup'].includes(key));
                const labelText = data[labelKey] || "";
                const paddingClass = isCustom ? "" : (labelText ? " py-2 " : " py-1 ");
                const colgroupColor = isCustom ? data.colgroup.class : opts.color_group;
                const content = isCustom ? "" : labelText;
                const tdClass = isCustom
                    ? `h-[2px] ${colgroupColor}`
                    : `px-3 ${paddingClass} font-semibold lowercase capitalize ${opts.border_row} ${colgroupColor}`;

                const colgroupRow = $("<tr>").append(
                    $("<td>", {
                        colspan: colspan,
                        class: tdClass,
                        html: content
                    })
                );

                tbody.append(colgroupRow);
                return;
            }

            let bg_grupo = "";
            let isGroupRow = false;

            let borderTopClass = "";

            if (data.opc) {
                if (data.opc == 1) {
                    const groupColor = data.color_group || opts.color_group;
                    bg_grupo = groupColor + " capitalize font-semibold ";
                    isGroupRow = true;
                    groupIndex++;
                    currentGroupId = `group_${opts.id}_${groupIndex}`;
                }
                if (data.opc == 2) {
                    borderTopClass = ` border-t-2 ${borderColor} `;
                }
                if (data.opc == 3) {
                    const groupBorder = opts.border_group || borderColor;
                    borderTopClass = ` border-t-2 border-t-${groupBorder.replace('border-', '')} `;
                }
            }

            let colorBg = bg_grupo || (opts.striped && i % 2 === 0 ? opts.color_row_alt : opts.color_row);

            const originalOpc = data.opc;
            delete data.opc;
            delete data.color_group;

            const tr = $("<tr>");

            if (opts.hover && !bg_grupo) {
                tr.addClass('ct3-hoverable');
            }

            if (originalOpc) {
                tr.attr('data-opc', originalOpc);
            }

            if (opts.folding && isGroupRow) {
                tr.attr('data-group-header', currentGroupId);
                tr.attr('data-collapsed', opts.collapsed ? 'true' : 'false');
            } else if (opts.folding && currentGroupId && originalOpc != 2) {
                tr.attr('data-group-member', currentGroupId);
                if (opts.collapsed) {
                    tr.addClass('hidden');
                }
            }

            let colIdx = 0;
            let isFirstCell = true;

            Object.keys(data).forEach((key) => {
                if (["btn", "a", "dropdown", "id"].includes(key)) return;

                colIdx++;

                const align = opts.center.includes(colIdx) ? "text-center" : opts.right.includes(colIdx) ? "text-right" : "text-left";
                const isFixed = opts.fixed.includes(colIdx);
                const fixedInfo = fixedStyles.find(f => f.col === colIdx);

                let tdText = data[key];

                if (opts.folding && isGroupRow && isFirstCell && originalOpc == 1) {
                    const iconClass = opts.collapsed ? 'icon-right-open' : 'icon-down-open';
                    tdText = `<span class="folding-icon select-none mr-2 inline-block transition-transform duration-200"><i class="${iconClass}"></i></span>${tdText}`;
                    isFirstCell = false;
                } else if (isFirstCell) {
                    isFirstCell = false;
                }

                const truncateClass = opts.scrollable ? 'truncate' : '';
                let cellClass = ` ${align} ${opts.border_row} px-2 py-2 ${truncateClass} ${colorBg} ${borderTopClass} `;

                if (opts.bordered) {
                    cellClass += typeof opts.bordered === 'string'
                        ? ` ${opts.bordered} `
                        : ` border-r ${borderColor} `;
                }

                if (opts.folding && isGroupRow && colIdx === 1 && originalOpc == 1) {
                    cellClass += ` cursor-pointer select-none `;
                }

                if (isFixed && fixedInfo) {
                    cellClass += ` sticky z-10 border-r border-gray-200 `;
                    if (!colorBg && !bg_grupo && !(opts.extends && typeof data[key] === 'object' && data[key]?.class)) {
                        cellClass += opts.theme === 'dark' ? ' bg-[#1E293B] ' : ' bg-gray-100 ';
                    }
                }

                let cellStyle = `font-size:${opts.f_size}px;`;
                if (isFixed && fixedInfo) {
                    cellStyle += `left:${fixedInfo.left}px;min-width:${fixedInfo.width}px;width:${fixedInfo.width}px;`;
                }

                let cellAttributes = {
                    id: `${key}_${data.id}`,
                    style: cellStyle,
                    class: cellClass,
                    html: tdText,
                    'data-col': colIdx,
                    'data-row': i
                };

                if (opts.folding && isGroupRow && colIdx === 1 && originalOpc == 1) {
                    cellAttributes['data-folding-trigger'] = currentGroupId;
                }

                if (opts.selectable) {
                    cellAttributes.tabindex = 0;
                }

                if (opts.extends && typeof data[key] === 'object' && data[key] !== null) {
                    const originalDataCol = colIdx;
                    const originalDataRow = i;
                    const originalTabindex = cellAttributes.tabindex;

                    const customData = data[key];

                    if (customData.html !== undefined) {
                        cellAttributes.html = customData.html;
                    }
                    if (customData.class !== undefined) {
                        cellAttributes.class = `${cellAttributes.class} ${customData.class}`;
                    }

                    cellAttributes['data-col'] = originalDataCol;
                    cellAttributes['data-row'] = originalDataRow;

                    if (opts.selectable) {
                        cellAttributes.tabindex = originalTabindex;
                    }

                    if (isFixed && fixedInfo) {
                        cellAttributes.class += ` sticky z-10 border-r border-gray-200 `;
                        cellAttributes.style = `font-size:${opts.f_size}px;left:${fixedInfo.left}px;min-width:${fixedInfo.width}px;width:${fixedInfo.width}px;`;

                        const hasCustomBg = customData.class && /bg-\[#?[^\]]+\]|bg-[a-z]+-\d+/.test(customData.class);
                        if (!hasCustomBg && !colorBg && !bg_grupo) {
                            cellAttributes.class += opts.theme === 'dark' ? ' bg-[#1E293B] ' : ' bg-gray-100 ';
                        }
                    }

                    if (opts.folding && isGroupRow && colIdx === 1 && originalOpc == 1) {
                        const iconClass = opts.collapsed ? 'icon-right-open' : 'icon-down-open';
                        cellAttributes.html = `<span class="folding-icon select-none mr-2 inline-block transition-transform duration-200"><i class="${iconClass}"></i></span>${cellAttributes.html}`;
                        cellAttributes['data-folding-trigger'] = currentGroupId;
                        cellAttributes.class += ` cursor-pointer select-none`;
                    }
                }

                tr.append($("<td>", cellAttributes));
            });

            // Botones de acción 'a'
            if (data.a) {
                const actions = $("<td>", {
                    class: `px-3 py-2 text-center align-middle whitespace-nowrap ${colorBg} ${opts.border_row}`,
                    style: `width:1%;`
                });
                if (data.a.length) {
                    const actionsWrapper = $("<div>", { class: "inline-flex items-center gap-1" });
                    data.a.forEach(atributos => {
                        const button_a = $("<a>", atributos);
                        actionsWrapper.append(button_a);
                    });
                    actions.append(actionsWrapper);
                }
                tr.append(actions);
            }


            // Dropdown de acciones
            if (data.dropdown?.length) {
                const dropdownTd = $("<td>", {
                    class: `px-2 py-2 relative text-center align-middle ${colorBg} ${opts.border_row}`
                });

                const wrapper = $("<div>", { class: "relative inline-block" });

                const btnClass = opts.dark
                    ? "icon-dot-3 text-gray-400 hover:text-blue-400"
                    : "icon-dot-3 text-gray-600 hover:text-blue-600";

                const btn = $("<button>", {
                    class: btnClass,
                    click: function (e) {
                        e.stopPropagation();
                        $(`#${opts.id} ul.ct3-dropdown-menu`).not($(this).next("ul")).hide();
                        $(this).next("ul").toggle();
                    }
                });

                const menuBg = opts.dark
                    ? "bg-[#1F2A37] border-gray-600 text-white"
                    : "bg-white border-gray-200 text-gray-800";

                const menuHover = opts.dark
                    ? "hover:bg-[#374151]"
                    : "hover:bg-gray-100";

                const menu = $("<ul>", {
                    class: `ct3-dropdown-menu absolute top-full right-0 mt-2 w-44 z-30 border rounded-md shadow-md hidden ${menuBg}`
                });

                data.dropdown.forEach((item) => {
                    const $li = $("<li>");
                    const $a = $("<a>", {
                        class: `block px-4 py-2 text-sm text-left cursor-pointer ${menuHover}`,
                        html: `<i class="${item.icon || ''}"></i> ${item.text || ''}`
                    });
                    if (item.onclick) {
                        $a.attr("onclick", item.onclick);
                    }
                    $li.append($a);
                    menu.append($li);
                });

                wrapper.append(btn, menu);
                dropdownTd.append(wrapper);
                tr.append(dropdownTd);
            }

            tbody.append(tr);
        });

        table.append(tbody);
        tableWrapper.append(table);
        container.append(tableWrapper);
        $(`#${opts.parent}`).html(container);

        // Fijar anchos de columna para evitar redimensionamiento al expandir/colapsar
        if (opts.folding) {
            const $hiddenRows = $(`#${opts.id} tr.hidden`);
            $hiddenRows.removeClass('hidden').addClass('invisible h-0 overflow-hidden');
            requestAnimationFrame(() => {
                $(`#${opts.id} thead th`).each(function () {
                    const w = $(this).outerWidth();
                    $(this).css({ 'min-width': w, 'width': w });
                });
                $hiddenRows.removeClass('invisible h-0 overflow-hidden').addClass('hidden');
            });
        }

        // Cerrar dropdowns ct3 al hacer clic fuera
        $(document).off('click.ct3Dropdown').on('click.ct3Dropdown', () => {
            $(`#${opts.id} ul.ct3-dropdown-menu`).hide();
        });






        if (opts.fixed.length > 0) {
            const bgHeader = opts.theme === 'dark' ? '#374151' : opts.theme === 'corporativo' ? '#003360' : '#003360';
            const bgDefault = opts.theme === 'dark' ? '#283341' : '#F3F4F6';

            let fixedCSS = `
                #${opts.id} {
                    position: relative;
                }
            `;

            fixedStyles.forEach(({ col, left, width }) => {
                fixedCSS += `
                    #${opts.id} th[data-col="${col}"],
                    #${opts.id} td[data-col="${col}"] {
                        position: sticky !important;
                        left: ${left}px !important;
                        z-index: 10 !important;
                        min-width: ${width}px !important;
                        width: ${width}px !important;
                        max-width: ${width}px !important;
                    }
                    #${opts.id} th[data-col="${col}"] {
                        z-index: 20 !important;
                        background-color: ${bgHeader} !important;
                    }
                `;
            });

            const bgGroup = opts.theme === 'dark' ? '#334155' : '#E5E7EB';

            const tailwindColors = {
                'green-50': '#f0fdf4', 'green-100': '#dcfce7', 'green-200': '#bbf7d0', 'green-300': '#86efac',
                'green-400': '#4ade80', 'green-500': '#22c55e', 'green-600': '#16a34a', 'green-700': '#15803d',
                'blue-50': '#eff6ff', 'blue-100': '#dbeafe', 'blue-200': '#bfdbfe', 'blue-300': '#93c5fd',
                'blue-400': '#60a5fa', 'blue-500': '#3b82f6', 'blue-600': '#2563eb', 'blue-700': '#1d4ed8',
                'red-50': '#fef2f2', 'red-100': '#fee2e2', 'red-200': '#fecaca', 'red-300': '#fca5a5',
                'red-400': '#f87171', 'red-500': '#ef4444', 'red-600': '#dc2626', 'red-700': '#b91c1c',
                'yellow-50': '#fefce8', 'yellow-100': '#fef9c3', 'yellow-200': '#fef08a', 'yellow-300': '#fde047',
                'gray-50': '#f9fafb', 'gray-100': '#f3f4f6', 'gray-200': '#e5e7eb', 'gray-300': '#d1d5db',
                'gray-400': '#9ca3af', 'gray-500': '#6b7280', 'gray-600': '#4b5563', 'gray-700': '#374151',
                'purple-50': '#faf5ff', 'purple-100': '#f3e8ff', 'purple-200': '#e9d5ff', 'purple-300': '#d8b4fe',
                'orange-50': '#fff7ed', 'orange-100': '#ffedd5', 'orange-200': '#fed7aa', 'orange-300': '#fdba74',
                'white': '#ffffff', 'black': '#000000'
            };

            const extractBgColor = (classStr) => {
                const arbitraryMatch = classStr.match(/bg-\[([^\]]+)\]/);
                if (arbitraryMatch) return arbitraryMatch[1];

                const standardMatch = classStr.match(/bg-((?:green|blue|red|yellow|gray|purple|orange|white|black)(?:-\d+)?)/);
                if (standardMatch) return tailwindColors[standardMatch[1]] || null;

                return null;
            };

            setTimeout(() => {
                $(`#${opts.id} td[data-col]`).each(function () {
                    const $cell = $(this);
                    const colNum = $cell.attr('data-col');
                    const $row = $cell.closest('tr');
                    const rowOpc = $row.attr('data-opc');

                    if (opts.fixed.includes(parseInt(colNum))) {
                        const cellClasses = $cell.attr('class') || '';
                        const extractedColor = extractBgColor(cellClasses);

                        if (extractedColor) {
                            $cell[0].style.setProperty('background-color', extractedColor, 'important');
                        } else {
                            const bgColor = (rowOpc == '1' || rowOpc == '2') ? bgGroup : bgDefault;
                            $cell[0].style.setProperty('background-color', bgColor, 'important');
                        }
                    }
                });
            }, 50);

            $("<style>").text(fixedCSS).appendTo("head");
        }

        if (opts.selectable) {
            const focusColor = opts.theme === 'dark' ? 'ring-blue-500' : 'ring-blue-400';
            const focusCSS = `
                #${opts.id} td[tabindex]:focus {
                    outline: none;
                    box-shadow: inset 0 0 0 2px ${opts.theme === 'dark' ? '#3B82F6' : '#60A5FA'};
                    position: relative;
                    z-index: 5;
                }
            `;
            $("<style>").text(focusCSS).appendTo("head");

            $(`#${opts.id}`).on('keydown', 'td[tabindex]', function (e) {
                const $current = $(this);
                const currentRow = parseInt($current.attr('data-row'));
                const currentCol = parseInt($current.attr('data-col'));
                let $next = null;

                switch (e.key) {
                    case 'ArrowUp':
                        e.preventDefault();
                        $next = $(`#${opts.id} td[data-row="${currentRow - 1}"][data-col="${currentCol}"]`);
                        break;
                    case 'ArrowDown':
                        e.preventDefault();
                        $next = $(`#${opts.id} td[data-row="${currentRow + 1}"][data-col="${currentCol}"]`);
                        break;
                    case 'ArrowLeft':
                        e.preventDefault();
                        $next = $(`#${opts.id} td[data-row="${currentRow}"][data-col="${currentCol - 1}"]`);
                        break;
                    case 'ArrowRight':
                        e.preventDefault();
                        $next = $(`#${opts.id} td[data-row="${currentRow}"][data-col="${currentCol + 1}"]`);
                        break;
                    case 'Enter':
                        e.preventDefault();
                        $next = $(`#${opts.id} td[data-row="${currentRow + 1}"][data-col="${currentCol}"]`);
                        break;
                    case 'Tab':
                        e.preventDefault();
                        if (e.shiftKey) {
                            $next = $current.prev('td[tabindex]');
                            if ($next.length === 0) {
                                $next = $current.parent().prev('tr').find('td[tabindex]:last');
                            }
                        } else {
                            $next = $current.next('td[tabindex]');
                            if ($next.length === 0) {
                                $next = $current.parent().next('tr').find('td[tabindex]:first');
                            }
                        }
                        break;
                }

                if ($next && $next.length > 0) {
                    $next.focus();
                    $next[0].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }
            });
        }

        if (opts.folding) {
            $(`#${opts.id}`).on('click', 'td[data-folding-trigger]', function (e) {
                e.stopPropagation();
                const groupId = $(this).attr('data-folding-trigger');
                const $headerRow = $(`#${opts.id} tr[data-group-header="${groupId}"]`);
                const isCollapsed = $headerRow.attr('data-collapsed') === 'true';
                const $members = $(`#${opts.id} tr[data-group-member="${groupId}"]`);
                const $icon = $(this).find('.folding-icon i');

                if (isCollapsed) {
                    $members.removeClass('hidden');
                    $headerRow.attr('data-collapsed', 'false');
                    $icon.removeClass('icon-right-open').addClass('icon-down-open');
                } else {
                    $members.addClass('hidden');
                    $headerRow.attr('data-collapsed', 'true');
                    $icon.removeClass('icon-down-open').addClass('icon-right-open');
                }
            });
        }

        $("<style>").text(`
        #${opts.id} {
            border-collapse: separate !important;
            border-spacing: 0 !important;
            width: 100% !important;
        }
        #${opts.id} thead tr:first-child th:first-child {
            border-top-left-radius: 0.5rem;
        }
        #${opts.id} thead tr:first-child th:last-child {
            border-top-right-radius: 0.5rem;
        }
        #${opts.id} tbody tr:last-child td:first-child {
            border-bottom-left-radius: 0.5rem;
        }
        #${opts.id} tbody tr:last-child td:last-child {
            border-bottom-right-radius: 0.5rem;
        }
        #${opts.id} tbody tr:last-child td {
            border-bottom: none !important;
        }
        #${opts.id} tbody tr:first-child td {
            border-top: none !important;
        }
        #${opts.id} thead tr th:last-child,
        #${opts.id} tbody tr td:last-child {
            border-right: none !important;
        }
        ${opts.scrollable ? `
        #${opts.id} th:not(.sticky),
        #${opts.id} td:not(.sticky) {
            min-width: ${opts.colMinWidth}px !important;
        }` : ''}
        ${fixedStyles.map(f => `
        #${opts.id} th.sticky[data-col="${f.col}"],
        #${opts.id} td.sticky[data-col="${f.col}"] {
            min-width: ${f.width}px !important;
            width: ${f.width}px !important;
            max-width: ${f.width}px !important;
        }`).join('')}
        ${opts.hover ? `
        #${opts.id} tbody tr.ct3-hoverable {
            cursor: pointer;
        }
        #${opts.id} tbody tr.ct3-hoverable:hover td {
            background-color: ${opts.theme === 'dark' ? '#334155' : '#E5E7EB'} !important;
            transition: background-color 0.15s ease;
        }` : ''}
        `).appendTo("head");
    }

    tabLayout(options) {
        const defaults = {
            parent: "root",
            id: "tabComponent",
            type: "large", // 'short' | 'large' | 'button'
            theme: "light", // 'dark' | 'light'
            class: "",
            showBorder: true,
            tab: {
                size: 'px-3 py-1',
            },
            content: { class: '', id: '' },
            renderContainer: true,
            tab_container: { class: '' },
            onChange: null,
            json: [
                { id: "TAB1", tab: "TAB1", icon: "", active: true, onClick: () => { } },
                { id: "TAB2", tab: "TAB2", icon: "", onClick: () => { } },
            ]
        };

        const opts = Object.assign({}, defaults, options);

        const themes = {
            dark: {
                base: "bg-gray-900 text-white",
                active: "bg-blue-600 text-white",
                inactive: "text-gray-300 hover:bg-gray-700",
                iconActive: "text-white"
            },
            light: {
                base: "bg-gray-200 text-black",
                active: "bg-white text-black",
                inactive: "text-gray-600 hover:bg-white",
                iconActive: "text-blue-600"
            },
            button: {
                base: "bg-gray-100  p-1 rounded-lg inline-flex shadow-blue-500/50",
                active: "bg-blue-600 text-white",
                inactive: " text-gray-600 hover:bg-gray-50",
                iconActive: "text-white"
            }
        };

        const sizes = {
            large: "rounded-lg flex gap-1 px-1 py-1 w-full text-sm overflow-x-auto",
            short: "rounded-lg flex gap-1 px-1 py-1 text-sm overflow-x-auto",
            button: "gap-1 overflow-x-auto flex-nowrap"
        };

        const scrollbarThinCSS = `
            <style>
                #${opts.id}::-webkit-scrollbar { height: 2px; }
                #${opts.id}::-webkit-scrollbar-track { background: transparent; }
                #${opts.id}::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 2px; }
                #${opts.id}::-webkit-scrollbar-thumb:hover { background: #d1d5db; }
            </style>
        `;
        $('head').append(scrollbarThinCSS);

        const themeStyle = themes[opts.type] || themes[opts.theme];
        const sizeStyle = sizes[opts.type] || sizes['large'];

        const container = $("<div>", {
            id: opts.id,
            class: `${themeStyle.base} ${sizeStyle} ${opts.class}`,
            css: {
                'scrollbar-width': 'thin',
                'scrollbar-color': '#d1d5db transparent'
            }
        });

        opts.json.forEach(tab => {
            const isActive = tab.active || false;

            const buttonClass = opts.type === 'button'
                ? `transition-all duration-200 text-sm md:text-sm font-medium rounded-md px-4 md:px-4 py-2.5 md:py-2 whitespace-nowrap flex-shrink-0
                   ${isActive ? themeStyle.active : themeStyle.inactive}`
                : `transition text-sm md:text-sm font-medium rounded px-3 md:px-3 py-2.5 md:py-2 whitespace-nowrap flex-shrink-0
                   ${isActive ? themeStyle.active : themeStyle.inactive}`;

            let iconHtml = '';
            const inactiveIconColor = opts.theme === 'dark' ? 'text-gray-400' : 'text-gray-800';
            const iconColorClass = isActive ? (tab.iconColor || themeStyle.iconActive || '') : inactiveIconColor;
            let baseIconClasses = '';

            if (tab.lucideIcon) {
                baseIconClasses = 'w-4 h-4 md:w-4 md:h-4 inline-block mr-2 md:mr-2';
                iconHtml = `<i data-lucide="${tab.lucideIcon}" class="${baseIconClasses} ${iconColorClass}" data-base-classes="${baseIconClasses}"></i>`;
            } else if (tab.icon) {
                baseIconClasses = `${tab.icon} mr-2 md:mr-2 text-sm md:text-sm`;
                iconHtml = `<i class='${baseIconClasses} ${iconColorClass}' data-base-classes="${baseIconClasses}"></i>`;
            }

            const tabButton = $("<button>", {
                id: `tab-${tab.id}`,
                name: `${tab.id}`,
                html: iconHtml + tab.tab,
                class: buttonClass,
                "data-state": isActive ? "active" : "inactive",
                "data-icon-color": tab.iconColor || '',
                click: () => {
                    $(`#${opts.id} button`).each(function () {
                        $(this).attr("data-state", "inactive")
                            .removeClass(themeStyle.active)
                            .addClass(themeStyle.inactive);

                        const $icon = $(this).find('i, svg');
                        if ($icon.length) {
                            const baseClasses = $icon.data('base-classes') || '';
                            const currentIconColor = $(this).data('icon-color');
                            if (currentIconColor) {
                                const colorClasses = currentIconColor.split(' ');
                                colorClasses.forEach(cls => $icon.removeClass(cls));
                            }
                            if (themeStyle.iconActive) {
                                $icon.removeClass(themeStyle.iconActive);
                            }
                            $icon.removeClass('text-gray-800 text-gray-400 text-blue-600 text-blue-400 text-white').addClass(opts.theme === 'dark' ? 'text-gray-400' : 'text-gray-800');
                        }
                    });

                    tabButton.attr("data-state", "active")
                        .removeClass(themeStyle.inactive)
                        .addClass(themeStyle.active);

                    setTimeout(() => {
                        if (typeof lucide !== 'undefined') {
                            lucide.createIcons();
                        }

                        const $activeIcon = tabButton.find('i, svg');
                        if ($activeIcon.length) {
                            const iconColor = tabButton.data('icon-color');
                            $activeIcon.removeClass('text-gray-800 text-gray-400');
                            if (iconColor) {
                                const colorClasses = iconColor.split(' ');
                                colorClasses.forEach(cls => $activeIcon.addClass(cls));
                            } else if (themeStyle.iconActive) {
                                $activeIcon.addClass(themeStyle.iconActive);
                            }
                        }
                    }, 10);

                    if (opts.renderContainer) {
                        $(`#content-${opts.id} > div`).addClass("hidden");
                        $(`#container-${tab.id}`).removeClass("hidden");
                    }

                    if (typeof opts.onChange === "function") {
                        opts.onChange(tab.id, tab);
                    }

                    if (typeof tab.onClick === "function") {
                        tab.onClick(tab.id);
                    }
                }
            });

            container.append(tabButton);
        });

        $(`#${opts.parent}`).html(container);

        setTimeout(() => {
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }, 50);

        if (opts.renderContainer) {
            const contentContainer = $("<div>", {
                id: `content-${opts.id}`,
                class: `mt-2 h-screens ${opts.content.class}`,
            });

            opts.json.forEach(tab => {
                const borderClass = opts.showBorder ? 'border p-3' : '';
                const contentView = $("<div>", {
                    id: `container-${tab.id}`,
                    class: `hidden  ${borderClass} ${tab.class ?? ''} rounded-lg`,
                    html: tab.content || ""
                });
                contentContainer.append(contentView);
            });

            $(`#${opts.parent}`).append(contentContainer);

            const activeTab = opts.json.find(t => t.active);
            if (activeTab) {
                $(`#container-${activeTab.id}`).removeClass("hidden");
            }
        }
    }

    navBar(options) {
        const defaults = {
            id: "navBar",
            theme: "light", // "light" | "dark" (Huubie)
            class: "h-[56px] px-4 shadow-md",
            logoFull: "https://erp-varoch.com/ERP24/src/img/logos/logo_row_wh.png",
            logoMini: "https://erp-varoch.com/ERP24/src/img/logos/logo_icon_wh.png",
            user: {
                name: "Rosy Dev",
                photo: "https://huubie.com.mx/alpha/src/img/perfil/fotoUser26_20250803_120920.png",
                onProfile: () => redireccion('perfil/perfil.php'),
                onLogout: () => cerrar_sesion()
            },
            apps: [
                { icon: "icon-calculator", name: "Contabilidad", color: "text-indigo-400" },
                { icon: "icon-gmail", name: "Inventario", color: "text-red-600" },
                { icon: "icon-cart", name: "Ventas", color: "text-green-600" },
                { icon: "icon-bag", name: "Compras", color: "text-yellow-600" },
                { icon: "icon-users", name: "Recursos", color: "text-pink-600" },
                { icon: "icon-chart", name: "Reportes", color: "text-purple-600" },
                { icon: "icon-dollar", name: "POS", color: "text-orange-600" },
                { icon: "icon-industry", name: "Producción", color: "text-purple-600" },
                { icon: "icon-cog", name: "Configuración", color: "text-gray-600" }
            ]
        };

        const opts = Object.assign({}, defaults, options);

        // ===== THEME: Huubie Dark =====
        const isDark = String(opts.theme).toLowerCase() === "dark";
        const colors = {
            navbar: isDark ? "bg-[#1F2A37] text-white" : "bg-[#0A2B4B] text-white", // Huubie dark / Light azul prof.
            dropdownBg: isDark ? "bg-[#1F2A37] text-white" : "bg-white text-gray-800",
            hoverText: isDark ? "hover:text-blue-300" : "hover:text-blue-200",
            userHover: isDark ? "" : "hover:bg-blue-100",
            userBg: isDark ? "bg-[#1F2A37]" : "bg-white",
            border: isDark ? "border border-gray-700" : "border border-gray-200",
            chipBg: isDark ? "bg-gray-700" : "bg-gray-100"
        };

        // NAVBAR
        const header = $("<header>", {
            id: opts.id,
            class: `${colors.navbar} ${opts.class} flex justify-between items-center w-full fixed top-0 left-0 z-40`
        });

        const left = $("<div>", { class: "flex items-center gap-4" }).append(
            $("<button>", {
                id: "btnSidebar",
                class: "text-white hover:text-blue-400 transition-colors duration-200 p-2 rounded focus:outline-none",
                html: `<i class="icon-menu text-2xl"></i>`,
                click: () => {
                    if (typeof opts.onToggle === "function") {
                        opts.onToggle(); // Evento externo personalizado
                    } else {
                        // Comportamiento por defecto: toggle de clase .active
                        $("#sidebar").toggleClass("active");
                    }
                }
            }),
            $("<img>", {
                src: opts.logoFull,
                class: "h-8 hidden sm:block cursor-pointer",
                click: () => location.reload()
            }),
            $("<img>", {
                src: opts.logoMini,
                class: "h-8 block sm:hidden cursor-pointer",
                click: () => location.reload()
            })
        );

        const launcherButton = $("<div>", {
            id: "launcherBtn",
            class: `relative ${colors.hoverText} text-xl cursor-pointer`,
            html: `<i class="icon-th-3"></i>`,
            click: (e) => {
                e.stopPropagation();
                $("#appsLauncher").toggleClass("hidden");
            }
        });

        // USER (click para abrir menú)
        const user = $("<div>", {
            class: "flex items-center gap-2 ml-4 cursor-pointer relative",
            id: "userDropdown"
        }).append(
            $("<img>", {
                src: opts.user.photo,
                class: "w-9 h-9 rounded-full border-2 border-white shadow"
            }),
            $("<span>", {
                class: "hidden sm:block font-medium text-sm",
                text: opts.user.name
            }),
            $("<ul>", {
                id: "userMenu",
                class: `hidden fixed top-16 right-4 w-[280px] ${colors.dropdownBg} rounded-lg ${colors.border} shadow p-2 z-50`
            }).append(
                $("<li>", {
                    class: `px-3 py-2 rounded ${colors.userHover} cursor-pointer flex items-center gap-2`,
                    html: `<i class="icon-user"></i><span>Mi perfil</span>`,
                    click: opts.user.onProfile
                }),
                $("<li>", { class: `my-1 ${colors.border}` }),
                $("<li>", {
                    class: `px-3 py-2 rounded ${colors.userHover} cursor-pointer flex items-center gap-2`,
                    html: `<i class="icon-off"></i><span>Cerrar sesión</span>`,
                    click: opts.user.onLogout
                })
            )
        );

        const right = $("<div>", {
            class: "flex items-center gap-3 relative"
        }).append(launcherButton, user);

        header.append(left, right);
        $("body").prepend(header);

        // APPS LAUNCHER (Huubie dark)
        const launcher = $("<div>", {
            id: "appsLauncher",
            class: `hidden fixed top-16 right-4 w-[320px] ${colors.dropdownBg} rounded-lg ${colors.border} shadow p-4 z-50`
        }).append(
            $("<div>", { class: "mb-3 flex items-center justify-between" }).append(
                $("<h3>", { class: "text-sm font-semibold", text: "Módulos ERP" }),
                $("<span>", { class: `text-[10px] px-2 py-1 rounded ${colors.chipBg} opacity-80`, text: "" })
            ),
            $("<div>", { class: "grid grid-cols-3 gap-3" }).append(
                ...opts.apps.map(app =>
                    $("<button>", {
                        type: "button",
                        class: `flex flex-col items-center gap-2 text-xs px-2 pt-2 pb-3 rounded hover:scale-105 transition ${colors.userHover}`
                    }).append(
                        $("<div>", {
                            class: `w-12 h-12 rounded-lg flex items-center justify-center text-xl ${app.color} ${colors.chipBg}`
                        }).append($("<i>", { class: app.icon })),
                        $("<span>", { class: "opacity-90", text: app.name })
                    )
                )
            )
        );

        $("body").append(launcher);

        // Eventos de toggle/cierre (user & launcher)
        $("#userDropdown").on("click", function (e) {
            e.stopPropagation();
            $("#userMenu").toggleClass("hidden");
            $("#appsLauncher").addClass("hidden");
        });

        $(document).on("click", (e) => {
            if (!$(e.target).closest("#launcherBtn").length && !$(e.target).closest("#appsLauncher").length) {
                $("#appsLauncher").addClass("hidden");
            }
            if (!$(e.target).closest("#userDropdown").length && !$(e.target).closest("#userMenu").length) {
                $("#userMenu").addClass("hidden");
            }
        });
    }

    sideBar(options) {
        const defaults = {
            parent: "body",
            id: "sidebar",
            theme: "light",
            groups: [
                {
                    name: "Administración",
                    icon: "icon-cog",
                    items: [
                        { name: "Usuarios", icon: "icon-user", onClick: () => alert("Usuarios") },
                        { name: "Roles", icon: "icon-key", onClick: () => alert("Roles") }
                    ]
                },
                {
                    name: "Ventas",
                    icon: "icon-cart",
                    items: [
                        { name: "Pedidos", icon: "icon-file-text", onClick: () => alert("Pedidos") },
                        { name: "Clientes", icon: "icon-users", onClick: () => alert("Clientes") }
                    ]
                }
            ]
        };

        const opts = Object.assign({}, defaults, options);
        const isDark = opts.theme === "dark";

        const colors = {
            bg: isDark ? "bg-[#1F2A37]" : "bg-white",
            text: isDark ? "text-white" : "text-gray-800",
            hover: isDark ? "hover:bg-[#1E3A5F]" : "hover:bg-gray-100",
            border: isDark ? "border-gray-700" : "border-gray-200"
        };

        const container = $("<aside>", {
            id: opts.id,
            class: `${colors.bg} ${colors.text} w-64 h-[calc(100vh-56px)] fixed top-[56px] left-0 z-30 shadow-lg transition-transform duration-300 transform -translate-x-full`
        });

        const content = $("<div>", { class: "p-4 space-y-4" });

        opts.groups.forEach(group => {
            const groupContainer = $("<div>", { class: "space-y-2" });

            const groupTitle = $("<h3>", {
                class: "uppercase text-xs font-bold opacity-70",
                html: `<i class="${group.icon} mr-1"></i>${group.name}`
            });

            const itemList = $("<ul>", { class: "ml-2 space-y-1" });

            group.items.forEach(item => {
                itemList.append(
                    $("<li>", {
                        class: `flex items-center gap-2 px-2 py-1 rounded cursor-pointer ${colors.hover}`,
                        html: `<i class="${item.icon} text-sm"></i> <span>${item.name}</span>`,
                        click: item.onClick
                    })
                );
            });

            groupContainer.append(groupTitle, itemList);
            content.append(groupContainer);
        });

        container.append(content);
        $(`${opts.parent}`).append(container);

        // 🧩 Toggle sidebar y root layout
        $(document).on("click", "#btnSidebar", () => {
            $("#sidebar").toggleClass("-translate-x-full");
            $("#root").toggleClass("ml-64 transition-all duration-300");
        });
    }

    dashboardComponent(options) {
        const defaults = {
            parent: "root",
            id: "dashboardComponent",
            title: "📊 Huubie · Dashboard de Eventos",
            subtitle: "Resumen mensual · Cotizaciones · Pagados · Cancelados",
            json: [
                { type: "grafico", id: "barChartContainer", title: "Eventos por sucursal" },
                { type: "tabla", id: "tableSucursal", title: "Tabla de sucursales" },
                { type: "grafico", id: "donutChartContainer", title: "Ventas vs Entrada de dinero" },
                { type: "grafico", id: "topClientsChartContainer", title: "Top 10 clientes" },
                { type: "tabla", id: "tableClientes", title: "Tabla de clientes" }
            ]
        };

        const opts = Object.assign(defaults, options);

        const container = $(`
        <div id="${opts.id}" class="w-full ">
            <!-- Header -->
            <div class="p-6 border-b border-gray-200 ">
                <div class=" mx-auto">
                    <h1 class="text-2xl font-bold text-[#103B60]">${opts.title}</h1>
                    <p class="text-sm text-gray-600">${opts.subtitle}</p>
                </div>
            </div>

            <!-- FilterBar -->
            <div id="filterBarDashboard" class=" mx-auto px-4 py-4">
          
            </div>

             <section id="cardDashboard" class=" mx-auto px-4 py-4">
              
            </section>

            <!-- Content -->
            <section id="content-${opts.id}" class=" mx-auto px-4 py-6 grid gap-6 lg:grid-cols-2"></section>
        </div>`);

        // Renderizar contenedores desde JSON
        opts.json.forEach(item => {
            let block = $("<div>", {
                id: item.id,
                class: "bg-white p-4 rounded-xl shadow-md border border-gray-200 min-h-[200px]"
            });

            if (item.title) {
                const defaultEmojis = {
                    'grafico': '📊',
                    'tabla': '�',
                    'doc': '�',
                    'filterBar': '🔍'
                };

                const emoji = item.emoji || defaultEmojis[item.type] || '';
                const iconHtml = item.icon ? `<i class="${item.icon}"></i> ` : '';
                const titleContent = `${emoji} ${iconHtml}${item.title}`;

                block.prepend(`<h3 class="text-sm font-semibold text-gray-800 mb-3">${titleContent}</h3>`);
            }

            if (item.content && Array.isArray(item.content)) {
                item.content.forEach(contentItem => {
                    const element = $(`<${contentItem.type}>`, {
                        id: contentItem.id || '',
                        class: contentItem.class || '',
                        text: contentItem.text || ''
                    });

                    if (contentItem.attributes) {
                        Object.keys(contentItem.attributes).forEach(attr => {
                            element.attr(attr, contentItem.attributes[attr]);
                        });
                    }

                    if (contentItem.html) {
                        element.html(contentItem.html);
                    }

                    block.append(element);
                });
            }

            $(`#content-${opts.id}`, container).append(block);
        });

        $(`#${opts.parent}`).html(container);
    }

    createTitleModal(options = {}) {
        const defaults = {
            parent: "root",
            class: "",
            icon: "icon-trophy",
            lucideIcon: "",
            title: "",
            subtitle: "",
            color: "bg-purple-600",
        };

        const opts = Object.assign({}, defaults, options);

        const iconHtml = opts.lucideIcon
            ? `<i data-lucide="${opts.lucideIcon}" class="text-xl"></i>`
            : `<i class="${opts.icon} text-xl"></i>`;

        const card = $(`
        <div class="flex items-center space-x-3  ${opts.class}">
            <div class="w-10 h-10 ${opts.color} rounded text-white flex items-center justify-center flex-shrink-0">
                ${iconHtml}
            </div>
            <div class="flex-1 min-w-0 flex flex-col justify-center">
                <h3 class="text-lg font-bold mb-0 leading-tight">${opts.title}</h3>
                <p class="text-xs text-gray-400 mb-0 mt-1">${opts.subtitle}</p>
            </div>
        </div>`);

        if (opts.lucideIcon && typeof lucide !== 'undefined') {
            setTimeout(() => {
                lucide.createIcons();
            }, 100);
        }

        return card;
    }

    infoCard(options) {
        const defaults = {
            parent: "root",
            id: "infoCardKPI",
            class: "",
            theme: "light",
            style: "default",
            coffeesoft: false,
            borderColor: "border-[#8CC63F]",
            cols: 4,
            json: []
        };
        const opts = Object.assign({}, defaults, options);

        const renderCard = (card, i = "") => {
            if (opts.style === "file") {
                let box = '';
                if (!opts.coffeesoft) {
                    box = $("<div>", {
                        id: `${opts.id}_${i}`,
                        class: `${card.bgColor || ""} border ${card.borderColor || opts.borderColor} rounded-lg p-3`
                    });
                } else {
                    box = $("<div>", {
                        id: `${opts.id}_${i}`,
                        class: `${card.bgColor || ""} border-2 group hover:${card.borderColor} rounded-lg p-3`
                    });
                }

                let colorHover = (card.borderColor || "").replace(/^border-/, "");

                const titleRow = $("<div>", {
                    class: "flex items-center justify-between mb-1"
                }).append(
                    $("<p>", {
                        class: "text-sm text-gray-500",
                        text: card.title
                    })
                );

                if (card.onClick) {
                    const btnHoverClass = opts.coffeesoft && colorHover
                        ? `group-hover:bg-${colorHover} group-hover:text-white`
                        : "";
                    const detailBtn = $("<button>", {
                        type: "button",
                        class: `text-xs text-gray-600 bg-gray-100 rounded-full px-2.5 py-0.5 transition-colors ${btnHoverClass}`,
                        text: "Ver detalle"
                    }).on('click', (e) => {
                        e.stopPropagation();
                        card.onClick();
                    });
                    titleRow.append(detailBtn);
                }

                const subtitleElement = card.subtitle
                    ? $("<p>", {
                        class: "text-xs text-gray-400 mb-2",
                        text: card.subtitle
                    })
                    : null;

                const valueContainer = $("<div>", {
                    class: "flex items-center justify-end"
                }).append(
                    $("<span>", {
                        id: card.id || "",
                        class: `text-xl font-bold ${card.data?.color || "text-gray-700"}`,
                        text: card.data?.value
                    })
                );

                box.append(titleRow);
                if (subtitleElement) box.append(subtitleElement);
                box.append(valueContainer);

                return box;
            }
        };

        const gridColsMap = { 4: "md:grid-cols-4", 5: "md:grid-cols-5", 6: "md:grid-cols-6" };
        const gridCols = gridColsMap[opts.cols] || "md:grid-cols-4";
        const container = $("<div>", {
            id: opts.id,
            class: `grid grid-cols-2 ${gridCols} gap-3 ${opts.class}`
        });

        opts.json.forEach((item, i) => container.append(renderCard(item, i)));

        $(`#${opts.parent}`).html(container);
    }

    summaryCard(options) {
        const defaults = {
            parent: "root",
            id: "summaryCard",
            title: "Título",
            subtitle: "",
            icon: "",
            iconBg: "bg-violet-200",
            iconColor: "text-violet-600",
            class: "",
            items: [],
            total: { label: "Total", value: 0, color: "text-green-900" }
        };

        const opts = Object.assign({}, defaults, options);

        let itemsHtml = opts.items.map(item => `
            <div class="flex justify-between mb-2">
                <span class="text-gray-800 text-base text-sm">${item.label}</span>
                <span class="font-semibold ${item.color || 'text-gray-900'} text-sm">${formatPrice(item.value)}</span>
            </div>
        `).join('');

        const iconHtml = opts.icon ? `
            <div class="w-10 h-10 ${opts.iconBg} rounded-lg flex items-center justify-center">
                <i class="${opts.icon} ${opts.iconColor} text-xl"></i>
            </div>
        ` : '';

        const subtitleHtml = opts.subtitle ? `<p class="text-gray-600 font-semibold text-sm">${opts.subtitle}</p>` : '';

        const html = `
            <div id="${opts.id}" class="${opts.class}">
                <div class="flex items-center gap-3 mb-3 px-2">
                    ${iconHtml}
                    <div>
                        <h5 class="text-gray-900 font-bold text-lg">${opts.title}</h5>
                        ${subtitleHtml}
                    </div>
                </div>
                <div class=" border border-gray-300 rounded-lg p-3">
                    ${itemsHtml}
                    <hr class="my-2 border-gray-400">
                    <div class="flex justify-between items-center">
                        <span class="font-bold text-gray-900 text-sm">${opts.total.label}</span>
                        <span class="font-bold ${opts.total.color} text-sm">${formatPrice(opts.total.value)}</span>
                    </div>
                </div>
            </div>
        `;

        $(`#${opts.parent}`).html(html);
    }

    coffeeLoader(options = {}) {
        const defaults = {
            parent: "root",
            id: "coffeeLoader",
            class: "",
            text: "Cargando",
            size: 44,
            py: 20
        };

        const opts = Object.assign({}, defaults, options);
        const styleId = 'coffeeLoaderStyles';

        if (!document.getElementById(styleId)) {
            const style = $('<style>', { id: styleId }).text(`
                @keyframes cs-heartbeat {
                    0%   { transform: scale(1); background: linear-gradient(135deg, #6366f1, #8b5cf6); box-shadow: 0 0 0 0 rgba(99,102,241,.4); }
                    14%  { transform: scale(1.25); }
                    28%  { transform: scale(1); }
                    42%  { transform: scale(1.15); background: linear-gradient(135deg, #ec4899, #d946ef); }
                    70%  { transform: scale(1); box-shadow: 0 0 0 16px rgba(99,102,241,0); background: linear-gradient(135deg, #6366f1, #8b5cf6); }
                    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(99,102,241,0); }
                }
                @keyframes cs-dots { 0%, 20% { content: ''; } 40% { content: '.'; } 60% { content: '..'; } 80%, 100% { content: '...'; } }
                .cs-heart { border-radius: 50%; animation: cs-heartbeat 1.5s ease-in-out infinite; }
                .cs-dots::after { content: ''; animation: cs-dots 1.5s steps(4, end) infinite; }
            `);
            $('head').append(style);
        }

        const container = $('<div>', {
            id: opts.id,
            class: `flex flex-col items-center justify-center gap-5 ${opts.class}`,
            style: `padding-top: ${opts.py}px; padding-bottom: ${opts.py}px;`
        });

        const heart = $('<div>', {
            class: 'cs-heart',
            style: `width: ${opts.size}px; height: ${opts.size}px;`
        });

        const label = $('<p>', {
            class: 'text-sm font-medium text-gray-400 tracking-wide cs-dots',
            text: opts.text
        });

        container.append(heart, label);
        $(`#${opts.parent}`).html(container);
    }

    createNavbar(options) {
        const defaults = {
            parent: "body",
            id: "cs-navbar",
            logo: "ERP",
            logoSuffix: "-GV",
            userName: "",
            height: 50,
            apps: [],
            onToggleSidebar: () => {
                $("#sidebar").toggleClass("active");
                $("#main__content").toggleClass("active");
            },
            onProfile: () => { },
            onLogout: () => { }
        };

        const opts = Object.assign({}, defaults, options);

        let userName = opts.userName || (typeof getCookies === 'function' ? getCookies().USR : 'Usuario');
        try { userName = decodeURIComponent(userName); } catch (e) { }

        const navbar = $("<header>", {
            id: opts.id,
            class: "cs-navbar"
        });

        const section = $("<div>", { class: "cs-navbar__section" });

        const toggleBtn = $("<button>", {
            class: "cs-navbar__toggle",
            html: '<i data-lucide="menu" style="width:18px;height:18px"></i>'
        });
        toggleBtn.on("click", opts.onToggleSidebar);

        const logo = $("<div>", {
            class: "cs-navbar__logo",
            html: `${opts.logo}<span>${opts.logoSuffix}</span>`
        });

        section.append(toggleBtn, logo);

        const nav = $("<div>", { class: "cs-navbar__nav" });

        const launcherBtn = $("<div>", {
            id: "cs-launcherBtn",
            class: "cs-navbar__item",
            html: '<i data-lucide="layout-grid" style="width:18px;height:18px"></i>'
        });
        launcherBtn.on("click", function (e) {
            e.stopPropagation();
            $("#cs-appsLauncher").toggleClass("cs-navbar__launcher--active");
            userDropdown.removeClass("cs-navbar__dropdown--active");
        });

        nav.append(launcherBtn);

        const divider = $("<div>", { class: "cs-navbar__divider" });

        const userContainer = $("<div>", { class: "cs-navbar__user" });

        const avatarContent = $("<div>", {
            class: "cs-navbar__avatar",
            html: '<i data-lucide="user" style="width:16px;height:16px"></i>'
        });

        const nameSpan = $("<span>", { class: "cs-navbar__name", text: userName });
        const chevron = $("<i>", {
            "data-lucide": "chevron-down",
            style: "width:14px;height:14px;color:#64748b"
        });

        userContainer.append(avatarContent, nameSpan, chevron);

        const userDropdown = $("<ul>", { class: "cs-navbar__dropdown" });

        const profileItem = $("<li>", {
            class: "cs-navbar__dropdown-item",
            html: '<i data-lucide="user" style="width:14px;height:14px"></i> Mi perfil'
        });
        profileItem.on("click", opts.onProfile);

        const dividerItem = $("<li>", { class: "cs-navbar__dropdown-divider" });

        const logoutItem = $("<li>", {
            class: "cs-navbar__dropdown-item cs-navbar__dropdown-item--danger",
            html: '<i data-lucide="log-out" style="width:14px;height:14px"></i> Cerrar sesion'
        });
        logoutItem.on("click", opts.onLogout);

        userDropdown.append(profileItem, dividerItem, logoutItem);

        const userWrapper = $("<div>", { class: "cs-navbar__user-wrapper" });
        userWrapper.append(userContainer, userDropdown);

        userContainer.on("click", function (e) {
            e.stopPropagation();
            userDropdown.toggleClass("cs-navbar__dropdown--active");
            $("#cs-appsLauncher").removeClass("cs-navbar__launcher--active");
        });

        const launcher = $("<div>", {
            id: "cs-appsLauncher",
            class: "cs-navbar__launcher"
        });

        const launcherHeader = $("<div>", {
            class: "cs-navbar__launcher-header",
            html: '<span>Modulos ERP</span>'
        });

        const launcherGrid = $("<div>", { class: "cs-navbar__launcher-grid" });

        const iconColors = {
            "icon-calculator": "#818cf8", "icon-users": "#f472b6", "icon-landmark": "#34d399",
            "icon-clipboard-check": "#fbbf24", "icon-calendar-days": "#22d3ee", "icon-flask-conical": "#c084fc",
            "icon-palette": "#fb923c", "icon-cart": "#4ade80", "icon-bag": "#facc15", "icon-chart": "#a78bfa",
            "icon-dollar": "#fb923c", "icon-industry": "#a78bfa", "icon-cog": "#94a3b8", "icon-gmail": "#ef4444"
        };

        opts.apps.forEach(app => {
            const color = app.color || iconColors[app.icon] || "#94a3b8";
            // Soporta tanto "icon-xxx" (clase) como "xxx" (nombre lucide directo)
            const lucideName = (app.icon || "").replace(/^icon-/, "");
            const iconEl = $("<i>", {
                "data-lucide": lucideName,
                style: "width:22px;height:22px"
            });
            const appBtn = $("<button>", {
                class: "cs-navbar__launcher-app",
                type: "button"
            }).append(
                $("<div>", { class: "cs-navbar__launcher-icon", style: `color:${color}` })
                    .append(iconEl),
                $("<span>", { text: app.name })
            );
            if (app.onClick) appBtn.on("click", app.onClick);
            if (app.href) appBtn.on("click", () => { window.location.href = app.href; });
            launcherGrid.append(appBtn);
        });

        launcher.append(launcherHeader, launcherGrid);

        $(document).on("click.csNavbar", function (e) {
            if (!$(e.target).closest("#cs-launcherBtn").length && !$(e.target).closest("#cs-appsLauncher").length) {
                $("#cs-appsLauncher").removeClass("cs-navbar__launcher--active");
            }
            if (!$(e.target).closest(".cs-navbar__user-wrapper").length) {
                userDropdown.removeClass("cs-navbar__dropdown--active");
            }
        });

        nav.append(divider, userWrapper);
        navbar.append(section, nav);

        if (opts.parent === "body") {
            $("body").prepend(navbar);
            $("body").append(launcher);
        } else {
            $(`#${opts.parent}`).html(navbar);
            $(`#${opts.parent}`).append(launcher);
        }

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

}

class Templates extends Components {
    constructor(link, div_modulo) {
        super(link, div_modulo);
    }

    createLayaout(options = {}) {
        const defaults = {
            design: true,
            content: this._div_modulo,
            parent: '',
            clean: false,
            data: { id: "rptFormat", class: "col-12" },
        };

        const opts = Object.assign({}, defaults, options);
        const lineClass = opts.design ? ' block ' : '';

        const div = $("<div>", {
            class: opts.data.class,
            id: opts.data.id,
        });

        const row = opts.data.contenedor ? opts.data.contenedor : opts.data.elements;

        row.forEach(item => {
            let div_cont;

            switch (item.type) {

                case 'div':

                    div_cont = $("<div>", {
                        class: (item.class ? item.class : 'row') + ' ' + lineClass,
                        id: item.id,
                    });

                    if (item.children) {
                        item.children.forEach(child => {
                            child.class = (child.class ? child.class + ' ' : '') + lineClass;

                            if (child.type) {

                                div_cont.append($(`<${child.type}>`, child));

                            } else {

                                div_cont.append($("<div>", child));
                            }

                        });
                    }

                    div.append(div_cont);

                    break;

                default:

                    const { type, ...attr } = item;


                    div_cont = $("<" + item.type + ">", attr);

                    div.append(div_cont);
                    break;
            }
        });


        // aplicar limpieza al contenedor

        if (opts.clean)
            $("#" + opts.content ? opts.content : opts.parent).empty();


        if (!opts.parent) {
            $("#" + opts.content).html(div);
        } else {
            $("#" + opts.parent).html(div);
        }

    }

    createLayout(options = {}) {
        const defaults = {
            design: true,
            content: this._div_modulo,
            parent: '',
            clean: false,
            data: { id: "rptFormat", class: "col-12" },
        };

        const opts = Object.assign({}, defaults, options);
        const lineClass = opts.design ? ' border rounded ' : '';

        const div = $("<div>", {
            class: opts.data.class,
            id: opts.data.id,
        });

        const row = opts.data.container ? opts.data.container : opts.data.elements;

        row.forEach(item => {
            let div_cont;

            switch (item.type) {

                case 'div':

                    div_cont = $("<div>", {
                        class: (item.class ? item.class : 'row') + ' ' + lineClass,
                        id: item.id,
                    });

                    if (item.children) {
                        item.children.forEach(child => {
                            child.class = (child.class ? child.class + ' ' : '') + lineClass;

                            if (child.type) {

                                div_cont.append($(`<${child.type}>`, child));

                            } else {

                                div_cont.append($("<div>", child));
                            }

                        });
                    }

                    div.append(div_cont);

                    break;

                default:

                    const { type, ...attr } = item;


                    div_cont = $("<" + item.type + ">", attr);

                    div.append(div_cont);
                    break;
            }
        });

        if (opts.clean)
            $("#" + opts.content ? opts.content : opts.parent).empty();

        if (!opts.parent) {
            $("#" + opts.content).html(div);
        } else {
            $("#" + opts.parent).html(div);
        }

    }

    createPlantilla(options) {

        let json_components = {
            id: "mdlGastos",
            class: "card-body row m-2",

            contenedor: [
                {
                    type: "form",
                    id: "formGastos",
                    class: " col-lg-4  block pt-2",
                    novalidate: true,
                },

                {
                    type: "div",
                    id: "contentGast",
                    class: "col-lg-8 ",
                    children: [
                        { class: 'col-12', id: 'filterGastos' },
                        { class: 'col-12', id: 'tableGastos' }
                    ]
                },
            ]
        };


        var defaults = { data: json_components, design: true };
        let opts = Object.assign(defaults, options);
        this.createLayaout(opts);

    }

    splitLayout(options) {
        let name = options.id ? options.id : 'splitLayout';
        // ConfiguraciÃ³n por defecto
        let defaults = {
            id: name,
            parent: this._div_modulo,
            className: "flex flex-col w-full h-full p-1",

            filterBar: {
                id: 'filterBar' + name,
                class: 'w-full h-1/4  line',
                text: 'filterBar'
            },

            container: {

                id: 'container' + name,
                class: 'flex h-2/4 w-full flex-grow ',

                children: [
                    { class: 'w-1/2 line', id: 'left' + name, text: 'splitlayout' },
                    { class: 'w-1/2 line', id: 'right' + name }
                ],

            },

            footer: {
                id: 'footer' + name,
                class: 'w-full h-1/4  line',
            },
        };



        // Combina los valores predeterminados con las opciones proporcionadas
        const opts = this.ObjectMerge(defaults, options);

        // Construye el objeto JSON de componentes
        let jsonComponents = {
            id: opts.id,
            class: opts.className,
            contenedor: [
                {
                    type: 'div',
                    ...opts.filterBar, // Barra de filtros
                },
                {
                    type: 'div',
                    ...opts.container, // Contenedor central
                    children: opts.container.children.map((child) => ({
                        type: 'div',
                        ...child, // Mapea cada hijo del contenedor
                    })),
                },
                {
                    type: 'div',
                    ...opts.footer, // Pie de pÃ¡gina
                },
            ],
        };

        // Crea la plantilla con los datos generados
        this.createPlantilla({
            data: jsonComponents,
            parent: opts.parent,
            design: false,
        });
    }

    primaryLayout(options) {
        const name = options.id ? options.id : 'primaryLayout';

        let defaults = {
            id: name,
            parent: this._div_modulo,
            class: "d-flex mx-2 my-2 h-100",
            card: {
                name: "singleLayout",
                class: "flex flex-col col-12",
                filterBar: { class: 'w-full my-3 ', id: 'filterBar' + name },
                container: { class: 'w-full my-3  rounded-lg h-[calc(100vh-20rem)] ', id: 'container' + name }
            }
        };


        // Mezclar opciones con valores predeterminados
        const opts = this.ObjectMerge(defaults, options);


        this.createPlantilla({
            data: {
                id: opts.id,
                class: opts.class,
                contenedor: [
                    {
                        type: "div",
                        id: opts.card.name,
                        class: opts.card.class,
                        children: [
                            { type: "div", class: opts.card.filterBar.class, id: opts.card.filterBar.id },
                            { type: "div", class: opts.card.container.class, id: opts.card.container.id }
                        ]
                    }
                ]
            }, parent: opts.parent, design: false
        });

    }

    verticalLinearLayout(options) {

        let defaults = {
            id: '',
            parent: this._div_modulo,
            className: "flex m-2 ",


            card: {
                id: "singleLayout",
                className: "w-full",
                filterBar: { className: 'w-full  line', id: 'filterBar' },
                container: { className: 'w-full my-2 line', id: 'container' },
                footer: { className: 'w-full my-2 line', id: 'footer' },
            }


        };


        const opts = this.ObjectMerge(defaults, options);
        let jsonComponents = {
            id: opts.id,
            class: opts.className,
            contenedor: [
                {
                    type: "div",
                    id: opts.card.id,
                    class: opts.card.className,
                    children: [
                        { class: opts.card.filterBar.className, id: opts.card.filterBar.id },
                        { class: opts.card.container.className, id: opts.card.container.id },
                        { class: opts.card.footer.className, id: opts.card.footer.id },
                    ],
                },
            ],
        };
        this.createPlantilla({ data: jsonComponents, parent: opts.parent, design: false });
    }

    secondaryLayout(components) {
        let name = components.id ? components.id : 'secondaryLayout';


        let nameComponent = {
            name: name,
            parent: this._div_modulo,
            className: 'flex p-2 ',
            cardtable: {
                className: 'col-7 line',
                id: 'containerTable' + name,
                filterBar: { id: 'filterTable', className: 'col-12 mb-2 line' },
                container: { id: 'listTable', className: 'col-12 line' },
            },
            cardform: {
                className: 'col-5 line',
                id: 'containerForm' + name,

            },
        };

        let ui = this.ObjectMerge(nameComponent, components);

        let jsonComponents = {
            id: ui.name,
            class: ui.className,

            contenedor: [

                {
                    type: 'div',
                    id: ui.cardform.id,
                    class: ui.cardform.className,

                },

                {
                    type: "div",
                    id: ui.cardtable.id,
                    class: ui.cardtable.className,
                    children: [
                        { class: ui.cardtable.filterBar.className, id: ui.cardtable.filterBar.id },
                        { class: ui.cardtable.container.className, id: ui.cardtable.container.id },
                    ]
                },


            ],
        };

        this.createPlantilla({
            data: jsonComponents,
            parent: ui.parent,
            design: false
        });
    }

    tabsLayout(components) {
        let jsonTabs = [
            { tab: "tab-1", id: "tab-1", active: true },
            { tab: "tab-2", id: "tab-2" },
        ];
        let defaults = {
            parent: 'tabsLayout',
            id: 'tabs',
            json: jsonTabs
        };

        let opts = Object.assign(defaults, components);
        $(`#${opts.parent}`).simple_json_tab({ data: opts.json });
    }

}


async function useFetch(options = {}) {

    // Valores predeterminados
    let defaults = {

        method: 'POST',
        data: { opc: 'ls' },
        url: '',
        success: null

    };

    // Mezclar los valores predeterminados con las opciones proporcionadas
    let opts = Object.assign({}, defaults, options);

    // Validar que la URL estÃ© definida
    if (!opts.url) {
        console.error('URL es obligatoria.');
        return null;
    }

    try {
        // Realizar la peticiÃ³n fetch
        let response = await fetch(opts.url, {
            method: opts.method,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(opts.data),
        });

        // Procesar la respuesta como JSON
        let data = await response.json();

        // Si se proporciona el mÃ©todo success, lo ejecutamos con los datos obtenidos
        if (typeof opts.success === 'function') {
            opts.success(data);
        }

        // Retornar los datos por si se quieren usar fuera de la funciÃ³n success
        return data;
    } catch (error) {
        console.error('Error en la petición:', error);
        return null;
    }
}

function formDataToJson(formData) {
    let obj = {};
    formData.forEach((value, key) => {
        // Si el objeto ya tiene una propiedad con ese nombre, la convierte en un array
        if (obj[key]) {
            // Si ya es un array, agrega el nuevo valor
            if (Array.isArray(obj[key])) {
                obj[key].push(value);
            } else {
                obj[key] = [obj[key], value];
            }
        } else {
            obj[key] = value;
        }
    });
    return obj;
}

