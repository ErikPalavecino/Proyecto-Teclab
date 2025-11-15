const { ipcRenderer } = require('electron');


let productos = [];
let carrito = [];
let totalVenta = 0;


document.addEventListener('DOMContentLoaded', async () => {
    console.log('Sistema de ventas cargado');
    await loadProductos();
    setupEventListeners();
    updateCarrito();
});

function setupEventListeners() {
    
    const searchInput = document.getElementById('searchProduct');
    if (searchInput) {
        searchInput.addEventListener('input', filterProducts);
    }

  
    const categoryFilter = document.getElementById('filterCategory');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', filterProducts);
    }

 
    const saleForm = document.getElementById('finalizeSaleForm');
    if (saleForm) {
        saleForm.addEventListener('submit', handleFinalizeSale);
    }

   
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCheckoutModal();
        }
    });

    
    const modal = document.getElementById('checkoutModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeCheckoutModal();
            }
        });
    }
}


async function loadProductos() {
    try {
        showLoadingProducts(true);
        productos = await ipcRenderer.invoke('get-productos');
        
       
        productos = productos.filter(p => p.stock > 0);
        
        displayProductos(productos);
        
        if (productos.length === 0) {
            showNoProductsMessage();
        }
        
        console.log(`${productos.length} productos disponibles para venta`);
    } catch (error) {
        console.error('Error cargando productos:', error);
        showNotification('Error cargando productos', 'error');
    } finally {
        showLoadingProducts(false);
    }
}


function displayProductos(productosArray) {
    const productsGrid = document.getElementById('productsGrid');
    
    if (!productosArray || productosArray.length === 0) {
        productsGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: rgba(255,255,255,0.7);">
                <h3>📦 No hay productos disponibles</h3>
                <p>No hay productos con stock para vender en este momento</p>
            </div>
        `;
        return;
    }

    productsGrid.innerHTML = '';

    productosArray.forEach(producto => {
        const stockStatus = getStockStatus(producto.stock);
        const stockBadge = getStockBadgeSmall(stockStatus);
        
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="product-header">
                <h3 class="product-name">${producto.nombre}</h3>
                ${stockBadge}
            </div>
            
            ${producto.categoria ? `<div class="product-category">${producto.categoria}</div>` : ''}
            
            ${producto.descripcion ? `<p class="product-description">${producto.descripcion}</p>` : ''}
            
            <div class="product-info">
                <div class="product-price">$${producto.precio.toFixed(2)}</div>
                <div class="product-stock">Stock: ${producto.stock}</div>
            </div>
            
            <div class="product-actions">
                <input type="number" 
                       class="quantity-input" 
                       id="qty-${producto.id}" 
                       min="1" 
                       max="${producto.stock}" 
                       value="1"
                       placeholder="Cant.">
                <button class="btn-add-cart" onclick="addToCart(${producto.id})">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11 9h2V6h3V4h-3V1h-2v3H8v2h3v3zm-4 9c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2zm-9.83-3.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.86-7.01L19.42 4h-.01l-1.1 2-2.76 5H8.53l-.13-.27L6.16 6l-.95-2-.94-2H1v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.13 0-.25-.11-.25-.25z"/>
                    </svg>
                    Agregar
                </button>
            </div>
        `;
        
        productsGrid.appendChild(card);
    });
}


function addToCart(productId) {
    const producto = productos.find(p => p.id === productId);
    if (!producto) {
        showNotification('Producto no encontrado', 'error');
        return;
    }

    const qtyInput = document.getElementById(`qty-${productId}`);
    const cantidad = parseInt(qtyInput.value) || 1;

   
    if (cantidad <= 0) {
        showNotification('La cantidad debe ser mayor a 0', 'warning');
        return;
    }

    
    const enCarrito = carrito.find(item => item.producto_id === productId);
    const cantidadEnCarrito = enCarrito ? enCarrito.cantidad : 0;
    const stockDisponible = producto.stock - cantidadEnCarrito;

    if (cantidad > stockDisponible) {
        showNotification(`Solo hay ${stockDisponible} unidades disponibles`, 'warning');
        return;
    }

   
    const itemExistente = carrito.find(item => item.producto_id === productId);
    
    if (itemExistente) {
        itemExistente.cantidad += cantidad;
        itemExistente.subtotal = itemExistente.cantidad * itemExistente.precio_unitario;
        showNotification(`Se agregaron ${cantidad} unidades más de "${producto.nombre}"`, 'success');
    } else {
        carrito.push({
            producto_id: productId,
            nombre: producto.nombre,
            precio_unitario: producto.precio,
            cantidad: cantidad,
            subtotal: producto.precio * cantidad,
            stock_disponible: producto.stock
        });
        showNotification(`"${producto.nombre}" agregado al carrito`, 'success');
    }

   
    qtyInput.value = 1;

    updateCarrito();
}


function updateCarrito() {
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    const emptyCartMessage = document.getElementById('emptyCartMessage');
    const btnFinalizeSale = document.querySelector('.btn-finalize-sale');

   
    totalVenta = carrito.reduce((sum, item) => sum + item.subtotal, 0);

    if (carrito.length === 0) {
        cartItems.innerHTML = '';
        emptyCartMessage.style.display = 'block';
        cartTotal.textContent = '$0.00';
        if (btnFinalizeSale) btnFinalizeSale.disabled = true;
        return;
    }

    emptyCartMessage.style.display = 'none';
    if (btnFinalizeSale) btnFinalizeSale.disabled = false;

   
    cartItems.innerHTML = '';
    carrito.forEach((item, index) => {
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = `
            <div class="cart-item-info">
                <strong>${item.nombre}</strong>
                <div class="cart-item-details">
                    <span>$${item.precio_unitario.toFixed(2)} × ${item.cantidad}</span>
                </div>
            </div>
            <div class="cart-item-actions">
                <div class="cart-quantity-controls">
                    <button class="btn-qty" onclick="updateItemQuantity(${index}, -1)" ${item.cantidad <= 1 ? 'disabled' : ''}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 13H5v-2h14v2z"/>
                        </svg>
                    </button>
                    <span class="cart-quantity">${item.cantidad}</span>
                    <button class="btn-qty" onclick="updateItemQuantity(${index}, 1)" ${item.cantidad >= item.stock_disponible ? 'disabled' : ''}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                        </svg>
                    </button>
                </div>
                <div class="cart-item-subtotal">$${item.subtotal.toFixed(2)}</div>
                <button class="btn-remove" onclick="removeFromCart(${index})" title="Eliminar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                </button>
            </div>
        `;
        cartItems.appendChild(cartItem);
    });

    cartTotal.textContent = `$${totalVenta.toFixed(2)}`;
}


function updateItemQuantity(index, change) {
    const item = carrito[index];
    const newQuantity = item.cantidad + change;

    if (newQuantity <= 0) {
        removeFromCart(index);
        return;
    }

    if (newQuantity > item.stock_disponible) {
        showNotification(`Stock máximo: ${item.stock_disponible} unidades`, 'warning');
        return;
    }

    item.cantidad = newQuantity;
    item.subtotal = item.cantidad * item.precio_unitario;
    updateCarrito();
}

function removeFromCart(index) {
    const item = carrito[index];
    carrito.splice(index, 1);
    showNotification(`"${item.nombre}" eliminado del carrito`, 'info');
    updateCarrito();
}


function clearCart() {
    if (carrito.length === 0) {
        showNotification('El carrito ya está vacío', 'info');
        return;
    }

    const confirm = window.confirm('¿Está seguro que desea vaciar el carrito?');
    if (confirm) {
        carrito = [];
        updateCarrito();
        showNotification('Carrito vaciado', 'info');
    }
}


function openCheckoutModal() {
    if (carrito.length === 0) {
        showNotification('El carrito está vacío', 'warning');
        return;
    }

   
    totalVenta = carrito.reduce((sum, item) => sum + item.subtotal, 0);

    const modal = document.getElementById('checkoutModal');
    const totalDisplay = document.getElementById('checkoutTotal');
    const itemsList = document.getElementById('checkoutItems');

    
    itemsList.innerHTML = '';
    carrito.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${item.nombre} × ${item.cantidad}</span>
            <span>${item.subtotal.toFixed(2)}</span>
        `;
        itemsList.appendChild(li);
    });

    
    totalDisplay.textContent = `${totalVenta.toFixed(2)}`;
    
    console.log('Total de la venta:', totalVenta); 

    modal.style.display = 'flex';
    modal.classList.add('show');

    setTimeout(() => {
        document.getElementById('clienteNombre').focus();
    }, 100);
}


function closeCheckoutModal() {
    const modal = document.getElementById('checkoutModal');
    modal.style.display = 'none';
    modal.classList.remove('show');
    document.getElementById('finalizeSaleForm').reset();
}


async function handleFinalizeSale(event) {
    event.preventDefault();

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const loading = submitBtn.querySelector('.btn-loading');
    const text = submitBtn.querySelector('.btn-text');

    try {
        loading.style.display = 'inline-flex';
        text.style.display = 'none';
        submitBtn.disabled = true;

        const formData = new FormData(event.target);
        
        const venta = {
            total: totalVenta,
            cliente: formData.get('cliente').trim() || 'Cliente General',
            metodo_pago: formData.get('metodo_pago') || 'efectivo',
            items: carrito.map(item => ({
                producto_id: item.producto_id,
                cantidad: item.cantidad,
                precio_unitario: item.precio_unitario,
                subtotal: item.subtotal
            }))
        };

        console.log('Procesando venta:', venta);

        const result = await ipcRenderer.invoke('add-venta', venta);

       if (result && result.id) {
    showNotification(`¡Venta #${result.id} registrada exitosamente!`, 'success');
    
    const totalVentaFinal = totalVenta; 
    carrito = [];
    updateCarrito();
    closeCheckoutModal();
    await loadProductos();

   
    setTimeout(() => {
        alert(
            `✅ VENTA COMPLETADA\n\n` +
            `📋 Número de venta: #${result.id}\n` +
            `💰 Total: $${totalVentaFinal.toFixed(2)}\n` +  // <-- uso totalVentaFinal
            `👤 Cliente: ${venta.cliente}\n` +
            `💳 Método de pago: ${venta.metodo_pago}\n\n` +
            `¡Gracias por su compra!`
        );
    }, 500);
}


    } catch (error) {
        console.error('Error finalizando venta:', error);
        showNotification('Error al procesar la venta: ' + error.message, 'error');
    } finally {
        loading.style.display = 'none';
        text.style.display = 'inline';
        submitBtn.disabled = false;
    }
}


function filterProducts() {
    const searchTerm = document.getElementById('searchProduct').value.toLowerCase();
    const categoryFilter = document.getElementById('filterCategory').value;

    let productosFiltrados = productos.filter(producto => {
        const matchesSearch = !searchTerm || 
            producto.nombre.toLowerCase().includes(searchTerm) ||
            (producto.descripcion && producto.descripcion.toLowerCase().includes(searchTerm)) ||
            (producto.codigo_barras && producto.codigo_barras.toLowerCase().includes(searchTerm));

        const matchesCategory = !categoryFilter || producto.categoria === categoryFilter;

        return matchesSearch && matchesCategory;
    });

    displayProductos(productosFiltrados);
}

function clearFilters() {
    document.getElementById('searchProduct').value = '';
    document.getElementById('filterCategory').value = '';
    displayProductos(productos);
}


function getStockStatus(stock) {
    if (stock === 0) return 'sin-stock';
    if (stock <= 5) return 'stock-bajo';
    if (stock <= 20) return 'stock-medio';
    return 'stock-alto';
}

function getStockBadgeSmall(status) {
    const badges = {
        'sin-stock': '<span class="stock-badge-small stock-none">Sin Stock</span>',
        'stock-bajo': '<span class="stock-badge-small stock-low">Bajo</span>',
        'stock-medio': '<span class="stock-badge-small stock-medium">Medio</span>',
        'stock-alto': '<span class="stock-badge-small stock-high">OK</span>'
    };
    
    return badges[status] || badges['stock-alto'];
}

function showLoadingProducts(show) {
    const productsGrid = document.getElementById('productsGrid');
    
    if (show) {
        productsGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                <div class="loading"></div>
                <p style="margin-top: 10px; color: rgba(255,255,255,0.7);">Cargando productos...</p>
            </div>
        `;
    }
}

function showNoProductsMessage() {
    const productsGrid = document.getElementById('productsGrid');
    productsGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: rgba(255,255,255,0.7);">
            <h3>📦 No hay productos disponibles</h3>
            <p>Agrega productos con stock desde la sección de Productos</p>
        </div>
    `;
}

function navigateTo(page) {
    const pages = {
        'index': '../views/index.html',
        'productos': '../views/productos.html',
        'stock': '../views/stock.html',
        'reportes': '../views/reportes.html'
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