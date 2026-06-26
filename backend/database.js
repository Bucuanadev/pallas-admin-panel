const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'pallas.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao abrir base de dados SQLite:', err.message);
  } else {
    console.log('Ligado à base de dados SQLite em:', dbPath);
  }
});

// Promisificar operações da base de dados para usar async/await
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        console.error('Erro no dbRun para SQL:', sql, err);
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        console.error('Erro no dbGet para SQL:', sql, err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Erro no dbAll para SQL:', sql, err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Inicializar as tabelas
async function initDatabase() {
  try {
    // 1. Tabela Users
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Tabela Products
    await dbRun(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price_mzn REAL NOT NULL,
        cost_usdt REAL NOT NULL,
        image_url TEXT,
        supplier TEXT NOT NULL,
        supplier_sku TEXT NOT NULL,
        stock INTEGER NOT NULL DEFAULT 100,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Tabela Orders
    await dbRun(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wc_order_id TEXT NOT NULL UNIQUE,
        product_id INTEGER,
        product_name TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL,
        amount_mzn REAL NOT NULL,
        amount_usdt REAL NOT NULL,
        payment_status TEXT NOT NULL DEFAULT 'pending',
        purchase_status TEXT NOT NULL DEFAULT 'awaiting_conversion',
        supplier TEXT NOT NULL,
        supplier_order_id TEXT,
        tracking_number TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. Tabela Financials (Guarda o saldo)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS financials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        balance_mzn REAL NOT NULL DEFAULT 0,
        balance_usdt REAL NOT NULL DEFAULT 0
      )
    `);

    // 5. Tabela Transactions (Historico de transações)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL, -- 'conversion', 'purchase', 'sale', etc.
        amount_mzn REAL NOT NULL,
        amount_usdt REAL NOT NULL,
        exchange_rate REAL,
        status TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 6. Tabela Conversions (Conversões específicas de pedidos)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS conversions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        amount_mzn REAL NOT NULL,
        amount_usdt REAL NOT NULL,
        exchange_rate REAL NOT NULL,
        binance_tx_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 7. Tabela Stores
    await dbRun(`
      CREATE TABLE IF NOT EXISTS stores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        api_url TEXT,
        consumer_key TEXT,
        consumer_secret TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        country TEXT NOT NULL DEFAULT 'MZ',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 8. Tabela Gateways
    await dbRun(`
      CREATE TABLE IF NOT EXISTS gateways (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        api_url TEXT,
        client_id TEXT,
        client_secret TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 9. Tabela Suppliers
    await dbRun(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        api_supported INTEGER NOT NULL DEFAULT 0,
        default_markup_pct REAL NOT NULL DEFAULT 0
      )
    `);

    // 10. Tabela Tracking
    await dbRun(`
      CREATE TABLE IF NOT EXISTS tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        raw_source TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 11. Tabela Notifications
    await dbRun(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        channel TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT NOT NULL,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Tabelas SQLite verificadas/criadas.');
    await seedData();
  } catch (error) {
    console.error('Erro ao inicializar base de dados:', error);
  }
}

// Seed dos dados iniciais
async function seedData() {
  // Seed Users
  const userCount = await dbGet('SELECT COUNT(*) as count FROM users');
  if (userCount.count === 0) {
    console.log('Seeding inicial de utilizadores...');
    const defaultPassword = 'pallas123';
    const hash = await bcrypt.hash(defaultPassword, 10);

    // Marta (supervisor/admin)
    await dbRun(
      'INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)',
      ['Marta Sousa', 'marta@pallas.shop', hash, 'supervisor', 'active']
    );
    // João (finance)
    await dbRun(
      'INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)',
      ['João Fumo', 'joao@pallas.shop', hash, 'finance', 'active']
    );
    // Lina (purchases)
    await dbRun(
      'INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)',
      ['Lina Tovela', 'lina@pallas.shop', hash, 'purchases', 'active']
    );
    console.log('Utilizadores iniciais semeados com a senha: pallas123');
  }

  // Seed Products
  const productCount = await dbGet('SELECT COUNT(*) as count FROM products');
  if (productCount.count === 0) {
    console.log('Seeding inicial de produtos...');
    await dbRun(
      'INSERT INTO products (id, name, description, price_mzn, cost_usdt, image_url, supplier, supplier_sku, stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        401,
        'Auscultadores Premium Wireless Pallas',
        'Auscultadores com cancelamento de ruído activo, bluetooth 5.2 e 40h de bateria.',
        18200,
        11.2,
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80',
        'cj_dropshipping',
        'CJ-HP-01',
        92,
      ]
    );
    await dbRun(
      'INSERT INTO products (id, name, description, price_mzn, cost_usdt, image_url, supplier, supplier_sku, stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        402,
        'Relógio Inteligente Smartwatch Sport',
        'Smartwatch desportivo com sensor cardíaco, monitor de sono e GPS integrado.',
        9600,
        9.8,
        'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80',
        'aliexpress',
        'AL-002',
        150,
      ]
    );
    await dbRun(
      'INSERT INTO products (id, name, description, price_mzn, cost_usdt, image_url, supplier, supplier_sku, stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        403,
        'Mochila Ergónomica Urban Tech',
        'Mochila impermeável com compartimento para laptop de 15.6 polegadas e porta USB externa.',
        14850,
        8.6,
        'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&q=80',
        'shein',
        'SH-045',
        75,
      ]
    );
    console.log('Produtos semeados.');
  }

  // Seed Financials
  const financialCount = await dbGet('SELECT COUNT(*) as count FROM financials');
  if (financialCount.count === 0) {
    console.log('Seeding inicial de finanças...');
    await dbRun(
      'INSERT INTO financials (balance_mzn, balance_usdt) VALUES (?, ?)',
      [245000, 18.42]
    );
  }

  // Seed Suppliers
  const supplierCount = await dbGet('SELECT COUNT(*) as count FROM suppliers');
  if (supplierCount.count === 0) {
    console.log('Seeding inicial de fornecedores...');
    await dbRun(
      'INSERT INTO suppliers (name, slug, api_supported, default_markup_pct) VALUES (?, ?, ?, ?)',
      ['CJ Dropshipping', 'cj_dropshipping', 1, 18]
    );
    await dbRun(
      'INSERT INTO suppliers (name, slug, api_supported, default_markup_pct) VALUES (?, ?, ?, ?)',
      ['AliExpress', 'aliexpress', 0, 22]
    );
    await dbRun(
      'INSERT INTO suppliers (name, slug, api_supported, default_markup_pct) VALUES (?, ?, ?, ?)',
      ['Shein', 'shein', 0, 19]
    );
  }

  // Seed Stores
  const storeCount = await dbGet('SELECT COUNT(*) as count FROM stores');
  if (storeCount.count === 0) {
    console.log('Seeding inicial de lojas...');
    await dbRun(
      'INSERT INTO stores (id, name, type, api_url, consumer_key, consumer_secret, status, country, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        1,
        'Pallas.shop WooCommerce',
        'woocommerce',
        'https://pallas.shop/wp-json/wc/v3',
        'ck_demo',
        'cs_demo',
        'active',
        'MZ',
        'Loja principal de checkout em Meticais',
      ]
    );
  }

  // Seed Gateways
  const gatewayCount = await dbGet('SELECT COUNT(*) as count FROM gateways');
  if (gatewayCount.count === 0) {
    console.log('Seeding inicial de gateways...');
    await dbRun(
      'INSERT INTO gateways (id, name, provider, api_url, client_id, client_secret, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        1,
        'M-Pesa Moçambique',
        'mpesa',
        'https://api.mpesa.mz/v1/payments',
        'mpesa_client',
        '••••',
        'active',
        'Webhook para pagamentos M-Pesa e controlo de STK.',
      ]
    );
    await dbRun(
      'INSERT INTO gateways (id, name, provider, api_url, client_id, client_secret, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        2,
        'PSP Banco Local',
        'bank',
        'https://psp.local/api/v1/transactions',
        'bank_client',
        '••••',
        'active',
        'Cobrança por referência bancária e comprovativo upload.',
      ]
    );
  }

  // Seed Orders
  const orderCount = await dbGet('SELECT COUNT(*) as count FROM orders');
  if (orderCount.count === 0) {
    console.log('Seeding inicial de pedidos...');
    await dbRun(
      'INSERT INTO orders (id, wc_order_id, product_id, product_name, customer_name, phone, email, amount_mzn, amount_usdt, payment_status, purchase_status, supplier, supplier_order_id, tracking_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        1,
        '1001',
        401,
        'Auscultadores Premium Wireless Pallas',
        'Amina Mafuiane',
        '+258 84 123 4567',
        'amina@example.com',
        18200,
        11.2,
        'paid',
        'purchased',
        'cj_dropshipping',
        'CJ-1001',
        'TRK-4452',
        '2026-06-20T09:30:00.000Z',
        '2026-06-21T16:00:00.000Z',
      ]
    );
    await dbRun(
      'INSERT INTO orders (id, wc_order_id, product_id, product_name, customer_name, phone, email, amount_mzn, amount_usdt, payment_status, purchase_status, supplier, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        2,
        '1002',
        402,
        'Relógio Inteligente Smartwatch Sport',
        'Nelson Chissano',
        '+258 86 234 5678',
        'nelson@example.com',
        9600,
        9.8,
        'paid',
        'awaiting_purchase',
        'aliexpress',
        '2026-06-22T07:10:00.000Z',
        '2026-06-22T07:10:00.000Z',
      ]
    );
    await dbRun(
      'INSERT INTO orders (id, wc_order_id, product_id, product_name, customer_name, phone, email, amount_mzn, amount_usdt, payment_status, purchase_status, supplier, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        3,
        '1003',
        403,
        'Mochila Ergónomica Urban Tech',
        'Sofia Bila',
        '+258 82 777 8888',
        'sofia@example.com',
        14850,
        8.6,
        'pending',
        'awaiting_conversion',
        'shein',
        '2026-06-24T11:40:00.000Z',
        '2026-06-24T11:40:00.000Z',
      ]
    );
  }

  // Seed Transactions
  const txCount = await dbGet('SELECT COUNT(*) as count FROM transactions');
  if (txCount.count === 0) {
    console.log('Seeding inicial de transações...');
    await dbRun(
      'INSERT INTO transactions (id, type, amount_mzn, amount_usdt, exchange_rate, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [1, 'conversion', 18200, 11.2, 1625, 'completed', '2026-06-20T09:45:00.000Z']
    );
    await dbRun(
      'INSERT INTO transactions (id, type, amount_mzn, amount_usdt, exchange_rate, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [2, 'purchase', 9600, 9.8, 979, 'pending', '2026-06-22T07:20:00.000Z']
    );
  }

  // Seed Conversions
  const convCount = await dbGet('SELECT COUNT(*) as count FROM conversions');
  if (convCount.count === 0) {
    console.log('Seeding inicial de conversões...');
    await dbRun(
      'INSERT INTO conversions (id, order_id, amount_mzn, amount_usdt, exchange_rate, binance_tx_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [1, 1, 18200, 11.2, 1625, 'bnb-1001', 'completed', '2026-06-20T09:45:00.000Z']
    );
    await dbRun(
      'INSERT INTO conversions (id, order_id, amount_mzn, amount_usdt, exchange_rate, binance_tx_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [2, 2, 9600, 9.8, 979, 'bnb-1002', 'pending', '2026-06-22T07:20:00.000Z']
    );
  }

  // Seed Tracking
  const trackCount = await dbGet('SELECT COUNT(*) as count FROM tracking');
  if (trackCount.count === 0) {
    console.log('Seeding inicial de tracking...');
    await dbRun(
      'INSERT INTO tracking (id, order_id, status, raw_source) VALUES (?, ?, ?, ?)',
      [1, 1, 'Em trânsito internacional', 'CJ Dropshipping API']
    );
  }

  // Seed Notifications
  const notifCount = await dbGet('SELECT COUNT(*) as count FROM notifications');
  if (notifCount.count === 0) {
    console.log('Seeding inicial de notificações...');
    await dbRun(
      'INSERT INTO notifications (id, order_id, channel, status, message, sent_at) VALUES (?, ?, ?, ?, ?, ?)',
      [
        1,
        1,
        'email',
        'sent',
        'Compra recebida da loja e notificação enviada ao operador',
        '2026-06-21T16:00:00.000Z',
      ]
    );
  }
}

module.exports = {
  db,
  dbRun,
  dbGet,
  dbAll,
  initDatabase,
};
