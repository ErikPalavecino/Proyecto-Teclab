const { ipcRenderer } = require('electron');

let ventasData = [];
let productosData = [];

document.addEventListener('DOMContentLoaded', () => {
    setDefaultDates();
    loadReports();
});

function setDefaultDates() {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    document.getElementById('startDate').value = yesterday.toISOString().split('T')[0];
    document.getElementById('endDate').value = today.toISOString().split('T')[0];
}

async function loadReports() {
    try {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        if (!startDate || !endDate) {
            showNotification('Por favor selecciona un rango de fechas', 'warning');
            return;
        }

        await Promise.all([
            loadVentasDia(startDate, endDate),
            loadStockBajo(),
            loadProductoMasVendido(startDate, endDate),
            loadResumenIngresos(startDate, endDate)
        ]);
    } catch (error) {
        console.error('Error cargando reportes:', error);
        showNotification('Error cargando reportes', 'error');
    }
}

async function loadVentasDia(startDate, endDate) {
    try {
        const ventas = await ipcRenderer.invoke('get-ventas');
        
        ventasData = ventas.filter(venta => {
            const ventaDate = new Date(venta.fecha).toISOString().split('T')[0];
            return ventaDate >= startDate && ventaDate <= endDate;
        });

        const totalVentas = ventasData.reduce((sum, v) => sum + v.total, 0);
        const cantidadVentas = ventasData.length;

        document.getElementById('totalVentas').textContent = `$${totalVentas.toFixed(2)}`;
        document.getElementById('totalTransacciones').textContent = cantidadVentas;

        const ventasList = document.getElementById('ventasList');
        if (ventasData.length === 0) {
            ventasList.innerHTML = `
                <div class="list-empty">
                    <p>📭 No hay ventas en este período</p>
                </div>
            `;
            return;
        }

        ventasList.innerHTML = ventasData.map(venta => `
            <div class="list-item">
                <div>
                    <div class="item-name">Cliente: ${venta.cliente || 'General'}</div>
                    <div class="item-detail">
                        ${formatDate(venta.fecha)} | ${venta.metodo_pago || 'efectivo'}
                    </div>
                </div>
                <div class="item-value">$${venta.total.toFixed(2)}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error cargando ventas:', error);
        document.getElementById('ventasList').innerHTML = `
            <div class="list-empty">
                <p>❌ Error cargando datos</p>
            </div>
        `;
    }
}

async function loadStockBajo() {
    try {
        const stockBajo = await ipcRenderer.invoke('get-stock-bajo', 100);
        productosData = await ipcRenderer.invoke('get-productos');

        const stockBajoList = document.getElementById('stockBajoList');
        if (stockBajo.length === 0) {
            stockBajoList.innerHTML = `
                <div class="list-empty">
                    <p>✅ Todos los productos tienen stock suficiente</p>
                </div>
            `;
            return;
        }

        stockBajoList.innerHTML = stockBajo.map(producto => {
            let badge = '';
            if (producto.stock === 0) {
                badge = '<span class="badge-stock badge-red">Sin Stock</span>';
            } else if (producto.stock <= 5) {
                badge = '<span class="badge-stock badge-red">Crítico</span>';
            } else if (producto.stock <= 20) {
                badge = '<span class="badge-stock badge-yellow">Bajo</span>';
            }

            return `
                <div class="list-item">
                    <div>
                        <div class="item-name">${producto.nombre}</div>
                        <div class="item-detail">${producto.categoria || 'Sin categoría'}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        ${badge}
                        <span class="item-value">${producto.stock} ud.</span>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error cargando stock bajo:', error);
        document.getElementById('stockBajoList').innerHTML = `
            <div class="list-empty">
                <p>❌ Error cargando datos</p>
            </div>
        `;
    }
}

async function loadProductoMasVendido(startDate, endDate) {
    try {
        const ventas = await ipcRenderer.invoke('get-ventas');
        
        const ventasEnRango = ventas.filter(venta => {
            const ventaDate = new Date(venta.fecha).toISOString().split('T')[0];
            return ventaDate >= startDate && ventaDate <= endDate;
        });

        const masVendidoContainer = document.getElementById('masVendidoContainer');
        
        if (ventasEnRango.length === 0) {
            masVendidoContainer.innerHTML = `
                <div class="list-empty">
                    <p>📭 No hay ventas en este período</p>
                </div>
            `;
            return;
        }

        const masVendido = await ipcRenderer.invoke('get-producto-mas-vendido');
        
        if (!masVendido) {
            masVendidoContainer.innerHTML = `
                <div class="list-empty">
                    <p>📭 Sin datos disponibles</p>
                </div>
            `;
            return;
        }

        masVendidoContainer.innerHTML = `
            <div style="background: rgba(255, 255, 255, 0.95); border-radius: var(--border-radius); padding: var(--spacing-lg);">
                <div style="text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 10px;">⭐</div>
                    <div class="item-name" style="font-size: 1.25rem; margin-bottom: 10px;">
                        ${masVendido.nombre}
                    </div>
                    <div class="stat-value" style="font-size: 2.5rem; margin: 20px 0;">
                        ${masVendido.total_vendido} unidades
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error cargando producto más vendido:', error);
        document.getElementById('masVendidoContainer').innerHTML = `
            <div class="list-empty">
                <p>❌ Error cargando datos</p>
            </div>
        `;
    }
}

async function loadResumenIngresos(startDate, endDate) {
    try {
        const ventas = await ipcRenderer.invoke('get-ventas');
        
        const ventasEnRango = ventas.filter(venta => {
            const ventaDate = new Date(venta.fecha).toISOString().split('T')[0];
            return ventaDate >= startDate && ventaDate <= endDate;
        });

        const ingresoTotal = ventasEnRango.reduce((sum, v) => sum + v.total, 0);
        const ingresoPromedio = ventasEnRango.length > 0 ? ingresoTotal / ventasEnRango.length : 0;

        document.getElementById('ingresoTotal').textContent = `$${ingresoTotal.toFixed(2)}`;
        document.getElementById('ingresoPromedio').textContent = `$${ingresoPromedio.toFixed(2)}`;

        const resumenIngresos = document.getElementById('resumenIngresos');
        
        if (ventasEnRango.length === 0) {
            resumenIngresos.innerHTML = `
                <div class="list-empty">
                    <p>📭 No hay datos en este período</p>
                </div>
            `;
            return;
        }

        const resumenPorMetodo = {};
        ventasEnRango.forEach(venta => {
            const metodo = venta.metodo_pago || 'efectivo';
            if (!resumenPorMetodo[metodo]) {
                resumenPorMetodo[metodo] = { total: 0, cantidad: 0 };
            }
            resumenPorMetodo[metodo].total += venta.total;
            resumenPorMetodo[metodo].cantidad += 1;
        });

        resumenIngresos.innerHTML = Object.entries(resumenPorMetodo).map(([metodo, datos]) => `
            <div class="list-item">
                <div>
                    <div class="item-name">${formatMetodoPago(metodo)}</div>
                    <div class="item-detail">${datos.cantidad} transacción(es)</div>
                </div>
                <div class="item-value">$${datos.total.toFixed(2)}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error cargando resumen ingresos:', error);
        document.getElementById('resumenIngresos').innerHTML = `
            <div class="list-empty">
                <p>❌ Error cargando datos</p>
            </div>
        `;
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatMetodoPago(metodo) {
    const metodos = {
        'efectivo': '💵 Efectivo',
        'tarjeta_debito': '💳 Tarjeta de Débito',
        'tarjeta_credito': '💳 Tarjeta de Crédito',
        'transferencia': '🏦 Transferencia',
        'mercado_pago': '📱 Mercado Pago',
        'otro': '📋 Otro'
    };
    return metodos[metodo] || metodo;
}

async function exportCSV() {
    try {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        // Usar punto y coma como delimitador (estándar en Excel para países hispanohablantes)
        const delimitador = ';';
        
        let csv = '';
        
        // SECCIÓN 1: RESUMEN GENERAL
        csv += 'REPORTE DE VENTAS Y STOCK' + '\n';
        csv += `Período${delimitador}${startDate} a ${endDate}` + '\n';
        csv += `Fecha de Generación${delimitador}${new Date().toLocaleString('es-AR')}` + '\n';
        csv += '\n';

        // SECCIÓN 2: VENTAS
        csv += 'VENTAS DEL PERÍODO' + '\n';
        csv += `Fecha${delimitador}Cliente${delimitador}Total${delimitador}Método de Pago` + '\n';
        
        ventasData.forEach(venta => {
            const cliente = (venta.cliente || 'General').replace(/"/g, '""');
            const metodo = formatMetodoPago(venta.metodo_pago).replace(/"/g, '""');
            csv += `"${venta.fecha}"${delimitador}"${cliente}"${delimitador}${venta.total.toFixed(2)}${delimitador}"${metodo}"` + '\n';
        });

        csv += '\n';

        // SECCIÓN 3: PRODUCTOS CON STOCK BAJO
        csv += 'PRODUCTOS CON STOCK BAJO' + '\n';
        csv += `Producto${delimitador}Categoría${delimitador}Stock${delimitador}Precio` + '\n';
        
        const stockBajo = await ipcRenderer.invoke('get-stock-bajo', 100);
        stockBajo.forEach(producto => {
            const nombre = (producto.nombre || '').replace(/"/g, '""');
            const categoria = (producto.categoria || 'N/A').replace(/"/g, '""');
            csv += `"${nombre}"${delimitador}"${categoria}"${delimitador}${producto.stock}${delimitador}${producto.precio.toFixed(2)}` + '\n';
        });

        csv += '\n';

        // SECCIÓN 4: RESUMEN DE INGRESOS
        csv += 'RESUMEN DE INGRESOS' + '\n';
        csv += `Método de Pago${delimitador}Total${delimitador}Cantidad de Transacciones` + '\n';
        
        const resumenPorMetodo = {};
        ventasData.forEach(venta => {
            const metodo = venta.metodo_pago || 'efectivo';
            if (!resumenPorMetodo[metodo]) {
                resumenPorMetodo[metodo] = { total: 0, cantidad: 0 };
            }
            resumenPorMetodo[metodo].total += venta.total;
            resumenPorMetodo[metodo].cantidad += 1;
        });

        Object.entries(resumenPorMetodo).forEach(([metodo, datos]) => {
            const metodoFormato = formatMetodoPago(metodo).replace(/"/g, '""');
            csv += `"${metodoFormato}"${delimitador}${datos.total.toFixed(2)}${delimitador}${datos.cantidad}` + '\n';
        });

        csv += '\n';

        // SECCIÓN 5: TOTALES
        const totalVentas = ventasData.reduce((sum, v) => sum + v.total, 0);
        csv += 'TOTALES' + '\n';
        csv += `Total de Ingresos${delimitador}${totalVentas.toFixed(2)}` + '\n';
        csv += `Total de Transacciones${delimitador}${ventasData.length}` + '\n';
        csv += `Ingreso Promedio${delimitador}${ventasData.length > 0 ? (totalVentas / ventasData.length).toFixed(2) : '0.00'}` + '\n';

        // Agregar BOM (Byte Order Mark) para UTF-8
        const BOM = '\uFEFF';
        const csvConBOM = BOM + csv;
        
        downloadFile(csvConBOM, 'reporte_' + new Date().getTime() + '.csv', 'text/csv;charset=utf-8');
        showNotification('Reporte CSV exportado exitosamente', 'success');
    } catch (error) {
        console.error('Error exportando CSV:', error);
        showNotification('Error exportando CSV', 'error');
    }
}

async function exportPDF() {
    try {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const stockBajo = await ipcRenderer.invoke('get-stock-bajo', 100);

        let html = `
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Reporte de Ventas y Stock</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
                    h2 { color: #667eea; margin-top: 20px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
                    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                    th { background-color: #667eea; color: white; padding: 10px; text-align: left; }
                    td { padding: 8px; border-bottom: 1px solid #ddd; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                    .summary { background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin: 15px 0; }
                    .summary-item { display: inline-block; margin-right: 30px; }
                    .summary-label { font-weight: bold; color: #667eea; }
                    .summary-value { font-size: 1.2em; font-weight: bold; }
                    .fecha { text-align: center; color: #666; font-size: 0.9em; margin: 10px 0; }
                </style>
            </head>
            <body>
                <h1>📊 REPORTE DE VENTAS Y STOCK</h1>
                <div class="fecha">Período: ${startDate} a ${endDate}</div>
                <div class="fecha">Generado: ${new Date().toLocaleString('es-AR')}</div>

                <h2>💰 Resumen de Ventas</h2>
                <div class="summary">
                    <div class="summary-item">
                        <div class="summary-label">Total de Ingresos:</div>
                        <div class="summary-value">$${ventasData.reduce((sum, v) => sum + v.total, 0).toFixed(2)}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">Cantidad de Ventas:</div>
                        <div class="summary-value">${ventasData.length}</div>
                    </div>
                </div>

                <h2>📋 Detalle de Ventas</h2>
                <table>
                    <tr>
                        <th>Fecha</th>
                        <th>Cliente</th>
                        <th>Total</th>
                        <th>Método de Pago</th>
                    </tr>
                    ${ventasData.map(venta => `
                        <tr>
                            <td>${formatDate(venta.fecha)}</td>
                            <td>${venta.cliente || 'General'}</td>
                            <td>$${venta.total.toFixed(2)}</td>
                            <td>${formatMetodoPago(venta.metodo_pago)}</td>
                        </tr>
                    `).join('')}
                </table>

                <h2>📦 Productos con Stock Bajo</h2>
                <table>
                    <tr>
                        <th>Producto</th>
                        <th>Categoría</th>
                        <th>Stock</th>
                        <th>Precio</th>
                    </tr>
                    ${stockBajo.map(producto => `
                        <tr>
                            <td>${producto.nombre}</td>
                            <td>${producto.categoria || 'N/A'}</td>
                            <td>${producto.stock}</td>
                            <td>$${producto.precio.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </table>
            </body>
            </html>
        `;

        const printWindow = window.open('', '', 'height=800,width=900');
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
        printWindow.close();

        showNotification('Reporte PDF abierto para impresión', 'success');
    } catch (error) {
        console.error('Error exportando PDF:', error);
        showNotification('Error exportando PDF', 'error');
    }
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type: type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

function navigateTo(page) {
    const pages = {
        'index': './index.html',
        'productos': './productos.html',
        'ventas': './ventas.html',
        'stock': './stock.html'
    };

    if (pages[page]) {
        window.location.href = pages[page];
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icons = {
        'success': '✅',
        'error': '❌',
        'warning': '⚠️',
        'info': 'ℹ️'
    };

    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${icons[type] || icons.info}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.add('notification-fade-out');
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

window.addEventListener('error', (event) => {
    console.error('Error global:', event.error);
    showNotification('Ha ocurrido un error inesperado', 'error');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Error de promesa no manejada:', event.reason);
    showNotification('Error de conexión con la base de datos', 'error');
    event.preventDefault();
});