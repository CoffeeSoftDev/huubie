let api = 'ctrl/ctrl-almacen.php';
let app, materiales, inventario, movimientos, existencias, catalogo;
let zones, categories, areas, tipoMovimiento, productos, meses, anios;
let apiExistencias = 'ctrl/ctrl-existencias.php';


$(async () => {
    const data = await useFetch({ url: api, data: { opc: "init" } });
    zones          = data.zonas || [];
    categories     = data.categorias || [];
    areas          = data.areas || [];
    tipoMovimiento = data.tipoMovimiento || [];
    productos      = data.productos || [];
    meses          = data.meses || [];
    anios          = data.anios || [];

  
    existencias = new Existencias(api, "root");
    existencias.render();

});

