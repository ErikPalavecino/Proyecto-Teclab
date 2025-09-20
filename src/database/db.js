const Database = require('better-sqlite3');
const path = require('path');

class DatabaseManager {
  constructor() {
    const dbPath = path.join(__dirname, '../../database.db');
    this.db = new Database(dbPath);
    console.log('Conectado a la base de datos SQLite.');
    this.initTables();
  }

  // Inicializar tablas
  initTables() {
    const queries = [
      // Tabla de productos
      `CREATE TABLE IF NOT EXISTS productos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        precio REAL NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        categoria TEXT,
        codigo_barras TEXT UNIQUE,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Tabla de ventas
      `CREATE TABLE IF NOT EXISTS ventas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total REAL NOT NULL,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        cliente TEXT,
        metodo_pago TEXT DEFAULT 'efectivo'
      )`,

      // Tabla de detalle de ventas
      `CREATE TABLE IF NOT EXISTS detalle_ventas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venta_id INTEGER,
        producto_id INTEGER,
        cantidad INTEGER NOT NULL,
        precio_unitario REAL NOT NULL,
        subtotal REAL NOT NULL,
        FOREIGN KEY (venta_id) REFERENCES ventas (id),
        FOREIGN KEY (producto_id) REFERENCES productos (id)
      )`
    ];

    queries.forEach(query => {
      try {
        this.db.exec(query);
      } catch (err) {
        console.error('Error creando tabla:', err.message);
      }
    });
  }

 
  getProductos() {
    try {
      const query = 'SELECT * FROM productos ORDER BY nombre';
      return this.db.prepare(query).all();
    } catch (error) {
      console.error('Error obteniendo productos:', error);
      throw error;
    }
  }

  addProducto(producto) {
    try {
      const query = `
        INSERT INTO productos (nombre, descripcion, precio, stock, categoria, codigo_barras)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      const stmt = this.db.prepare(query);
      const result = stmt.run(
        producto.nombre,
        producto.descripcion || '',
        producto.precio,
        producto.stock || 0,
        producto.categoria || '',
        producto.codigo_barras || null
      );
      
      return { id: result.lastInsertRowid, ...producto };
    } catch (error) {
      console.error('Error agregando producto:', error);
      throw error;
    }
  }

  updateProducto(id, producto) {
    try {
      const query = `
        UPDATE productos 
        SET nombre = ?, descripcion = ?, precio = ?, stock = ?, categoria = ?, 
            codigo_barras = ?, fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      const stmt = this.db.prepare(query);
      const result = stmt.run(
        producto.nombre,
        producto.descripcion,
        producto.precio,
        producto.stock,
        producto.categoria,
        producto.codigo_barras,
        id
      );
      
      return { changes: result.changes };
    } catch (error) {
      console.error('Error actualizando producto:', error);
      throw error;
    }
  }

  deleteProducto(id) {
    try {
      const query = 'DELETE FROM productos WHERE id = ?';
      const stmt = this.db.prepare(query);
      const result = stmt.run(id);
      
      return { changes: result.changes };
    } catch (error) {
      console.error('Error eliminando producto:', error);
      throw error;
    }
  }

  
  getVentas() {
    try {
      const query = `
        SELECT v.*, 
               GROUP_CONCAT(p.nombre || ' x' || dv.cantidad) as productos
        FROM ventas v
        LEFT JOIN detalle_ventas dv ON v.id = dv.venta_id
        LEFT JOIN productos p ON dv.producto_id = p.id
        GROUP BY v.id
        ORDER BY v.fecha DESC
      `;
      
      return this.db.prepare(query).all();
    } catch (error) {
      console.error('Error obteniendo ventas:', error);
      throw error;
    }
  }

  addVenta(venta) {
    try {
      
      const transaction = this.db.transaction(() => {
      
        const ventaQuery = `
          INSERT INTO ventas (total, cliente, metodo_pago)
          VALUES (?, ?, ?)
        `;
        const ventaStmt = this.db.prepare(ventaQuery);
        const ventaResult = ventaStmt.run(
          venta.total,
          venta.cliente || '',
          venta.metodo_pago || 'efectivo'
        );
        
        const ventaId = ventaResult.lastInsertRowid;

        
        const detalleQuery = `
          INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
          VALUES (?, ?, ?, ?, ?)
        `;
        const detalleStmt = this.db.prepare(detalleQuery);
        
        const stockQuery = 'UPDATE productos SET stock = stock - ? WHERE id = ?';
        const stockStmt = this.db.prepare(stockQuery);

        venta.items.forEach(item => {
          // Insertar detalle
          detalleStmt.run(
            ventaId,
            item.producto_id,
            item.cantidad,
            item.precio_unitario,
            item.subtotal
          );

          // Actualizar stock
          stockStmt.run(item.cantidad, item.producto_id);
        });

        return { id: ventaId };
      });

      return transaction();
    } catch (error) {
      console.error('Error agregando venta:', error);
      throw error;
    }
  }

  
  getStockBajo(limite = 5) {
    try {
      const query = 'SELECT * FROM productos WHERE stock <= ? ORDER BY stock ASC';
      return this.db.prepare(query).all(limite);
    } catch (error) {
      console.error('Error obteniendo stock bajo:', error);
      throw error;
    }
  }

  updateStock(productId, cantidad) {
    try {
      const query = 'UPDATE productos SET stock = stock + ? WHERE id = ?';
      const stmt = this.db.prepare(query);
      const result = stmt.run(cantidad, productId);
      
      return { changes: result.changes };
    } catch (error) {
      console.error('Error actualizando stock:', error);
      throw error;
    }
  }

  
  getVentasDelDia() {
    try {
      const query = `
        SELECT COUNT(*) as total_ventas, 
               COALESCE(SUM(total), 0) as total_ingresos
        FROM ventas 
        WHERE DATE(fecha) = DATE('now')
      `;
      
      const result = this.db.prepare(query).get();
      return result || { total_ventas: 0, total_ingresos: 0 };
    } catch (error) {
      console.error('Error obteniendo ventas del día:', error);
      throw error;
    }
  }

  getProductoMasVendido() {
    try {
      const query = `
        SELECT p.nombre, SUM(dv.cantidad) as total_vendido
        FROM detalle_ventas dv
        JOIN productos p ON dv.producto_id = p.id
        GROUP BY p.id, p.nombre
        ORDER BY total_vendido DESC
        LIMIT 1
      `;
      
      return this.db.prepare(query).get();
    } catch (error) {
      console.error('Error obteniendo producto más vendido:', error);
      throw error;
    }
  }

  // Cerrar conexión
  close() {
    try {
      this.db.close();
      console.log('Base de datos cerrada correctamente.');
    } catch (error) {
      console.error('Error cerrando base de datos:', error);
    }
  }
}

module.exports = DatabaseManager;