class Cards {
    constructor(contenedor, tarjetas) {
      this.contenedor = $(contenedor);
      this.tarjetas = tarjetas;
    }
  
    render() {
      this.contenedor.empty(); // Limpiar el contenedor antes de agregar tarjetas
  
      this.tarjetas.forEach((item) => {
        const card = `
                <div class="w-[300px] h-[200px] bg-[#333D4C] rounded-lg shadow-lg overflow-hidden p-4 flex flex-col justify-between cursor-pointer"
                    onclick="window.location.href='${item.enlace}'">
                    <img class="w-14 h-14 ${item.padding} bg-[#233876] rounded-lg" src="${item.imagen}" alt="${item.titulo}">
                    <div class="flex-grow flex flex-col justify-center">
                        <h2 class="text-lg font-semibold text-white font-[Poppins]">${item.titulo}</h2>
                        ${item.descripcion ? `<p class="text-gray-400 font-[Poppins]">${item.descripcion}</p>` : ""}
                    </div>
                </div>
            `;
        this.contenedor.append(card);
      });
    }
  }