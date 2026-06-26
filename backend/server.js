const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { dbRun, dbGet, dbAll, initDatabase } = require('./database');
const { createWooCommerceProduct, syncWooCommerceOrders } = require('./woocommerce');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = 'pallas_super_secret_jwt_key_2026';

app.use(cors());
app.use(express.json());

// Inicializar a base de dados
initDatabase();

// Middleware de Autenticação JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido ou expirado.' });
    }
    req.user = user;
    next();
  });
}

// Rota de Diagnóstico
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'pallas-admin-panel', db: 'sqlite' });
});

// ----------------- ROTAS DE AUTENTICAÇÃO -----------------

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({ error: 'Utilizador não encontrado.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Esta conta está inactiva.' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Senha incorrecta.' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Erro no login:', error.message);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// Registro de Gestores
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  }

  try {
    const existing = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ error: 'Este email já está registado.' });
    }

    const hash = await bcrypt.hash(password, 10);
    await dbRun(
      'INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)',
      [name, email, hash, role, 'active']
    );

    res.status(201).json({ message: 'Gestor registado com sucesso.' });
  } catch (error) {
    console.error('Erro no registo:', error.message);
    res.status(500).json({ error: 'Erro ao registar gestor.' });
  }
});

// ----------------- ROTAS PÚBLICAS -----------------

// Obter produtos
app.get('/api/products', async (_req, res) => {
  try {
    const products = await dbAll('SELECT * FROM products ORDER BY id DESC');
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar produtos.' });
  }
});

// ----------------- ROTAS DE SINCRONIZAÇÃO WOOCOMMERCE -----------------

// Sincronizar Pedidos do WooCommerce real
app.post('/api/stores/sync', authenticateToken, async (_req, res) => {
  try {
    // Obter a primeira loja ativa como loja principal
    const store = await dbGet("SELECT * FROM stores WHERE type = 'woocommerce' AND status = 'active' LIMIT 1");
    if (!store) {
      return res.status(404).json({ error: 'Nenhuma loja WooCommerce ativa configurada.' });
    }

    const result = await syncWooCommerceOrders(store);
    res.json(result);
  } catch (error) {
    console.error('Erro na sincronização:', error.message);
    res.status(500).json({ error: `Erro de sincronização WooCommerce: ${error.message}` });
  }
});


// ----------------- ROTAS PROTEGIDAS DO PAINEL (ADMIN) -----------------

// Criar Novo Produto (e Sincronizar com WooCommerce se ativo)
app.post('/api/products', authenticateToken, async (req, res) => {
  const { name, description, price_mzn, cost_usdt, image_url, supplier, supplier_sku, stock } = req.body;
  if (!name || !price_mzn || !cost_usdt || !supplier || !supplier_sku) {
    return res.status(400).json({ error: 'Campos obrigatórios em falta.' });
  }

  try {
    const defaultImage = image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80';
    
    // 1. Inserir localmente no SQLite primeiro
    const result = await dbRun(
      `INSERT INTO products (name, description, price_mzn, cost_usdt, image_url, supplier, supplier_sku, stock, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        description || '',
        Number(price_mzn),
        Number(cost_usdt),
        defaultImage,
        supplier,
        supplier_sku,
        stock !== undefined ? Number(stock) : 100,
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );

    const newProductId = result.lastID;
    const productData = { id: newProductId, name, description, price_mzn, cost_usdt, image_url: defaultImage, supplier, supplier_sku, stock };

    let syncStatus = 'local_only';
    let errorMessage = '';

    // 2. Enviar para o WooCommerce se houver loja ativa configurada
    try {
      const store = await dbGet("SELECT * FROM stores WHERE type = 'woocommerce' AND status = 'active' LIMIT 1");
      if (store && store.consumer_key && !store.consumer_key.startsWith('ck_demo')) {
        await createWooCommerceProduct(store, productData);
        syncStatus = 'synced';
      }
    } catch (syncError) {
      console.error('Erro ao sincronizar produto com WooCommerce:', syncError.message);
      syncStatus = 'sync_failed';
      errorMessage = syncError.message;
    }

    const newProduct = await dbGet('SELECT * FROM products WHERE id = ?', [newProductId]);
    res.status(201).json({
      product: newProduct,
      sync_status: syncStatus,
      sync_error: errorMessage
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar produto.' });
  }
});

// Remover Produto
app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  const productId = req.params.id;
  try {
    await dbRun('DELETE FROM products WHERE id = ?', [productId]);
    res.json({ success: true, message: 'Produto removido com sucesso.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao remover produto.' });
  }
});

// Listar Pedidos
app.get('/api/orders', authenticateToken, async (_req, res) => {
  try {
    const orders = await dbAll('SELECT * FROM orders ORDER BY id DESC');
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar encomendas.' });
  }
});

// Criar Pedido Manualmente (Sem passar pela sync externa)
app.post('/api/orders', authenticateToken, async (req, res) => {
  const { product_id, product_name, supplier, customer_name, phone, email, amount_mzn, amount_usdt } = req.body;
  try {
    const wc_order_id = req.body.wc_order_id || `wc-${Date.now()}`;
    const result = await dbRun(
      `INSERT INTO orders 
      (wc_order_id, product_id, product_name, supplier, customer_name, phone, email, amount_mzn, amount_usdt, payment_status, purchase_status, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        wc_order_id,
        product_id || 101,
        product_name || 'Produto Admin',
        supplier || 'cj_dropshipping',
        customer_name || 'Cliente Admin',
        phone || '+258 84 000 0000',
        email || 'cliente@example.com',
        amount_mzn || 0,
        amount_usdt || 0,
        'paid',
        'awaiting_conversion',
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );

    const newOrder = await dbGet('SELECT * FROM orders WHERE id = ?', [result.lastID]);
    res.status(201).json(newOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar encomenda.' });
  }
});

// AÇÃO: Converter MZN para USDT específico do pedido
app.post('/api/orders/:id/convert-usdt', authenticateToken, async (req, res) => {
  const orderId = Number(req.params.id);
  try {
    const order = await dbGet('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      return res.status(404).json({ error: 'Encomenda não encontrada.' });
    }

    if (order.purchase_status !== 'awaiting_conversion') {
      return res.status(400).json({ error: 'Esta encomenda não está pendente de conversão.' });
    }

    const financials = await dbGet('SELECT * FROM financials WHERE id = 1');
    const requiredMzn = order.amount_mzn;

    if (financials.balance_mzn < requiredMzn) {
      return res.status(400).json({ error: 'Saldo em MZN insuficiente para cobrir esta conversão.' });
    }

    // Taxa de câmbio simulada
    const exchange_rate = 63.5;
    const calculatedUsdt = order.amount_usdt > 0 ? order.amount_usdt : Number((requiredMzn / exchange_rate).toFixed(2));

    // Deduz MZN do saldo, soma USDT
    await dbRun(
      'UPDATE financials SET balance_mzn = balance_mzn - ?, balance_usdt = balance_usdt + ? WHERE id = 1',
      [requiredMzn, calculatedUsdt]
    );

    // Registar na tabela de conversões
    const binanceTxId = `bnb-${Math.floor(100000 + Math.random() * 900000)}`;
    await dbRun(
      `INSERT INTO conversions (order_id, amount_mzn, amount_usdt, exchange_rate, binance_tx_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [orderId, requiredMzn, calculatedUsdt, exchange_rate, binanceTxId, 'completed', new Date().toISOString()]
    );

    // Registar transação
    await dbRun(
      'INSERT INTO transactions (type, amount_mzn, amount_usdt, exchange_rate, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ['conversion', requiredMzn, calculatedUsdt, exchange_rate, 'completed', new Date().toISOString()]
    );

    // Atualizar estado do pedido
    await dbRun(
      `UPDATE orders SET purchase_status = 'awaiting_purchase', amount_usdt = ?, updated_at = ? WHERE id = ?`,
      [calculatedUsdt, new Date().toISOString(), orderId]
    );

    const updatedOrder = await dbGet('SELECT * FROM orders WHERE id = ?', [orderId]);
    res.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao converter MZN para USDT.' });
  }
});

// AÇÃO: Pagar fornecedor no AliExpress/CJ com USDT
app.post('/api/orders/:id/pay-supplier', authenticateToken, async (req, res) => {
  const orderId = Number(req.params.id);
  try {
    const order = await dbGet('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      return res.status(404).json({ error: 'Encomenda não encontrada.' });
    }

    if (order.purchase_status !== 'awaiting_purchase') {
      return res.status(400).json({ error: 'Esta encomenda não está pronta para compra.' });
    }

    const financials = await dbGet('SELECT * FROM financials WHERE id = 1');
    const costUsdt = order.amount_usdt;

    if (financials.balance_usdt < costUsdt) {
      return res.status(400).json({ error: 'Saldo de USDT insuficiente para pagar o fornecedor.' });
    }

    // Deduzir do saldo de USDT
    await dbRun('UPDATE financials SET balance_usdt = balance_usdt - ? WHERE id = 1', [costUsdt]);

    // Gerar IDs simulados de tracking e fornecedor
    const supplier_order_id = `${order.supplier === 'cj_dropshipping' ? 'CJ' : order.supplier === 'aliexpress' ? 'ALI' : 'SH'}-${Math.floor(1000 + Math.random() * 9000)}`;
    const tracking_number = `LP${Math.floor(100000000 + Math.random() * 900000000)}CN`;

    // Atualizar encomenda
    await dbRun(
      `UPDATE orders SET purchase_status = 'purchased', supplier_order_id = ?, tracking_number = ?, updated_at = ? WHERE id = ?`,
      [supplier_order_id, tracking_number, new Date().toISOString(), orderId]
    );

    // Registar transação financeira
    await dbRun(
      'INSERT INTO transactions (type, amount_mzn, amount_usdt, status, created_at) VALUES (?, ?, ?, ?, ?)',
      ['purchase', 0, costUsdt, 'completed', new Date().toISOString()]
    );

    // Adicionar log de tracking
    await dbRun(
      'INSERT INTO tracking (order_id, status, raw_source, created_at) VALUES (?, ?, ?, ?)',
      [orderId, 'Pago ao fornecedor. Aguardando envio.', `${order.supplier.toUpperCase()} Checkout`, new Date().toISOString()]
    );

    // Adicionar notificação
    await dbRun(
      'INSERT INTO notifications (order_id, channel, status, message, sent_at) VALUES (?, ?, ?, ?, ?)',
      [
        orderId,
        'email',
        'sent',
        `Compra efetuada no ${order.supplier}. ID: ${supplier_order_id}, Tracking: ${tracking_number}. Cliente notificado.`,
        new Date().toISOString(),
      ]
    );

    const updatedOrder = await dbGet('SELECT * FROM orders WHERE id = ?', [orderId]);
    res.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao pagar o fornecedor.' });
  }
});

// AÇÃO: Marcar como Entregue
app.post('/api/orders/:id/mark-delivered', authenticateToken, async (req, res) => {
  const orderId = Number(req.params.id);
  try {
    const order = await dbGet('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      return res.status(404).json({ error: 'Encomenda não encontrada.' });
    }

    await dbRun(
      `UPDATE orders SET purchase_status = 'delivered', updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), orderId]
    );

    await dbRun(
      'INSERT INTO tracking (order_id, status, raw_source, created_at) VALUES (?, ?, ? ,?)',
      [orderId, 'Produto entregue ao destinatário em Moçambique.', 'Pallas Last Mile Delivery', new Date().toISOString()]
    );

    const updatedOrder = await dbGet('SELECT * FROM orders WHERE id = ?', [orderId]);
    res.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao marcar entrega.' });
  }
});

// Obter Finanças
app.get('/api/financials', authenticateToken, async (_req, res) => {
  try {
    const balance = await dbGet('SELECT balance_mzn, balance_usdt FROM financials WHERE id = 1');
    const transactions = await dbAll('SELECT * FROM transactions ORDER BY id DESC LIMIT 50');

    const margins = await dbAll(`
      SELECT id as order_id, 
             (amount_mzn * 0.2) as margin_mzn, 
             20.0 as margin_pct 
      FROM orders 
      WHERE payment_status = 'paid'
    `);

    res.json({
      balance_mzn: balance ? balance.balance_mzn : 0,
      balance_usdt: balance ? balance.balance_usdt : 0,
      transactions: transactions || [],
      margins: margins || [],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar dados financeiros.' });
  }
});

// Conversão Manual MZN -> USDT
app.post('/api/finance/convert', authenticateToken, async (req, res) => {
  const { amount_mzn } = req.body;
  if (!amount_mzn || amount_mzn <= 0) {
    return res.status(400).json({ error: 'Valor em MZN inválido.' });
  }

  try {
    const financials = await dbGet('SELECT * FROM financials WHERE id = 1');
    if (financials.balance_mzn < amount_mzn) {
      return res.status(400).json({ error: 'Saldo em MZN insuficiente.' });
    }

    const exchange_rate = 63.5;
    const amount_usdt = Number((amount_mzn / exchange_rate).toFixed(2));

    await dbRun(
      'UPDATE financials SET balance_mzn = balance_mzn - ?, balance_usdt = balance_usdt + ? WHERE id = 1',
      [amount_mzn, amount_usdt]
    );

    const binanceTxId = `bnb-manual-${Math.floor(100000 + Math.random() * 900000)}`;
    await dbRun(
      `INSERT INTO conversions (amount_mzn, amount_usdt, exchange_rate, binance_tx_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [amount_mzn, amount_usdt, exchange_rate, binanceTxId, 'completed', new Date().toISOString()]
    );

    await dbRun(
      'INSERT INTO transactions (type, amount_mzn, amount_usdt, exchange_rate, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ['conversion', amount_mzn, amount_usdt, exchange_rate, 'completed', new Date().toISOString()]
    );

    const updatedBalance = await dbGet('SELECT balance_mzn, balance_usdt FROM financials WHERE id = 1');
    res.json({ success: true, balance: updatedBalance });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao realizar conversão.' });
  }
});

// Listar Fornecedores
app.get('/api/suppliers', authenticateToken, async (_req, res) => {
  try {
    const suppliers = await dbAll('SELECT * FROM suppliers');
    const result = [];

    for (const sup of suppliers) {
      const products = await dbAll('SELECT id as wc_product_id, supplier_sku, cost_usdt, name FROM products WHERE supplier = ?', [sup.slug]);
      result.push({
        ...sup,
        api_supported: !!sup.api_supported,
        products: products || [],
      });
    }

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar fornecedores.' });
  }
});

// Listar Conversões
app.get('/api/conversions', authenticateToken, async (_req, res) => {
  try {
    const conversions = await dbAll('SELECT * FROM conversions ORDER BY id DESC');
    res.json(conversions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar conversões.' });
  }
});

// Listar Rastreio
app.get('/api/tracking', authenticateToken, async (_req, res) => {
  try {
    const tracking = await dbAll('SELECT * FROM tracking ORDER BY id DESC');
    res.json(tracking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar logs de tracking.' });
  }
});

// Listar Notificações
app.get('/api/notifications', authenticateToken, async (_req, res) => {
  try {
    const notifications = await dbAll('SELECT * FROM notifications ORDER BY id DESC');
    res.json(notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar notificações.' });
  }
});

// Listar Utilizadores
app.get('/api/users', authenticateToken, async (_req, res) => {
  try {
    const users = await dbAll('SELECT id, name, email, role, status, created_at FROM users');
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar gestores.' });
  }
});

// Lojas (Obter e Atualizar)
app.get('/api/stores', authenticateToken, async (_req, res) => {
  try {
    const stores = await dbAll('SELECT * FROM stores ORDER BY id DESC');
    res.json(stores);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar lojas.' });
  }
});

app.post('/api/stores', authenticateToken, async (req, res) => {
  const { id, name, type, api_url, consumer_key, consumer_secret, status, country, notes } = req.body;
  try {
    if (id) {
      // Atualizar loja existente
      await dbRun(
        `UPDATE stores 
         SET name = ?, type = ?, api_url = ?, consumer_key = ?, consumer_secret = ?, status = ?, country = ?, notes = ? 
         WHERE id = ?`,
        [name, type, api_url, consumer_key, consumer_secret, status, country, notes, id]
      );
      const updatedStore = await dbGet('SELECT * FROM stores WHERE id = ?', [id]);
      res.json(updatedStore);
    } else {
      // Inserir nova loja
      const result = await dbRun(
        `INSERT INTO stores (name, type, api_url, consumer_key, consumer_secret, status, country, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name || 'Loja Nova',
          type || 'woocommerce',
          api_url || '',
          consumer_key || '',
          consumer_secret || '',
          status || 'active',
          country || 'MZ',
          notes || '',
          new Date().toISOString(),
        ]
      );
      const newStore = await dbGet('SELECT * FROM stores WHERE id = ?', [result.lastID]);
      res.status(201).json(newStore);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao salvar loja.' });
  }
});

// Gateways
app.get('/api/gateways', authenticateToken, async (_req, res) => {
  try {
    const gateways = await dbAll('SELECT * FROM gateways ORDER BY id DESC');
    res.json(gateways);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar gateways.' });
  }
});

app.post('/api/gateways', authenticateToken, async (req, res) => {
  const { name, provider, api_url, client_id, client_secret, status, notes } = req.body;
  try {
    const result = await dbRun(
      `INSERT INTO gateways (name, provider, api_url, client_id, client_secret, status, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name || 'Gateway Novo',
        provider || 'mpesa',
        api_url || '',
        client_id || '',
        client_secret || '',
        status || 'active',
        notes || '',
        new Date().toISOString(),
      ]
    );
    const newGateway = await dbGet('SELECT * FROM gateways WHERE id = ?', [result.lastID]);
    res.status(201).json(newGateway);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar gateway.' });
  }
});

// Relatórios
app.get('/api/reports/top-products', authenticateToken, async (_req, res) => {
  try {
    const topProducts = await dbAll(`
      SELECT product_id, product_name, supplier, COUNT(*) as sold_count, SUM(amount_mzn) as total_mzn, SUM(amount_usdt) as total_usdt
      FROM orders
      GROUP BY product_id, product_name, supplier
      ORDER BY sold_count DESC
      LIMIT 8
    `);
    res.json(topProducts || []);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao gerar relatório.' });
  }
});

// Inicializar Servidor
app.listen(PORT, () => {
  console.log(`Servidor backend SQLite + WooCommerce a correr em http://localhost:${PORT}`);
});
