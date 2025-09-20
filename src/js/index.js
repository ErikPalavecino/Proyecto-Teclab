const { ipcRenderer } = require('electron');

// Variables globales
let productos = [];
let ventas = [];

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Dashboard cargado');
    updateCurrentTime();
    await loadDashboardData();
    
    // Actualizar cada 30 segundos
    setInterval(updateCurrentTime, 30000);
    setInterval(loadDashboardData, 60000); // Cada minuto
});

// Actualizar hora actual
function updateCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleString('es-AR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const timeElement = document.getElementById('currentTime');
    if (timeElement) {
        timeElement.textContent = timeString;
    }
}

// Cargar datos del dashboard
async function loadDashboardData() {
    try {
        // Cargar estadísticas
        await loadStats();
        
        console.log('Datos del dashboard actualizados');
    } catch (error) {
        console.error('Error cargando datos del dashboard:', error);
        showNotification('Error cargando datos', 'error');
    }
}

// Cargar estadísticas
async function loadStats() {
    try {
        // Total de productos
        productos = await ipcRenderer.invoke('get-productos');
        document.getElementById('totalProductos').textContent = productos.length;

        // Ventas del día
        const ventasDelDia = await ipcRenderer.invoke('get-ventas-del-dia');
        const ventasAmount = ventasDelDia.total_ingresos || 0;
        document.getElementById('ventasDelDia').textContent = 
            `$${ventasAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

        // Stock bajo
        const stockBajo = await ipcRenderer.invoke('get-stock-bajo', 5);
        document.getElementById('stockBajo').textContent = stockBajo.length;

        // Producto más vendido
        const masVendido = await ipcRenderer.invoke('get-producto-mas-vendido');
        const masVendidoElement = document.getElementById('masVendido');
        if (masVendido && masVendido.nombre) {
            masVendidoElement.textContent = masVendido.nombre;
        } else {
            masVendidoElement.textContent = 'Sin ventas';
        }

        // Actualizar actividad si hay alertas de stock bajo
        updateActivity(stockBajo);

    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

// Actualizar lista de actividad
function updateActivity(stockBajo) {
    const activityList = document.getElementById('activityList');
    
    // Limpiar actividades anteriores (mantener solo el mensaje inicial)
    const initialActivity = activityList.firstElementChild;
    activityList.innerHTML = '';
    activityList.appendChild(initialActivity);

    // Agregar alertas de stock bajo
    if (stockBajo.length > 0) {
        stockBajo.slice(0, 3).forEach(producto => { // Mostrar solo los primeros 3
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            activityItem.innerHTML = `
                <div class="activity-icon">⚠️</div>
                <div class="activity-text">
                    <p>Stock bajo: ${producto.nombre}</p>
                    <small>Quedan ${producto.stock} unidades</small>
                </div>
            `;
            activityList.appendChild(activityItem);
        });
    }

    // Si hay más productos con stock bajo, mostrar resumen
    if (stockBajo.length > 3) {
        const moreItems = document.createElement('div');
        moreItems.className = 'activity-item';
        moreItems.innerHTML = `
            <div class="activity-icon">📋</div>
            <div class="activity-text">
                <p>Y ${stockBajo.length - 3} productos más con stock bajo</p>
                <small>Ver sección de Stock para más detalles</small>
            </div>
        `;
        activityList.appendChild(moreItems);
    }
}

// Navegación entre pantallas
function navigateTo(page) {
    const pages = {
        'productos': './productos.html',
        'ventas': './ventas.html',
        'stock': './stock.html',
        'reportes': './reportes.html'
    };

    if (pages[page]) {
        window.location.href = pages[page];
    } else {
        console.error('Página no encontrada:', page);
    }
}

// Mostrar notificaciones
function showNotification(message, type = 'info') {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `alert alert-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        animation: slideIn 0.3s ease;
    `;

    // Icono según el tipo
    const icons = {
        'success': '✅',
        'error': '❌',
        'warning': '⚠️',
        'info': 'ℹ️'
    };

    notification.innerHTML = `
        <span>${icons[type] || icons.info}</span>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" style="
            background: none;
            border: none;
            font-size: 1.2rem;
            cursor: pointer;
            margin-left: auto;
            padding: 0 5px;
        ">×</button>
    `;

    document.body.appendChild(notification);

    // Auto-remover después de 5 segundos
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Agregar estilos para las animaciones de notificación
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Función para formatear moneda
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS'
    }).format(amount);
}

// Función para formatear fecha
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

// Manejo de errores global
window.addEventListener('error', (event) => {
    console.error('Error global:', event.error);
    showNotification('Ha ocurrido un error inesperado', 'error');
});

// Manejo de errores de promesas
window.addEventListener('unhandledrejection', (event) => {
    console.error('Error de promesa no manejada:', event.reason);
    showNotification('Error de conexión con la base de datos', 'error');
    event.preventDefault();
});