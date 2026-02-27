$(document).ready(function() {
    renderDashboard();
    loadDashboardData();
});

function renderDashboard() {
    const dashboardHTML = `
        <div class="container-fluid">
            <div class="row mb-4">
                <div class="col-12">
                    <h2 class="mb-4">Dashboard de Almacén</h2>
                </div>
            </div>
            
            <div class="row g-3 mb-4">
                <div class="col-md-3">
                    <div class="card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="text-muted mb-2">Total Productos</h6>
                                    <h3 class="mb-0" id="totalProductos">0</h3>
                                </div>
                                <div class="text-primary">
                                    <i class="icon-box" style="font-size: 2rem;"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-3">
                    <div class="card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="text-muted mb-2">Stock Total</h6>
                                    <h3 class="mb-0" id="stockTotal">0</h3>
                                </div>
                                <div class="text-success">
                                    <i class="icon-chart-bar" style="font-size: 2rem;"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-3">
                    <div class="card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="text-muted mb-2">Productos Bajos</h6>
                                    <h3 class="mb-0 text-warning" id="productosBajos">0</h3>
                                </div>
                                <div class="text-warning">
                                    <i class="icon-attention" style="font-size: 2rem;"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-3">
                    <div class="card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="text-muted mb-2">Valor Inventario</h6>
                                    <h3 class="mb-0" id="valorInventario">$0</h3>
                                </div>
                                <div class="text-info">
                                    <i class="icon-dollar" style="font-size: 2rem;"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="row g-3">
                <div class="col-md-8">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0">Movimientos Recientes</h5>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table class="table table-hover" id="tableMovimientos">
                                    <thead>
                                        <tr>
                                            <th>Fecha</th>
                                            <th>Producto</th>
                                            <th>Tipo</th>
                                            <th>Cantidad</th>
                                        </tr>
                                    </thead>
                                    <tbody></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0">Productos con Stock Bajo</h5>
                        </div>
                        <div class="card-body">
                            <div id="productosStockBajo"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    $('#root').html(dashboardHTML);
}

function loadDashboardData() {
    $.ajax({
        url: 'ctrl/ctrl-dashboard.php',
        type: 'POST',
        data: { opc: 'getDashboardData' },
        dataType: 'json',
        success: function(response) {
            if (response.success) {
                updateDashboardStats(response.data);
                loadMovimientos(response.data.movimientos);
                loadProductosBajos(response.data.productosBajos);
            }
        },
        error: function() {
            console.error('Error al cargar datos del dashboard');
        }
    });
}

function updateDashboardStats(data) {
    $('#totalProductos').text(data.totalProductos || 0);
    $('#stockTotal').text(data.stockTotal || 0);
    $('#productosBajos').text(data.productosBajos || 0);
    $('#valorInventario').text('$' + (data.valorInventario || 0).toLocaleString());
}

function loadMovimientos(movimientos) {
    const tbody = $('#tableMovimientos tbody');
    tbody.empty();
    
    if (movimientos && movimientos.length > 0) {
        movimientos.forEach(mov => {
            const tipoClass = mov.tipo === 'Entrada' ? 'text-success' : 'text-danger';
            const row = `
                <tr>
                    <td>${mov.fecha}</td>
                    <td>${mov.producto}</td>
                    <td><span class="${tipoClass}">${mov.tipo}</span></td>
                    <td>${mov.cantidad}</td>
                </tr>
            `;
            tbody.append(row);
        });
    } else {
        tbody.html('<tr><td colspan="4" class="text-center">No hay movimientos recientes</td></tr>');
    }
}

function loadProductosBajos(productos) {
    const container = $('#productosStockBajo');
    container.empty();
    
    if (productos && productos.length > 0) {
        productos.forEach(prod => {
            const item = `
                <div class="d-flex justify-content-between align-items-center mb-3 p-2 border rounded">
                    <div>
                        <strong>${prod.nombre}</strong>
                        <br>
                        <small class="text-muted">Stock: ${prod.stock}</small>
                    </div>
                    <span class="badge bg-warning">${prod.stock}</span>
                </div>
            `;
            container.append(item);
        });
    } else {
        container.html('<p class="text-center text-muted">No hay productos con stock bajo</p>');
    }
}
