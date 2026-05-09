// Instanciar la clase y generar las tarjetas
$(async () => {
    const data = await useFetch({ url: "/app/access/ctrl/ctrl-access.php", data: { opc: 'company' } });

    let tarjetas = [];
    // Crear las tarjetas dinamicamente
    data['routes'].forEach(route => {
        if (data['level'] != '5') {
            tarjetas.push({
                titulo: route['name'],
                descripcion: route['description'],
                imagen: "/app/" + route['image'],
                enlace: "/app/" + route['route'],
                padding: route['padding']
            });
        } else {
            tarjetas.push({
                titulo: route['nickname'],
                descripcion: route['description'],
                imagen: "/app/" + route['image'],
                enlace: "/app/" + route['route'],
                padding: route['padding']
            });
        }
    });

    if (data['level'] == '1') {
        tarjetas.push({
            titulo: "Reportes",
            descripcion: "Genera reportes detallados de ventas y turnos.",
            imagen: "/app/src/img/reportes.svg",
            enlace: "/app/pedidos-reportes/",
            padding: ""
        });
        // tarjetas.push({
        //     titulo: "Inventario",
        //     descripcion: "Administra tu inventario de productos.",
        //     imagen: "/app/src/img/inventario.svg",
        //     enlace: "/app/inventario/",
        //     padding: ""
        // });
        tarjetas.push({
            titulo: "Configuración",
            descripcion: "Agrega usuarios y sucursales.",
            imagen: "/app/src/img/configuracion.svg",
            enlace: "/app/admin/",
            padding: ""
        });
    }
    let card = new Cards("#grid-card", tarjetas);
    card.render();
});
