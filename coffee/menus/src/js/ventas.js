// Instanciar la clase y generar las tarjetas
$(async () => {
    const data = await useFetch({ url: "/coffee/access/ctrl/ctrl-access.php", data: { opc: 'company' } });

    let tarjetas = [];
    // Crear las tarjetas dinamicamente
    data['routes'].forEach(route => {
        if (data['level'] != '5') {
            tarjetas.push({
                titulo: route['name'],
                descripcion: route['description'],
                imagen: "/coffee/" + route['image'],
                enlace: "/coffee/" + route['route'],
                padding: route['padding']
            });
        } else {
            tarjetas.push({
                titulo: route['nickname'],
                descripcion: route['description'],
                imagen: "/coffee/" + route['image'],
                enlace: "/coffee/" + route['route'],
                padding: route['padding']
            });
        }
    });

    if (data['level'] == '1') {
        tarjetas.push({
            titulo: "Reportes",
            descripcion: "Genera reportes detallados de ventas y turnos.",
            imagen: "/coffee/src/img/reportes.svg",
            enlace: "/coffee/pedidos-reportes/",
            padding: ""
        });
        // tarjetas.push({
        //     titulo: "Inventario",
        //     descripcion: "Administra tu inventario de productos.",
        //     imagen: "/coffee/src/img/inventario.svg",
        //     enlace: "/coffee/inventario/",
        //     padding: ""
        // });
        tarjetas.push({
            titulo: "Configuración",
            descripcion: "Agrega usuarios y sucursales.",
            imagen: "/coffee/src/img/configuracion.svg",
            enlace: "/coffee/admin/",
            padding: ""
        });
    }
    let card = new Cards("#grid-card", tarjetas);
    card.render();
});
