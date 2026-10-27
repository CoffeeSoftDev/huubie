// -- Catalogos --

const SAMPLE_CATALOGOS = {
    categorias: [
        { id: 1, valor: "PASTELES ESPECIALIDADES" },
        { id: 2, valor: "PASTELES TRADICIONALES" },
        { id: 3, valor: "GALLETAS" },
        { id: 4, valor: "PAN" },
        { id: 5, valor: "SOBRE PEDIDO" },
        { id: 6, valor: "CHAROLAS" },
        { id: 7, valor: "POSTRES" },
        { id: 8, valor: "BOCADILLOS" }
    ],
    areas: [
        { id: 1, valor: "Refrigerados", color_hex: "#60A5FA" },
        { id: 2, valor: "Secos", color_hex: "#FB923C" },
        { id: 3, valor: "Congelados", color_hex: "#22D3EE" }
    ],
    unidades: [
        { id: 1, valor: "Pieza", code: "pza" },
        { id: 2, valor: "Kilogramo", code: "kg" },
        { id: 3, valor: "Litro", code: "lt" },
        { id: 4, valor: "Caja", code: "caja" },
        { id: 5, valor: "Paquete", code: "pq" },
        { id: 6, valor: "Metro", code: "m" }
    ],
    proveedores: [
        { id: 1, valor: "Proveedor Demo S.A." }
    ],
    sucursales: [
        { id: 1, valor: "Reginas Central Gpe" },
        { id: 2, valor: "Reginas kafeto" },
        { id: 3, valor: "Regina's cuarta" }
    ]
};

// -- Productos --

const SAMPLE_PRODUCTOS = {
    row: [
        {
            id: 1,
            SKU: "RG-001",
            Producto: "Pastel Tradicional Mantequilla Manjar",
            Categoria: "PASTELES TRADICIONALES",
            Area: "Secos",
            Unidad: "pza",
            Costo: "$253.00",
            Min: 2,
            Max: 10
        },
        {
            id: 10,
            SKU: "RG-010",
            Producto: "Cupcake Decorado",
            Categoria: "POSTRES",
            Area: "Refrigerados",
            Unidad: "pza",
            Costo: "$12.10",
            Min: 12,
            Max: 60
        }
    ]
};

// -- Categorias --

const SAMPLE_CATEGORIAS = {
    row: [
        { id: 1, Categoria: "PASTELES ESPECIALIDADES", Productos: 15 },
        { id: 2, Categoria: "PASTELES TRADICIONALES", Productos: 26 },
        { id: 3, Categoria: "GALLETAS", Productos: 2 }
    ]
};

// -- Almacenes --

const SAMPLE_ALMACENES = {
    row: [
        { id: 1, Almacen: "Almacen Central Reginas", Sucursal: "Reginas Central Gpe", Area: "Secos", Default: "SI" },
        { id: 2, Almacen: "Almacen Refrigerados Kafeto", Sucursal: "Reginas kafeto", Area: "Refrigerados", Default: "SI" }
    ]
};

// -- Areas --

const SAMPLE_AREAS = {
    row: [
        { id: 1, Color: "#60A5FA", Area: "Refrigerados", Descripcion: "Lacteos, frutas frescas, productos perecederos", Productos: 45 },
        { id: 2, Color: "#FB923C", Area: "Secos", Descripcion: "Harinas, granos, conservas, pan", Productos: 38 },
        { id: 3, Color: "#22D3EE", Area: "Congelados", Descripcion: "Productos congelados", Productos: 13 }
    ]
};

// -- Unidades --

const SAMPLE_UNIDADES = {
    row: [
        { id: 1, Code: "pza", Nombre: "Pieza", Productos: 85 },
        { id: 2, Code: "kg", Nombre: "Kilogramo", Productos: 4 },
        { id: 3, Code: "lt", Nombre: "Litro", Productos: 2 }
    ]
};

// -- Proveedores --

const SAMPLE_PROVEEDORES = {
    row: []
};

// -- Origenes de entrada --

const SAMPLE_ORIGENES = {
    row: [
        { id: 1, Code: "PRODUCTION", Origen: "Produccion", Color: "#A78BFA", Proveedor: "NO" },
        { id: 2, Code: "SUPPLIER", Origen: "Proveedor", Color: "#FBBF24", Proveedor: "SI" },
        { id: 3, Code: "TRANSFER_IN", Origen: "Transferencia", Color: "#60A5FA", Proveedor: "NO" }
    ]
};

// -- Motivos de merma --

const SAMPLE_MERMAS = {
    row: [
        { id: 1, Code: "EXPIRY", Motivo: "Caducidad", Color: "#E02424" },
        { id: 2, Code: "DAMAGED", Motivo: "Daniado", Color: "#FBBF24" },
        { id: 3, Code: "THEFT", Motivo: "Robo/Faltante", Color: "#7C3AED" }
    ]
};

// -- Motivos de ajuste --

const SAMPLE_AJUSTES = {
    row: [
        { id: 1, Code: "MISSING", Motivo: "Faltante sin explicar", Color: "#F43F5E", Costo: "SI" },
        { id: 2, Code: "PHYSICAL_COUNT", Motivo: "Conteo fisico", Color: "#A78BFA", Costo: "SI" },
        { id: 3, Code: "ADMIN_CORRECTION", Motivo: "Correccion administrativa", Color: "#D1D5DB", Costo: "NO" }
    ]
};

// -- Estados de traspaso --

const SAMPLE_ESTADOS = {
    row: [
        { id: 1, Code: "REQUESTED", Estado: "Solicitado", Orden: 1, Terminal: "NO", Color: "#FBBF24" },
        { id: 2, Code: "AUTHORIZED", Estado: "Autorizado", Orden: 2, Terminal: "NO", Color: "#A78BFA" },
        { id: 4, Code: "RECEIVED", Estado: "Recibido", Orden: 4, Terminal: "SI", Color: "#3FC189" }
    ]
};
