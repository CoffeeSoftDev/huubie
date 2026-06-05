let apiExistencias = 'ctrl/ctrl-existencias.php';
let existencias;
let zones, categories, areas;

$(async () => {
    const data = await useFetch({ url: apiExistencias, data: { opc: "init" } });
    zones      = data.zonas || [];
    categories = data.categorias || [];
    areas      = data.areas || [];

    existencias = new Existencias(apiExistencias, "root");
    existencias.render();
});
