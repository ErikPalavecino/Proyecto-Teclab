const { ipcRenderer } = require('electron');


let productos = [];
let productosOriginal = [];


document.addEventListener('DOMContentLoaded', async () => {
    console.log('Página de productos cargada');
    await loadProductos();
    setupEventListeners();
});


function setupEventListeners() {
    // Formulario de agregar producto
    const addForm = document.getElementById('addProductForm');
    if (addForm) {
        addForm.addEventListener('submit', handleAddProduct);
    }

    // Formulario de editar producto
    const editForm = document.getElementById('editProductForm');
    if (editForm) {
        editForm.addEventListener('submit', handleEditProduct);
    }

    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeEditModal();
        }
    });

    
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeEditModal();
            }
        });
    }
}

// Cargar productos desde la base de datos
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

// Mostrar productos en la tabla
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
                    <div style="display: flex; gap: 5px; justify-content: center; flex-wrap: wrap;">
                        <button class="btn-icon btn-primary" onclick="editProduct(${producto.id})" title="Editar">
                            
                        </button>
                        <button class="btn-icon btn-success" onclick="adjustStock(${producto.id}, '${producto.nombre}')" title="Ajustar Stock">
                            
                        </button>
                        <button class="btn-icon btn-danger" onclick="deleteProduct(${producto.id}, '${producto.nombre}')" title="Eliminar">
                            
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    tableBody.innerHTML = rows;
    showLoadingInTable(false);
}

// Obtener estado del stock
function getStockStatus(stock) {
    if (stock === 0) return 'sin-stock';
    if (stock <= 5) return 'stock-bajo';
    if (stock <= 20) return 'stock-medio';
    return 'stock-alto';
}

// Obtener badge de stock
function getStockBadge(status) {
    const badges = {
        'sin-stock': '<span style="background: #dc3545; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">Sin Stock</span>',
        'stock-bajo': '<span style="background: #ffc107; color: #212529; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">Stock Bajo</span>',
        'stock-medio': '<span style="background: #fd7e14; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">Stock Medio</span>',
        'stock-alto': '<span style="background: #28a745; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">Stock OK</span>'
    };
    
    return badges[status] || badges['stock-alto'];
}


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

        // Validaciones
        if (!producto.nombre) {
            throw new Error('El nombre del producto es requerido');
        }
        
        if (producto.precio <= 0) {
            throw new Error('El precio debe ser mayor a 0');
        }

        // Verificar si ya existe el código de barras
        if (producto.codigo_barras) {
            const existeCodigoBarras = productos.some(p => 
                p.codigo_barras === producto.codigo_barras
            );
            if (existeCodigoBarras) {
                throw new Error('Ya existe un producto con ese código de barras');
            }
        }

        // Guardar en la base de datos
        const result = await ipcRenderer.invoke('add-producto', producto);
        
        if (result) {
            showNotification('Producto agregado exitosamente', 'success');
            hideProductForm();
            await loadProductos();
        }

    } catch (error) {
        console.error('Error agregando producto:', error);
        showNotification(error.message || 'Error agregando producto', 'error');
    } finally {
        // Ocultar loading
        loading.style.display = 'none';
        text.style.display = 'inline';
        submitBtn.disabled = false;
    }
}


function editProduct(id) {
    const producto = productos.find(p => p.id === id);
    if (!producto) {
        showNotification('Producto no encontrado', 'error');
        return;
    }

    
    document.getElementById('editId').value = producto.id;
    document.getElementById('editNombre').value = producto.nombre;
    document.getElementById('editDescripcion').value = producto.descripcion || '';
    document.getElementById('editPrecio').value = producto.precio;
    document.getElementById('editStock').value = producto.stock;
    document.getElementById('editCategoria').value = producto.categoria || '';
    document.getElementById('editCodigoBarras').value = producto.codigo_barras || '';

    const modal = document.getElementById('editModal');
    modal.classList.add('show');
    
    
    setTimeout(() => {
        document.getElementById('editNombre').focus();
    }, 100);
}


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
        const id = parseInt(formData.get('id'));
        const producto = {
            nombre: formData.get('nombre').trim(),
            descripcion: formData.get('descripcion').trim(),
            precio: parseFloat(formData.get('precio')),
            stock: parseInt(formData.get('stock')) || 0,
            categoria: formData.get('categoria'),
            codigo_barras: formData.get('codigo_barras').trim() || null
        };

        // Validaciones
        if (!producto.nombre) {
            throw new Error('El nombre del producto es requerido');
        }
        
        if (producto.precio <= 0) {
            throw new Error('El precio debe ser mayor a 0');
        }

        // Verificar si ya existe el código de barras (excluyendo el producto actual)
        if (producto.codigo_barras) {
            const existeCodigoBarras = productos.some(p => 
                p.codigo_barras === producto.codigo_barras && p.id !== id
            );
            if (existeCodigoBarras) {
                throw new Error('Ya existe un producto con ese código de barras');
            }
        }

        // Actualizar en la base de datos
        const result = await ipcRenderer.invoke('update-producto', id, producto);
        
        if (result) {
            showNotification('Producto actualizado exitosamente', 'success');
            closeEditModal();
            await loadProductos();
        }

    } catch (error) {
        console.error('Error actualizando producto:', error);
        showNotification(error.message || 'Error actualizando producto', 'error');
    } finally {
        
        loading.style.display = 'none';
        text.style.display = 'inline';
        submitBtn.disabled = false;
    }
}


function closeEditModal() {
    const modal = document.getElementById('editModal');
    modal.classList.remove('show');
    
    // Limpiar formulario
    document.getElementById('editProductForm').reset();
}

// Ajustar stock de un producto
function adjustStock(id, nombre) {
    const cantidad = prompt(`Ajustar stock para "${nombre}"\n\nIngrese la cantidad a agregar/quitar:\n(Número positivo para agregar, negativo para quitar)`);
    
    if (cantidad === null) return; // Usuario canceló
    
    const ajuste = parseInt(cantidad);
    if (isNaN(ajuste)) {
        showNotification('Cantidad inválida', 'error');
        return;
    }

    adjustStockConfirmed(id, ajuste, nombre);
}


async function adjustStockConfirmed(id, ajuste, nombre) {
    try {
        const result = await ipcRenderer.invoke('update-stock', id, ajuste);
        
        if (result && result.changes > 0) {
            const accion = ajuste > 0 ? 'agregado' : 'reducido';
            showNotification(`Stock ${accion} para "${nombre}"`, 'success');
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
    const confirmDelete = confirm(`¿Está seguro que desea eliminar el producto "${nombre}"?\n\nEsta acción no se puede deshacer.`);
    
    if (confirmDelete) {
        deleteProductConfirmed(id, nombre);
    }
}

// Confirmar eliminación de producto
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
    
    // Mostrar mensaje si no hay resultados
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

// Limpiar filtros
function clearFilters() {
    document.getElementById('searchProduct').value = '';
    document.getElementById('filterCategory').value = '';
    displayProductos(productosOriginal);
}

// Navegación
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

// Mostrar/ocultar mensaje de carga en tabla
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

// Mostrar mensaje cuando no hay productos
function showNoProductsMessage() {
    const tableContainer = document.querySelector('.table-container');
    const noProductsDiv = document.getElementById('noProducts');
    
    tableContainer.style.display = 'none';
    noProductsDiv.style.display = 'block';
}

// Ocultar mensaje cuando hay productos
function hideNoProductsMessage() {
    const tableContainer = document.querySelector('.table-container');
    const noProductsDiv = document.getElementById('noProducts');
    
    tableContainer.style.display = 'block';
    noProductsDiv.style.display = 'none';
}

// Mostrar notificaciones (reutilizada del index.js)
function showNotification(message, type = 'info') {
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

    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Agregar estilos adicionales para los botones de iconos
const additionalStyles = document.createElement('style');
additionalStyles.textContent = `
    .btn-icon {
        background: none;
        border: none;
        padding: 6px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
        transition: all 0.3s ease;
    }
    
    .btn-icon.btn-primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
    }
    
    .btn-icon.btn-success {
        background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
        color: white;
    }
    
    .btn-icon.btn-danger {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        color: white;
    }
    
    .btn-icon:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    
    .category-badge {
        background: #e9ecef;
        color: #495057;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.8rem;
    }
`;
document.head.appendChild(additionalStyles);