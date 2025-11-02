const { ipcRenderer } = require('electron');

// Variables globales
let productos = [];
let productosOriginal = [];

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Página de productos cargada');
    await loadProductos();
    setupEventListeners();
});

function setupEventListeners() {
    // Formulario de agregar
    const addForm = document.getElementById('addProductForm');
    if (addForm) {
        addForm.addEventListener('submit', handleAddProduct);
    }

    // Formulario de editar
    const editForm = document.getElementById('editProductForm');
    if (editForm) {
        editForm.addEventListener('submit', handleEditProduct);
    }

    // Cerrar modal con ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeEditModal();
        }
    });

    // Cerrar modal haciendo clic fuera
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeEditModal();
            }
        });
    }
}

// Cargar productos
async function loadProductos() {
    try {
        showLoadingInTable(true);
        productos = await ipcRenderer.invoke('get-productos');
        productosOriginal = [...productos];
        displayProductos(productos);
        
        if (productos.length === 0) {
            showNoProductsMessage();
        } else {
            hideNoProductsMessage();
        }
        
        console.log(`${productos.length} productos cargados`);
    } catch (error) {
        console.error('Error cargando productos:', error);
        showNotification('Error cargando productos', 'error');
        showLoadingInTable(false);
    }
}

// Mostrar productos en tabla
function displayProductos(productosArray) {
    const tableBody = document.getElementById('productsTableBody');
    
    if (!productosArray || productosArray.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 20px; color: #666;">
                    No hay productos para mostrar
                </td>
            </tr>
        `;
        return;
    }

    const rows = productosArray.map(producto => {
        const stockStatus = getStockStatus(producto.stock);
        const stockBadge = getStockBadge(stockStatus);
        
        return `
            <tr>
                <td>#${producto.id}</td>
                <td>
                    <strong>${producto.nombre}</strong>
                    ${producto.descripcion ? `<br><small style="color: #666;">${producto.descripcion}</small>` : ''}
                </td>
                <td>
                    <span class="category-badge">${producto.categoria || 'Sin categoría'}</span>
                </td>
                <td style="font-weight: bold;">$${producto.precio.toFixed(2)}</td>
                <td style="text-align: center;">${producto.stock}</td>
                <td style="text-align: center;">${stockBadge}</td>
                <td style="text-align: center;">
                    <div class="action-buttons">
                        <button class="btn-action btn-edit" onclick="editProduct(${producto.id})" 
                                title="Editar producto">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                            </svg>
                            <span class="btn-label">Editar</span>
                        </button>
                        
                        <button class="btn-action btn-stock" onclick="adjustStock(${producto.id}, '${producto.nombre.replace(/'/g, "\\'")}', ${producto.stock})" 
                                title="Ajustar stock">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                            </svg>
                            <span class="btn-label">Stock</span>
                        </button>
                        
                        <button class="btn-action btn-delete" onclick="deleteProduct(${producto.id}, '${producto.nombre.replace(/'/g, "\\'")}');" 
                                title="Eliminar producto">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                            </svg>
                            <span class="btn-label">Eliminar</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    tableBody.innerHTML = rows;
    showLoadingInTable(false);
}

function getStockStatus(stock) {
    if (stock === 0) return 'sin-stock';
    if (stock <= 5) return 'stock-bajo';
    if (stock <= 20) return 'stock-medio';
    return 'stock-alto';
}

function getStockBadge(status) {
    const badges = {
        'sin-stock': '<span class="stock-badge stock-none">Sin Stock</span>',
        'stock-bajo': '<span class="stock-badge stock-low">Stock Bajo</span>',
        'stock-medio': '<span class="stock-badge stock-medium">Stock Medio</span>',
        'stock-alto': '<span class="stock-badge stock-high">Stock OK</span>'
    };
    
    return badges[status] || badges['stock-alto'];
}

// Mostrar/ocultar formulario de nuevo producto
function showProductForm() {
    const form = document.getElementById('productForm');
    const addForm = document.getElementById('addProductForm');
    
    form.style.display = 'block';
    addForm.reset();
    
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    setTimeout(() => {
        document.getElementById('nombre').focus();
    }, 100);
}

function hideProductForm() {
    const form = document.getElementById('productForm');
    const addForm = document.getElementById('addProductForm');
    
    form.style.display = 'none';
    addForm.reset();
}

// Agregar producto
async function handleAddProduct(event) {
    event.preventDefault();
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const loading = submitBtn.querySelector('.btn-loading');
    const text = submitBtn.querySelector('.btn-text');
    
    try {
        loading.style.display = 'inline-flex';
        text.style.display = 'none';
        submitBtn.disabled = true;

        const formData = new FormData(event.target);
        const producto = {
            nombre: formData.get('nombre').trim(),
            descripcion: formData.get('descripcion').trim(),
            precio: parseFloat(formData.get('precio')),
            stock: parseInt(formData.get('stock')) || 0,
            categoria: formData.get('categoria'),
            codigo_barras: formData.get('codigo_barras').trim() || null
        };

        if (!producto.nombre) {
            throw new Error('El nombre del producto es requerido');
        }
        
        if (producto.precio <= 0) {
            throw new Error('El precio debe ser mayor a 0');
        }

        if (producto.codigo_barras) {
            const existeCodigoBarras = productos.some(p => 
                p.codigo_barras === producto.codigo_barras
            );
            if (existeCodigoBarras) {
                throw new Error('Ya existe un producto con ese código de barras');
            }
        }

        const result = await ipcRenderer.invoke('add-producto', producto);
        
        if (result) {
            showNotification(`Producto "${producto.nombre}" agregado exitosamente`, 'success');
            hideProductForm();
            await loadProductos();
        }

    } catch (error) {
        console.error('Error agregando producto:', error);
        showNotification(error.message, 'error');
    } finally {
        loading.style.display = 'none';
        text.style.display = 'inline';
        submitBtn.disabled = false;
    }
}

// Editar producto
function editProduct(id) {
    const producto = productos.find(p => p.id === id);
    if (!producto) {
        showNotification('Producto no encontrado', 'error');
        return;
    }

    console.log('Editando producto:', producto);

    // Llenar formulario
    document.getElementById('editId').value = producto.id;
    document.getElementById('editNombre').value = producto.nombre;
    document.getElementById('editDescripcion').value = producto.descripcion || '';
    document.getElementById('editPrecio').value = producto.precio;
    document.getElementById('editStock').value = producto.stock;
    document.getElementById('editCategoria').value = producto.categoria || '';
    document.getElementById('editCodigoBarras').value = producto.codigo_barras || '';

    // Mostrar modal
    const modal = document.getElementById('editModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
    
    setTimeout(() => {
        document.getElementById('editNombre').focus();
    }, 100);
}

// Manejar edición de producto
async function handleEditProduct(event) {
    event.preventDefault();
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const loading = submitBtn.querySelector('.btn-loading');
    const text = submitBtn.querySelector('.btn-text');
    
    try {
        loading.style.display = 'inline-flex';
        text.style.display = 'none';
        submitBtn.disabled = true;

        const formData = new FormData(event.target);
        const id = parseInt(document.getElementById('editId').value);
        
        const producto = {
            nombre: formData.get('nombre').trim(),
            descripcion: formData.get('descripcion').trim(),
            precio: parseFloat(formData.get('precio')),
            stock: parseInt(formData.get('stock')) || 0,
            categoria: formData.get('categoria'),
            codigo_barras: formData.get('codigo_barras').trim() || null
        };

        console.log('Actualizando producto ID:', id, producto);

        if (!producto.nombre) {
            throw new Error('El nombre del producto es requerido');
        }
        
        if (producto.precio <= 0) {
            throw new Error('El precio debe ser mayor a 0');
        }

        if (producto.codigo_barras) {
            const existeCodigoBarras = productos.some(p => 
                p.codigo_barras === producto.codigo_barras && p.id !== id
            );
            if (existeCodigoBarras) {
                throw new Error('Ya existe un producto con ese código de barras');
            }
        }

        const result = await ipcRenderer.invoke('update-producto', id, producto);
        
        console.log('Resultado actualización:', result);
        
        if (result && result.changes > 0) {
            showNotification(`Producto "${producto.nombre}" actualizado exitosamente`, 'success');
            closeEditModal();
            await loadProductos();
        } else {
            showNotification('No se pudo actualizar el producto', 'warning');
        }

    } catch (error) {
        console.error('Error actualizando producto:', error);
        showNotification(error.message, 'error');
    } finally {
        loading.style.display = 'none';
        text.style.display = 'inline';
        submitBtn.disabled = false;
    }
}

// Cerrar modal de edición
function closeEditModal() {
    const modal = document.getElementById('editModal');
    modal.style.display = 'none';
    modal.classList.remove('show');
    document.getElementById('editProductForm').reset();
}

// Ajustar stock
function adjustStock(id, nombre, currentStock) {
    const cantidad = prompt(
        `📦 Ajustar stock para: "${nombre}"\n` +
        `📊 Stock actual: ${currentStock} unidades\n\n` +
        `➕ Para AGREGAR stock: ingresa número positivo (ej: 10)\n` +
        `➖ Para QUITAR stock: ingresa número negativo (ej: -5)\n\n` +
        `Ingresa la cantidad:`
    );
    
    if (cantidad === null) return;
    
    const ajuste = parseInt(cantidad);
    if (isNaN(ajuste)) {
        showNotification('Cantidad inválida. Debe ser un número', 'error');
        return;
    }

    if (ajuste === 0) {
        showNotification('No se realizó ningún cambio', 'warning');
        return;
    }

    if (currentStock + ajuste < 0) {
        showNotification(`No se puede reducir el stock por debajo de 0. Stock actual: ${currentStock}`, 'error');
        return;
    }

    adjustStockConfirmed(id, ajuste, nombre);
}

async function adjustStockConfirmed(id, ajuste, nombre) {
    try {
        const result = await ipcRenderer.invoke('update-stock', id, ajuste);
        
        if (result && result.changes > 0) {
            const accion = ajuste > 0 ? 'agregaron' : 'redujeron';
            const cantidad = Math.abs(ajuste);
            showNotification(`Se ${accion} ${cantidad} unidades al stock de "${nombre}"`, 'success');
            await loadProductos();
        } else {
            showNotification('No se pudo actualizar el stock', 'error');
        }
    } catch (error) {
        console.error('Error ajustando stock:', error);
        showNotification('Error ajustando stock', 'error');
    }
}

// Eliminar producto
function deleteProduct(id, nombre) {
    const confirmDelete = confirm(
        `⚠️ ELIMINAR PRODUCTO\n\n` +
        `¿Está seguro que desea eliminar el producto?\n\n` +
        `📦 "${nombre}"\n\n` +
        `⚠️ Esta acción NO se puede deshacer`
    );
    
    if (confirmDelete) {
        deleteProductConfirmed(id, nombre);
    }
}

async function deleteProductConfirmed(id, nombre) {
    try {
        const result = await ipcRenderer.invoke('delete-producto', id);
        
        if (result && result.changes > 0) {
            showNotification(`Producto "${nombre}" eliminado exitosamente`, 'success');
            await loadProductos();
        } else {
            showNotification('No se pudo eliminar el producto', 'error');
        }
    } catch (error) {
        console.error('Error eliminando producto:', error);
        showNotification('Error eliminando producto', 'error');
    }
}

// Filtrar productos
function filterProducts() {
    const searchTerm = document.getElementById('searchProduct').value.toLowerCase();
    const categoryFilter = document.getElementById('filterCategory').value;

    let productosFiltrados = productosOriginal.filter(producto => {
        const matchesSearch = !searchTerm || 
            producto.nombre.toLowerCase().includes(searchTerm) ||
            (producto.descripcion && producto.descripcion.toLowerCase().includes(searchTerm)) ||
            (producto.codigo_barras && producto.codigo_barras.toLowerCase().includes(searchTerm));

        const matchesCategory = !categoryFilter || producto.categoria === categoryFilter;

        return matchesSearch && matchesCategory;
    });

    displayProductos(productosFiltrados);
    
    if (productosFiltrados.length === 0 && productosOriginal.length > 0) {
        const tableBody = document.getElementById('productsTableBody');
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 20px; color: #666;">
                    🔍 No se encontraron productos que coincidan con los filtros
                </td>
            </tr>
        `;
    }
}

function clearFilters() {
    document.getElementById('searchProduct').value = '';
    document.getElementById('filterCategory').value = '';
    displayProductos(productosOriginal);
    showNotification('Filtros limpiados', 'info');
}

function navigateTo(page) {
    const pages = {
        'index': '../views/index.html',
        'ventas': '../views/ventas.html',
        'stock': '../views/stock.html',
        'reportes': '../views/reportes.html'
    };

    if (pages[page]) {
        window.location.href = pages[page];
    }
}

// Utilidades
function showLoadingInTable(show) {
    const tableBody = document.getElementById('productsTableBody');
    
    if (show) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px;">
                    <div class="loading"></div>
                    <p style="margin-top: 10px;">Cargando productos...</p>
                </td>
            </tr>
        `;
    }
}

function showNoProductsMessage() {
    const tableContainer = document.querySelector('.table-container');
    const noProductsDiv = document.getElementById('noProducts');
    
    if (tableContainer) tableContainer.style.display = 'none';
    if (noProductsDiv) noProductsDiv.style.display = 'block';
}

function hideNoProductsMessage() {
    const tableContainer = document.querySelector('.table-container');
    const noProductsDiv = document.getElementById('noProducts');
    
    if (tableContainer) tableContainer.style.display = 'block';
    if (noProductsDiv) noProductsDiv.style.display = 'none';
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

// Manejo de errores global
window.addEventListener('error', (event) => {
    console.error('Error global:', event.error);
    showNotification('Ha ocurrido un error inesperado', 'error');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Error de promesa no manejada:', event.reason);
    showNotification('Error de conexión con la base de datos', 'error');
    event.preventDefault();
});