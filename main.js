const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const Database = require('./src/database/db');

// Mantener referencia global de la ventana
let mainWindow;

// Inicializar base de datos
const db = new Database();

function createWindow() {
  // Crear la ventana principal
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'assets/icon.png'), // Opcional: agregar icono
    show: false // No mostrar hasta que esté listo
  });

  // Cargar el archivo HTML principal
  mainWindow.loadFile('src/views/index.html');

  // Mostrar ventana cuando esté lista
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

 
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Evento cuando la ventana se cierra
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Crear menú de la aplicación
  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Salir',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Gestión',
      submenu: [
        {
          label: 'Productos',
          click: () => {
            mainWindow.loadFile('src/views/productos.html');
          }
        },
        {
          label: 'Ventas',
          click: () => {
            mainWindow.loadFile('src/views/ventas.html');
          }
        },
        {
          label: 'Stock',
          click: () => {
            mainWindow.loadFile('src/views/stock.html');
          }
        },
        {
          label: 'Reportes',
          click: () => {
            mainWindow.loadFile('src/views/reportes.html');
          }
        }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        {
          label: 'Inicio',
          click: () => {
            mainWindow.loadFile('src/views/index.html');
          }
        },
        { role: 'reload' },
        { role: 'toggledevtools' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Este método se ejecuta cuando Electron ha terminado de inicializarse
app.whenReady().then(createWindow);

// Salir cuando todas las ventanas estén cerradas
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Manejadores IPC para comunicación con renderer

// Productos
ipcMain.handle('get-productos', async () => {
  return await db.getProductos();
});

ipcMain.handle('add-producto', async (event, producto) => {
  return await db.addProducto(producto);
});

ipcMain.handle('update-producto', async (event, id, producto) => {
  return await db.updateProducto(id, producto);
});

ipcMain.handle('delete-producto', async (event, id) => {
  return await db.deleteProducto(id);
});

// Ventas
ipcMain.handle('get-ventas', async () => {
  return await db.getVentas();
});

ipcMain.handle('add-venta', async (event, venta) => {
  return await db.addVenta(venta);
});

// Stock
ipcMain.handle('get-stock-bajo', async (event, limite) => {
  return await db.getStockBajo(limite || 5);
});

ipcMain.handle('update-stock', async (event, productId, cantidad) => {
  return await db.updateStock(productId, cantidad);
});

// Reportes
ipcMain.handle('get-ventas-del-dia', async () => {
  return await db.getVentasDelDia();
});

ipcMain.handle('get-producto-mas-vendido', async () => {
  return await db.getProductoMasVendido();
});