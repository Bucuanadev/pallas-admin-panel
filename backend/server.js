const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const dataDir = path.join(__dirname, 'data');

function readJson(fileName, fallback = []) {
  const filePath = path.join(dataDir, fileName);
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`Erro ao ler ${fileName}:`, error.message);
    return fallback;
  }
}

function writeJson(fileName, data) {
  const filePath = path.join(dataDir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function productName(order) {
  return order.product_name || `Produto ${order.product_id}`;
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'pallas-admin-panel' });
});

app.get('/api/orders', (_req, res) => {
  const orders = readJson('orders.json', []);
  res.json(orders);
});

app.post('/api/orders', (req, res) => {
  const orders = readJson('orders.json', []);
  const newOrder = {
    id: Date.now(),
    wc_order_id: req.body.wc_order_id || `wc-${Date.now()}`,
    product_id: req.body.product_id || 101,
    product_name: req.body.product_name || `Produto ${req.body.product_id || 101}`,
    supplier: req.body.supplier || 'cj_dropshipping',
    store_id: req.body.store_id || 1,
    gateway_id: req.body.gateway_id || 1,
    customer_name: req.body.customer_name || 'Cliente novo',
    phone: req.body.phone || '+258 84 000 0000',
    email: req.body.email || 'cliente@example.com',
    amount_mzn: req.body.amount_mzn || 0,
    amount_usdt: req.body.amount_usdt || 0,
    payment_status: req.body.payment_status || 'paid',
    purchase_status: req.body.purchase_status || 'awaiting_purchase',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  orders.unshift(newOrder);
  writeJson('orders.json', orders);
  res.status(201).json(newOrder);
});

app.post('/api/orders/:id/mark-received', (req, res) => {
  const orderId = Number(req.params.id);
  const orders = readJson('orders.json', []);
  const notifications = readJson('notifications.json', []);
  const order = orders.find((item) => item.id === orderId);

  if (!order) {
    return res.status(404).json({ error: 'Pedido não encontrado' });
  }

  order.purchase_status = 'purchased';
  order.updated_at = new Date().toISOString();

  const notificationEntry = {
    id: Date.now(),
    order_id: order.id,
    channel: 'email',
    status: 'sent',
    sent_at: new Date().toISOString(),
    message: 'Compra recebida da loja e notificação enviada ao operador'
  };

  notifications.unshift(notificationEntry);
  writeJson('orders.json', orders);
  writeJson('notifications.json', notifications);

  res.json({ order, notification: notificationEntry });
});

app.get('/api/financials', (_req, res) => {
  const financials = readJson('financials.json', []);
  res.json(financials);
});

app.get('/api/suppliers', (_req, res) => {
  const suppliers = readJson('suppliers.json', []);
  res.json(suppliers);
});

app.get('/api/conversions', (_req, res) => {
  const conversions = readJson('conversions.json', []);
  res.json(conversions);
});

app.get('/api/tracking', (_req, res) => {
  const tracking = readJson('tracking.json', []);
  res.json(tracking);
});

app.get('/api/notifications', (_req, res) => {
  const notifications = readJson('notifications.json', []);
  res.json(notifications);
});

app.get('/api/users', (_req, res) => {
  const users = readJson('users.json', []);
  res.json(users);
});

app.get('/api/stores', (_req, res) => {
  const stores = readJson('stores.json', []);
  res.json(stores);
});

app.post('/api/stores', (req, res) => {
  const stores = readJson('stores.json', []);
  const newStore = {
    id: Date.now(),
    name: req.body.name || 'Loja nova',
    type: req.body.type || 'woocommerce',
    api_url: req.body.api_url || '',
    consumer_key: req.body.consumer_key || '',
    consumer_secret: req.body.consumer_secret || '',
    status: req.body.status || 'active',
    country: req.body.country || 'MZ',
    notes: req.body.notes || '',
    created_at: new Date().toISOString(),
  };

  stores.unshift(newStore);
  writeJson('stores.json', stores);
  res.status(201).json(newStore);
});

app.get('/api/gateways', (_req, res) => {
  const gateways = readJson('gateways.json', []);
  res.json(gateways);
});

app.post('/api/gateways', (req, res) => {
  const gateways = readJson('gateways.json', []);
  const newGateway = {
    id: Date.now(),
    name: req.body.name || 'Gateway novo',
    provider: req.body.provider || 'mpesa',
    api_url: req.body.api_url || '',
    client_id: req.body.client_id || '',
    client_secret: req.body.client_secret || '',
    status: req.body.status || 'active',
    notes: req.body.notes || '',
    created_at: new Date().toISOString(),
  };

  gateways.unshift(newGateway);
  writeJson('gateways.json', gateways);
  res.status(201).json(newGateway);
});

app.get('/api/reports/top-products', (_req, res) => {
  const orders = readJson('orders.json', []);
  const map = {};
  orders.forEach((order) => {
    const key = `${order.product_id}|${order.product_name}`;
    if (!map[key]) {
      map[key] = {
        product_id: order.product_id,
        product_name: productName(order),
        supplier: order.supplier,
        sold_count: 0,
        total_mzn: 0,
        total_usdt: 0,
      };
    }
    map[key].sold_count += 1;
    map[key].total_mzn += Number(order.amount_mzn || 0);
    map[key].total_usdt += Number(order.amount_usdt || 0);
  });
  const topProducts = Object.values(map)
    .sort((a, b) => b.sold_count - a.sold_count)
    .slice(0, 8);

  res.json(topProducts);
});

app.listen(PORT, () => {
  console.log(`Servidor backend a correr em http://localhost:${PORT}`);
});
