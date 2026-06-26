const { dbRun, dbGet, dbAll } = require('./database');

// Função auxiliar para codificar em Base64 para autenticação Basic
function getBasicAuthHeader(consumerKey, consumerSecret) {
  const creds = `${consumerKey}:${consumerSecret}`;
  return `Basic ${Buffer.from(creds).toString('base64')}`;
}

// Criar produto no WooCommerce
async function createWooCommerceProduct(store, productData) {
  if (!store || !store.api_url || !store.consumer_key || store.consumer_key.startsWith('ck_demo')) {
    console.log('Utilizando modo demo ou sem credenciais reais do WooCommerce. Ignorando sincronização externa.');
    return { id: `demo-${Date.now()}` };
  }

  // Sanitizar API URL para garantir que termina com /
  let apiUrl = store.api_url;
  if (!apiUrl.endsWith('/')) {
    apiUrl += '/';
  }

  const endpoint = `${apiUrl}products`;
  const authHeader = getBasicAuthHeader(store.consumer_key, store.consumer_secret);

  const payload = {
    name: productData.name,
    type: 'simple',
    regular_price: String(productData.price_mzn),
    description: productData.description || '',
    short_description: productData.description || '',
    sku: productData.supplier_sku,
    manage_stock: true,
    stock_quantity: Number(productData.stock),
    images: productData.image_url ? [{ src: productData.image_url }] : []
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'Pallas Admin Client/1.0'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`WooCommerce API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    console.log(`Produto sincronizado com WooCommerce. ID WooCommerce: ${data.id}`);
    return data;
  } catch (error) {
    console.error('Erro ao sincronizar produto com WooCommerce:', error.message);
    throw error;
  }
}

// Sincronizar ordens do WooCommerce
async function syncWooCommerceOrders(store) {
  if (!store || !store.api_url || !store.consumer_key || store.consumer_key.startsWith('ck_demo')) {
    console.log('WooCommerce em modo demo ou sem chaves configuradas. Sincronização ignorada.');
    return { synced: 0, message: 'WooCommerce em modo demonstração.' };
  }

  let apiUrl = store.api_url;
  if (!apiUrl.endsWith('/')) {
    apiUrl += '/';
  }

  // Buscar encomendas no estado 'processing' ou 'completed' (pagas)
  const endpoint = `${apiUrl}orders?per_page=20&status=processing,completed`;
  const authHeader = getBasicAuthHeader(store.consumer_key, store.consumer_secret);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'Pallas Admin Client/1.0'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`WooCommerce API Error (${response.status}): ${errText}`);
    }

    const wcOrders = await response.json();
    let syncCount = 0;

    for (const wcOrder of wcOrders) {
      // Verificar se a ordem já existe localmente
      const existing = await dbGet('SELECT * FROM orders WHERE wc_order_id = ?', [String(wcOrder.id)]);
      if (existing) {
        continue;
      }

      // Detalhes do item comprado (pegar o primeiro item)
      const item = wcOrder.line_items?.[0] || {};
      const product_id = item.product_id || 0;
      const product_name = item.name || 'Produto WooCommerce';

      // Buscar produto correspondente na nossa BD local para preencher custo USDT e fornecedor
      // Se não achar, preencher valores padrão (AliExpress / custo = 0)
      let cost_usdt = 0;
      let supplier = 'aliexpress';

      // Tenta achar pelo SKU ou pelo nome
      let localProduct = await dbGet('SELECT * FROM products WHERE supplier_sku = ? OR name = ?', [item.sku, item.name]);
      if (localProduct) {
        cost_usdt = localProduct.cost_usdt;
        supplier = localProduct.supplier;
      }

      const customer_name = `${wcOrder.billing?.first_name || ''} ${wcOrder.billing?.last_name || ''}`.trim() || 'Cliente WooCommerce';
      const phone = wcOrder.billing?.phone || '+258 84 000 0000';
      const email = wcOrder.billing?.email || 'cliente@example.com';
      const amount_mzn = Number(wcOrder.total || 0);

      // Inserir na tabela de ordens
      const result = await dbRun(
        `INSERT INTO orders 
        (wc_order_id, product_id, product_name, customer_name, phone, email, amount_mzn, amount_usdt, payment_status, purchase_status, supplier, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          String(wcOrder.id),
          product_id,
          product_name,
          customer_name,
          phone,
          email,
          amount_mzn,
          cost_usdt,
          'paid', // Encomendas 'processing' ou 'completed' já estão pagas
          'awaiting_conversion', // Próxima etapa no pipeline
          supplier,
          new Date(wcOrder.date_created).toISOString() || new Date().toISOString(),
          new Date().toISOString()
        ]
      );

      const newOrderId = result.lastID;

      // Incrementar saldo MZN em financials
      await dbRun('UPDATE financials SET balance_mzn = balance_mzn + ? WHERE id = 1', [amount_mzn]);

      // Registar transação
      await dbRun(
        'INSERT INTO transactions (type, amount_mzn, amount_usdt, status, created_at) VALUES (?, ?, ?, ?, ?)',
        ['sale', amount_mzn, 0, 'completed', new Date().toISOString()]
      );

      // Criar tracking log
      await dbRun(
        'INSERT INTO tracking (order_id, status, raw_source) VALUES (?, ?, ?)',
        [newOrderId, 'Importado da WooCommerce API. Pagamento confirmado.', 'WooCommerce Webhook Sync']
      );

      // Criar notificação
      await dbRun(
        'INSERT INTO notifications (order_id, channel, status, message, sent_at) VALUES (?, ?, ?, ?, ?)',
        [
          newOrderId,
          'system',
          'sent',
          `Nova encomenda #${wcOrder.id} sincronizada da loja. Cliente: ${customer_name}.`,
          new Date().toISOString()
        ]
      );

      syncCount++;
    }

    return { synced: syncCount, message: `Sincronização concluída. ${syncCount} novas encomendas importadas.` };
  } catch (error) {
    console.error('Erro na sincronização WooCommerce:', error.message);
    throw error;
  }
}

module.exports = {
  createWooCommerceProduct,
  syncWooCommerceOrders
};
