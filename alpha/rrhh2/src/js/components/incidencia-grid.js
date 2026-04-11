Components.prototype.incidenciaGrid = function (options) {
    const defaults = {
        parent: "root",
        id: "incidenciaGrid",
        class: "w-full",
        title: "Incidencias Semanal",
        json: [],
        dates: [],
        onStatusChange: () => {}
    };

    const opts = Object.assign({}, defaults, options);

    const statusConfig = {
        atiempo:        { dot: 'bg-green-400',   label: 'Asistencia' },
        retardo:        { dot: 'bg-red-400',     label: 'Retardo' },
        falta:          { dot: 'bg-red-400',     label: 'Falta' },
        vacaciones:     { dot: 'bg-yellow-400',  label: 'Vacaciones' },
        incapacidad:    { dot: 'bg-pink-400',    label: 'Incapacidad' },
        reconocimiento: { dot: 'bg-purple-400',  label: 'Reconocimiento' },
        sin_estatus:    { dot: 'bg-gray-400',    label: 'Sin Estatus' }
    };

    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Mi\u00e9rcoles', 'Jueves', 'Viernes', 'S\u00e1bado'];

    const empleadosMap = {};
    opts.json.forEach(item => {
        if (!empleadosMap[item.empleado_id]) {
            empleadosMap[item.empleado_id] = {
                id: item.empleado_id,
                nombre: item.nombre_completo,
                puesto: item.puesto,
                color_badge: item.color_badge,
                turno: item.turno,
                dias: {}
            };
        }
        empleadosMap[item.empleado_id].dias[item.fecha] = {
            id: item.id,
            estatus: item.estatus
        };
    });

    const empleados = Object.values(empleadosMap);

    const container = $("<div>", {
        id: opts.id,
        class: opts.class
    });

    const card = $("<div>", {
        class: "bg-[#1F2A37] border border-gray-700/60 rounded-xl overflow-hidden"
    });

    const header = $("<div>", {
        class: "px-5 py-3 border-b border-gray-700/50"
    }).append(
        $("<h2>", {
            class: "text-sm font-bold text-white",
            text: opts.title
        })
    );

    const tableWrapper = $("<div>", {
        class: "overflow-x-auto"
    });

    const table = $("<table>", {
        class: "w-full"
    });

    const thead = $("<thead>").append(
        (() => {
            const tr = $("<tr>", {
                class: "text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-700/50"
            });

            tr.append($("<th>", { class: "text-left py-3 px-5 font-medium", text: "Colaborador" }));
            tr.append($("<th>", { class: "text-left py-3 px-3 font-medium", text: "Puesto" }));
            tr.append($("<th>", { class: "text-left py-3 px-3 font-medium", text: "Turno" }));

            opts.dates.forEach(date => {
                const d = new Date(date + 'T12:00:00');
                const dayName = dayNames[d.getDay()];
                const dateFormatted = date.split('-').reverse().join('/');
                tr.append(
                    $("<th>", {
                        class: "text-center py-3 px-2 font-medium"
                    }).html(`${dayName}<br><span class="text-[8px] text-gray-600">${dateFormatted}</span>`)
                );
            });

            return tr;
        })()
    );

    const tbody = $("<tbody>", {
        class: "divide-y divide-gray-800/50"
    });

    empleados.forEach(emp => {
        const tr = $("<tr>", {
            class: "hover:bg-[#1a2332] transition-colors"
        });

        const initials = emp.nombre.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
        const gradients = [
            'from-purple-500 to-pink-500',
            'from-green-500 to-teal-500',
            'from-blue-500 to-purple-500',
            'from-orange-500 to-red-500',
            'from-pink-500 to-purple-500',
            'from-teal-500 to-blue-500',
            'from-yellow-500 to-orange-500'
        ];
        const gradient = gradients[emp.id % gradients.length];

        tr.append(
            $("<td>", { class: "py-3 px-5" }).append(
                $("<div>", { class: "flex items-center gap-2" }).append(
                    $("<div>", {
                        class: `w-8 h-8 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-[10px] font-bold text-white`,
                        text: initials
                    }),
                    $("<p>", { class: "text-xs font-medium text-white", text: emp.nombre })
                )
            )
        );

        const puestoColors = {
            purple: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
            blue:   'bg-blue-500/15 text-blue-400 border-blue-500/30',
            orange: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
            gray:   'bg-gray-500/15 text-gray-400 border-gray-500/30'
        };
        const puestoClass = puestoColors[emp.color_badge] || puestoColors.gray;

        tr.append(
            $("<td>", { class: "py-3 px-3" }).append(
                $("<span>", {
                    class: `inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${puestoClass}`,
                    text: emp.puesto
                })
            )
        );

        tr.append(
            $("<td>", { class: "py-3 px-3 text-[11px] text-gray-400", text: emp.turno })
        );

        opts.dates.forEach(date => {
            const dia = emp.dias[date] || { id: null, estatus: 'sin_estatus' };
            const cfg = statusConfig[dia.estatus] || statusConfig.sin_estatus;

            const cellBtn = $("<button>", {
                class: "relative inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] text-gray-300 hover:bg-gray-700/50 transition-colors cursor-pointer",
                'data-incidencia-id': dia.id,
                'data-empleado-id': emp.id,
                'data-fecha': date,
                'data-estatus': dia.estatus
            }).append(
                $("<span>", { class: `inline-block w-1.5 h-1.5 rounded-full ${cfg.dot}` }),
                $("<span>", { text: cfg.label })
            );

            cellBtn.on('click', function (e) {
                e.stopPropagation();
                $(".incidencia-dropdown").remove();
                const btn = $(this);
                const rect = this.getBoundingClientRect();

                const dropdown = $("<div>", {
                    class: "incidencia-dropdown fixed z-[9999] bg-[#1F2A37] border border-gray-600 rounded-lg shadow-xl py-1 min-w-[140px]",
                    css: {
                        top: rect.bottom + 4,
                        left: rect.left
                    }
                });

                Object.keys(statusConfig).forEach(key => {
                    const item = statusConfig[key];
                    const option = $("<button>", {
                        class: "w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:bg-gray-700/50 transition-colors text-left"
                    }).append(
                        $("<span>", { class: `inline-block w-2 h-2 rounded-full ${item.dot}` }),
                        $("<span>", { text: item.label })
                    );

                    option.on('click', function () {
                        const incId     = btn.data('incidencia-id');
                        const empId     = btn.data('empleado-id');
                        const fecha     = btn.data('fecha');

                        btn.data('estatus', key);
                        btn.find('span:first').attr('class', `inline-block w-1.5 h-1.5 rounded-full ${statusConfig[key].dot}`);
                        btn.find('span:last').text(statusConfig[key].label);

                        $(".incidencia-dropdown").remove();

                        opts.onStatusChange({
                            incidencia_id: incId,
                            empleado_id: empId,
                            fecha: fecha,
                            estatus: key
                        });
                    });

                    dropdown.append(option);
                });

                $("body").append(dropdown);
            });

            tr.append($("<td>", { class: "py-3 px-2 text-center" }).append(cellBtn));
        });

        tbody.append(tr);
    });

    table.append(thead, tbody);
    tableWrapper.append(table);
    card.append(header, tableWrapper);
    container.append(card);

    $(document).off('click.incidenciaGrid').on('click.incidenciaGrid', function () {
        $(".incidencia-dropdown").remove();
    });

    $(`#${opts.parent}`).html(container);
};
