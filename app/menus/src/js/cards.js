class Cards {
    constructor(contenedor, tarjetas) {
        this.contenedor = $(contenedor);
        this.tarjetas  = tarjetas;
    }

    render() {
        this.contenedor.empty();

        this.tarjetas.forEach((item) => {
            const card = `
                <div
                    class="
                        w-full
                        h-[180px]
                        ${item.bg || 'bg-[#333D4C] hover:bg-[#3f4b5c]'}
                        rounded-2xl
                        shadow-md
                        p-4
                        flex
                        flex-col
                        cursor-pointer
                        transition
                        duration-300
                        hover:scale-[1.02]
                    "
                    onclick="window.location.href='${item.enlace}'"
                >

                    <!-- 🔹 Icono -->
                    <div class="flex justify-between items-start">
                        ${item.imagen
                            ? `<img
                                class="
                                    w-12 h-12
                                    ${item.padding}
                                    bg-[#233876]
                                    rounded-xl
                                    p-1
                                "
                                src="${item.imagen}"
                                alt="${item.titulo}"
                            >`
                            : `<div class="w-12 h-12 bg-[#233876] rounded-xl"></div>`
                        }
                    </div>

                    <!-- 🔹 Contenido -->
                    <div class="mt-auto flex flex-col gap-1">
                        <h2 class="text-base md:text-lg font-semibold text-white font-[Poppins] leading-tight">
                            ${item.titulo}
                        </h2>

                        ${
                            item.descripcion
                            ? `<p class="text-xs md:text-sm text-gray-400 font-[Poppins] leading-snug line-clamp-2 min-h-[2.5rem]">
                                ${item.descripcion}
                               </p>`
                            : `<p class="min-h-[2.5rem]"></p>`
                        }
                    </div>

                </div>
            `;
            this.contenedor.append(card);
        });
    }
}