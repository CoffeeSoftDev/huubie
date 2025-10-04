// Definir los datos de las tarjetas
const tarjetas = [
    {
      titulo: "Ventas",
      descripcion: "Lleva el control de todas tus ventas",
      imagen: "/dev/src/img/ventas.svg",
      enlace: "/dev/ventas/",
      padding:"p-2"
    },
    {
      titulo: "Configuración",
      descripcion: "Optimiza el sistema",
      imagen: "/dev/src/img/configuracion.svg",
      enlace: "/dev/configuracion/",
      padding:"p-2"
    },
  ];
  
  // Instanciar la clase y generar las tarjetas
  $(() => {
    const card = new Cards("#grid-card", tarjetas);
    card.render();
  });
  