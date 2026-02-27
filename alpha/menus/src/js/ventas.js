// Instanciar la clase y generar las tarjetas
$(async () => {
    const data = await useFetch({ url: "/alpha/access/ctrl/ctrl-access.php", data: { opc: 'company' } });

    let tarjetas = [];
    // Crear las tarjetas dinamicamente
    data['routes'].forEach(route => {
        if (data['level'] != '5') {
            tarjetas.push({
                titulo: route['name'],
                descripcion: route['description'],
                imagen: "/alpha/" + route['image'],
                enlace: "/alpha/" + route['route'],
                padding: route['padding']
            });
        } else {
            tarjetas.push({
                titulo: route['nickname'],
                descripcion: route['description'],
                imagen: "/alpha/" + route['image'],
                enlace: "/alpha/" + route['route'],
                padding: route['padding']
            });
        }
    });

    if (data['level'] == '1') {
        tarjetas.push({
            titulo: "Configuración",
            descripcion: "Agrega usuarios y sucursales.",
            imagen: "/alpha/src/img/configuracion.svg",
            enlace: "/alpha/admin/",
            padding: ""
        });
    }
    let card = new Cards("#grid-card", tarjetas);
    card.render();
});
