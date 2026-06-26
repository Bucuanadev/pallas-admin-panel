import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

const API_BASE = '/api';

const PIPELINE_STAGES = [
  { key: 'paid', label: 'Pago' },
  { key: 'awaiting_conversion', label: 'A Converter' },
  { key: 'awaiting_purchase', label: 'A Comprar' },
  { key: 'purchased', label: 'Em trânsito' },
  { key: 'delivered', label: 'Entregue' }
];

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

function StagePill({ stage }) {
  const currentIndex = PIPELINE_STAGES.findIndex((item) => item.key === stage);
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;

  return (
    <div className="flex items-center gap-3 overflow-x-auto rounded-3xl border border-white/10 bg-slate-950/70 px-3 py-3 text-[0.82rem] text-slate-300">
      {PIPELINE_STAGES.map((item, index) => {
        const isActive = index === activeIndex;
        const isDone = index <= activeIndex;
        return (
          <div key={item.key} className="flex items-center gap-2 min-w-[100px]">
            <div className={classNames(
              'relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
              isDone ? 'border-[#E8B73B] bg-[#E8B73B]/20 text-[#F5F1E8]' : 'border-white/10 bg-white/5 text-slate-400'
            )}>
              <span>{index + 1}</span>
            </div>
            <div>
              <p className={classNames('font-semibold text-[0.78rem]', isActive ? 'text-[#E8B73B]' : 'text-slate-300')}>{item.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ title, value, tone = 'gold', subtitle }) {
  const toneClass = {
    gold: 'from-[#E8B73B]/20 to-[#F4D06F]/10 text-[#F5F1E8]',
    red: 'from-[#E0524A]/20 to-[#E0524A]/10 text-[#F5F1E8]',
    white: 'from-white/5 to-white/10 text-[#F5F1E8]'
  }[tone];

  return (
    <div className={`rounded-3xl border border-white/10 bg-gradient-to-br ${toneClass} p-5 shadow-2xl`}>
      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{title}</p>
      <p className="mt-3 text-3xl font-semibold text-[#F5F1E8]">{value}</p>
      {subtitle && <p className="mt-2 text-xs text-slate-300">{subtitle}</p>}
    </div>
  );
}

function SummaryBlock({ label, children }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-xl">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <div className="mt-3 text-[#F5F1E8]">{children}</div>
    </div>
  );
}

// COMPONENTE BOTÃO DE SINCRONIZAÇÃO WOOCOMMERCE
function SyncButton({ onSyncComplete }) {
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');

  const handleSync = async () => {
    setSyncing(true);
    setMessage('');
    try {
      const response = await fetch(`${API_BASE}/stores/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(data.message || 'Sincronização concluída!');
        onSyncComplete();
      } else {
        setMessage(`Erro: ${data.error}`);
      }
    } catch (error) {
      setMessage('Falha ao conectar para sincronização.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-col gap-1 items-end">
      <button
        onClick={handleSync}
        disabled={syncing}
        className={classNames(
          "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition shadow-md",
          syncing 
            ? "bg-slate-800 text-slate-400 cursor-not-allowed" 
            : "bg-[#E8B73B] hover:bg-[#F4D06F] text-[#0B0B0C]"
        )}
      >
        {syncing ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
            A Sincronizar WooCommerce...
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 6H16m0 0v5h5" /></svg>
            Sincronizar Encomendas
          </>
        )}
      </button>
      {message && (
        <span className={classNames(
          "text-[10px] font-semibold mt-1",
          message.startsWith('Erro') || message.startsWith('Falha') ? "text-rose-400" : "text-emerald-400"
        )}>
          {message}
        </span>
      )}
    </div>
  );
}

// DASHBOARD
function DashboardPage({ orders, financials, stores, gateways, reports, onSyncComplete }) {
  const summary = useMemo(() => {
    const paid = orders.filter((order) => order.payment_status === 'paid').length;
    const awaitingConversion = orders.filter((order) => order.purchase_status === 'awaiting_conversion').length;
    const awaitingPurchase = orders.filter((order) => order.purchase_status === 'awaiting_purchase').length;
    const purchased = orders.filter((order) => order.purchase_status === 'purchased').length;
    const delivered = orders.filter((order) => order.purchase_status === 'delivered').length;
    return { paid, awaitingConversion, awaitingPurchase, purchased, delivered };
  }, [orders]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#F5F1E8]">Visão Geral</h2>
          <p className="text-xs text-slate-400">Dados consolidados do fulfillment da pallas.shop.</p>
        </div>
        <SyncButton onSyncComplete={onSyncComplete} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Encomendas Pagas" value={summary.paid} />
        <StatCard title="Falta Converter MZN" value={summary.awaitingConversion} tone="red" />
        <StatCard title="Falta Comprar Fornec." value={summary.awaitingPurchase} tone="white" />
        <StatCard title="Enviados / Entregues" value={`${summary.purchased} / ${summary.delivered}`} tone="gold" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#F5F1E8]">Resumo Operacional</h2>
              <p className="mt-1 text-xs text-slate-400">Fluxo financeiro e canais integrados.</p>
            </div>
            <Link to="/orders" className="inline-flex items-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 px-4 py-2 text-xs font-semibold text-white transition">
              Gerir Encomendas
            </Link>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <SummaryBlock label="Saldo em Caixa MZN">MZN {financials.balance_mzn?.toLocaleString()}</SummaryBlock>
            <SummaryBlock label="Fundo de Compras USDT">{financials.balance_usdt} USDT</SummaryBlock>
            <SummaryBlock label="Lojas Conectadas">{stores.length}</SummaryBlock>
            <SummaryBlock label="Gateways de Pagamento">{gateways.length}</SummaryBlock>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
          <h2 className="text-lg font-semibold text-[#F5F1E8]">Top Vendas</h2>
          <p className="mt-2 text-xs text-slate-400">Produtos mais vendidos importados.</p>
          <div className="mt-4 space-y-3">
            {reports.slice(0, 4).map((item, idx) => (
              <div key={idx} className="rounded-2xl border border-white/10 bg-[#0E0E10] p-4 flex justify-between items-center">
                <div>
                  <p className="font-semibold text-xs text-[#F5F1E8]">{item.product_name}</p>
                  <p className="mt-1 text-[10px] text-slate-400">{item.supplier.toUpperCase()}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs text-[#E8B73B]">{item.sold_count} un</p>
                  <p className="text-[10px] text-slate-500">{item.total_mzn.toLocaleString()} MZN</p>
                </div>
              </div>
            ))}
            {reports.length === 0 && <p className="text-xs text-slate-500 text-center py-4">Nenhuma venda registada.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// PEDIDOS / ENCOMENDAS
function OrdersPage({ orders, financials, onActionComplete }) {
  const [actionMessage, setActionMessage] = useState('');
  const [loadingId, setLoadingId] = useState(null);

  const triggerAction = async (orderId, endpoint) => {
    setLoadingId(orderId);
    setActionMessage('');
    try {
      const response = await fetch(`${API_BASE}/orders/${orderId}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (response.ok) {
        setActionMessage(`Operação efetuada com sucesso.`);
        onActionComplete();
      } else {
        setActionMessage(`Erro: ${data.error || 'Falha ao processar.'}`);
      }
    } catch (error) {
      setActionMessage('Erro de ligação ao servidor.');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#F5F1E8]">Pipeline de Fulfillment</h2>
          <p className="text-xs text-slate-400">Ordens importadas do WooCommerce. Execute as conversões e pagamentos.</p>
        </div>
        <div className="flex items-center gap-4">
          <SyncButton onSyncComplete={onActionComplete} />
        </div>
      </div>

      {actionMessage && (
        <div className="mb-4 rounded-xl bg-slate-900 border border-[#E8B73B]/30 p-3 text-xs text-slate-200">
          {actionMessage}
        </div>
      )}

      <div className="space-y-5">
        {orders.map((order) => (
          <div key={order.id} className="rounded-3xl border border-white/10 bg-[#0B0B0C]/95 p-5 shadow-inner shadow-black/20">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono uppercase text-[#E8B73B]">Pedido #{order.wc_order_id}</span>
                  <span className="text-[10px] bg-white/5 border border-white/10 rounded-full px-2 py-0.5 text-slate-400 uppercase">{order.supplier}</span>
                </div>
                <p className="mt-2 text-lg font-semibold text-[#F5F1E8]">{order.customer_name}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {order.product_name} • Contacto: {order.phone} • {order.email}
                </p>
                {order.tracking_number && (
                  <p className="mt-1.5 text-xs text-emerald-400 font-mono">
                    Rastreamento: {order.tracking_number} (Ref Forn: {order.supplier_order_id})
                  </p>
                )}
              </div>
              <div className="flex flex-col sm:items-start lg:items-end gap-2">
                <div className="text-left lg:text-right">
                  <p className="text-[10px] text-slate-400">Valor Recebido</p>
                  <p className="text-xl font-semibold text-[#F5F1E8]">MZN {order.amount_mzn.toLocaleString()}</p>
                  <p className="text-[11px] text-slate-500">Custo Fornec.: {order.amount_usdt} USDT</p>
                </div>

                <div className="mt-2">
                  {loadingId === order.id ? (
                    <span className="text-xs text-slate-400 animate-pulse">A processar...</span>
                  ) : (
                    <>
                      {order.purchase_status === 'awaiting_conversion' && (
                        <button
                          onClick={() => triggerAction(order.id, 'convert-usdt')}
                          className="rounded-full bg-[#E8B73B] hover:bg-[#F4D06F] text-[#0B0B0C] px-4 py-1.5 text-xs font-bold transition"
                        >
                          Aprovar Conversão MZN ({order.amount_usdt} USDT)
                        </button>
                      )}
                      {order.purchase_status === 'awaiting_purchase' && (
                        <button
                          onClick={() => triggerAction(order.id, 'pay-supplier')}
                          className="rounded-full bg-emerald-500 hover:bg-emerald-400 text-[#0B0B0C] px-4 py-1.5 text-xs font-bold transition"
                        >
                          Pagar no AliExpress ({order.amount_usdt} USDT)
                        </button>
                      )}
                      {order.purchase_status === 'purchased' && (
                        <button
                          onClick={() => triggerAction(order.id, 'mark-delivered')}
                          className="rounded-full bg-blue-500 hover:bg-blue-400 text-white px-4 py-1.5 text-xs font-bold transition"
                        >
                          Marcar como Entregue
                        </button>
                      )}
                      {order.purchase_status === 'delivered' && (
                        <span className="text-xs text-emerald-400 font-semibold">✓ Concluído</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5">
              <StagePill stage={order.purchase_status} />
            </div>
          </div>
        ))}
        {orders.length === 0 && <p className="text-xs text-slate-500 text-center py-8">Nenhuma encomenda na base de dados. Clique em "Sincronizar" acima para importar.</p>}
      </div>
    </div>
  );
}

// GESTÃO DE PRODUTOS
function ProductsPage({ products, onActionComplete }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priceMzn, setPriceMzn] = useState('');
  const [costUsdt, setCostUsdt] = useState('');
  const [supplier, setSupplier] = useState('cj_dropshipping');
  const [supplierSku, setSupplierSku] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [stock, setStock] = useState('100');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const calculatedPriceMzn = useMemo(() => {
    if (!costUsdt) return '';
    const rate = 63.5;
    const markup = 1.25;
    return Math.round(Number(costUsdt) * rate * markup);
  }, [costUsdt]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    const finalPrice = priceMzn || calculatedPriceMzn;

    const payload = {
      name,
      description,
      price_mzn: Number(finalPrice),
      cost_usdt: Number(costUsdt),
      supplier,
      supplier_sku: supplierSku,
      image_url: imageUrl,
      stock: Number(stock)
    };

    try {
      const response = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (response.ok) {
        if (data.sync_status === 'synced') {
          setMessage('Produto criado localmente e enviado para a pallas.shop real!');
        } else if (data.sync_status === 'sync_failed') {
          setMessage(`Salvo localmente. Erro ao sincronizar com site: ${data.sync_error}`);
        } else {
          setMessage('Produto registado com sucesso (modo local/demo).');
        }
        setName('');
        setDescription('');
        setPriceMzn('');
        setCostUsdt('');
        setSupplierSku('');
        setImageUrl('');
        setStock('100');
        onActionComplete();
      } else {
        setMessage(`Erro: ${data.error}`);
      }
    } catch (err) {
      setMessage('Erro ao salvar produto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover o produto local? Nota: não apagará no WooCommerce de produção.')) return;
    try {
      const response = await fetch(`${API_BASE}/products/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        onActionComplete();
      }
    } catch (err) {
      alert('Erro ao remover produto.');
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-[#F5F1E8] mb-2">Produtos Mapeados</h2>
        <p className="text-xs text-slate-400">Produtos locais usados para cruzar SKUs e prever custos USDT de fornecedores.</p>

        <div className="mt-6 space-y-4">
          {products.map((prod) => (
            <div key={prod.id} className="rounded-2xl border border-white/10 bg-[#0B0B0C]/90 p-4 flex gap-4 items-center justify-between">
              <div className="flex gap-4 items-center">
                <img src={prod.image_url} alt={prod.name} className="w-14 h-14 object-cover rounded-xl border border-white/10 bg-slate-900" />
                <div>
                  <p className="font-semibold text-xs text-[#F5F1E8]">{prod.name}</p>
                  <p className="text-[10px] text-slate-400">{prod.supplier.toUpperCase()} • SKU: {prod.supplier_sku}</p>
                  <p className="text-[10px] text-[#E8B73B]">Stock: {prod.stock} un • Custo: {prod.cost_usdt} USDT</p>
                </div>
              </div>
              <div className="text-right flex flex-col items-end gap-2">
                <p className="font-semibold text-xs text-[#F5F1E8]">MZN {prod.price_mzn.toLocaleString()}</p>
                <button
                  onClick={() => handleDelete(prod.id)}
                  className="text-[10px] text-red-400 hover:text-red-300 font-semibold"
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl h-fit">
        <h2 className="text-lg font-bold text-[#F5F1E8]">Adicionar & Enviar Produto</h2>
        <p className="text-xs text-slate-400 mt-1">Cria o produto na base local e tenta publicá-lo automaticamente na loja WordPress real.</p>

        <form onSubmit={handleCreate} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">Nome do Produto *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0B0B0C] px-3.5 py-2.5 text-xs text-white outline-none" placeholder="Ex: Smartwatch Ultra" />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1.5">Descrição</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0B0B0C] px-3.5 py-2.5 text-xs text-white outline-none h-16 resize-none" placeholder="Detalhes..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1.5">Custo (USDT) *</label>
              <input required type="number" step="0.01" value={costUsdt} onChange={(e) => setCostUsdt(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0B0B0C] px-3.5 py-2.5 text-xs text-white outline-none" placeholder="10.50" />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1.5">Preço Venda (MZN)</label>
              <input type="number" value={priceMzn} onChange={(e) => setPriceMzn(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0B0B0C] px-3.5 py-2.5 text-xs text-white outline-none" placeholder={calculatedPriceMzn ? `${calculatedPriceMzn} (sugerido)` : 'Preço em Meticais'} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1.5">Fornecedor *</label>
              <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0B0B0C] px-3.5 py-2.5 text-xs text-white outline-none">
                <option value="cj_dropshipping">CJ Dropshipping</option>
                <option value="aliexpress">AliExpress</option>
                <option value="shein">Shein</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1.5">SKU Fornecedor *</label>
              <input required value={supplierSku} onChange={(e) => setSupplierSku(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0B0B0C] px-3.5 py-2.5 text-xs text-white outline-none" placeholder="ALI-990-WD" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1.5">URL Imagem</label>
              <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0B0B0C] px-3.5 py-2.5 text-xs text-white outline-none" placeholder="https://..." />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1.5">Stock Inicial</label>
              <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0B0B0C] px-3.5 py-2.5 text-xs text-white outline-none" />
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full rounded-xl bg-[#E8B73B] hover:bg-[#F4D06F] px-4 py-3 text-xs font-semibold text-[#0B0B0C] transition disabled:opacity-50">
            {isSubmitting ? 'A sincronizar...' : 'Publicar na Loja'}
          </button>

          {message && (
            <p className={classNames('text-xs text-center font-semibold mt-3', message.startsWith('Erro') || message.startsWith('Salvo localmente') ? 'text-rose-400' : 'text-emerald-400')}>
              {message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

// CONTROLO DE LOJAS (COM EDIÇÃO DE CREDENCIAIS REAIS)
function StoresPage({ stores, onActionComplete }) {
  const [editingStore, setEditingStore] = useState(null);
  const [name, setName] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [type, setType] = useState('woocommerce');
  const [message, setMessage] = useState('');

  const handleEdit = (store) => {
    setEditingStore(store);
    setName(store.name);
    setApiUrl(store.api_url);
    setConsumerKey(store.consumer_key);
    setConsumerSecret(store.consumer_secret || '');
    setType(store.type);
    setMessage('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = {
      id: editingStore?.id || undefined,
      name,
      api_url: apiUrl,
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
      type,
      status: 'active',
      country: 'MZ'
    };

    try {
      const response = await fetch(`${API_BASE}/stores`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setMessage(editingStore ? 'Chaves de API atualizadas com sucesso!' : 'Nova loja conectada!');
        if (!editingStore) {
          setName('');
          setApiUrl('');
          setConsumerKey('');
          setConsumerSecret('');
        }
        setEditingStore(null);
        onActionComplete();
      } else {
        setMessage('Erro ao salvar as credenciais da loja.');
      }
    } catch (err) {
      setMessage('Erro de rede.');
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-[#F5F1E8] mb-2">Conexões WordPress/WooCommerce</h2>
        <p className="text-xs text-slate-400 mb-6">Chaves de API para leitura/escrita segura do e-commerce real.</p>
        <div className="space-y-4">
          {stores.map((store) => (
            <div key={store.id} className="rounded-2xl border border-white/10 bg-[#0B0B0C]/90 p-5 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-sm text-white">{store.name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Tipo: {store.type.toUpperCase()} • País: {store.country}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 text-[10px]">
                    {store.status.toUpperCase()}
                  </span>
                  <button
                    onClick={() => handleEdit(store)}
                    className="text-xs text-[#E8B73B] hover:underline font-semibold"
                  >
                    Editar Chaves
                  </button>
                </div>
              </div>
              <div className="text-xs text-slate-400 space-y-1 bg-slate-950/60 p-3 rounded-xl border border-white/5 font-mono">
                <p className="truncate">URL: {store.api_url}</p>
                <p>Consumer Key: {store.consumer_key ? `${store.consumer_key.substring(0, 10)}...` : 'Nenhum'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl h-fit">
        <h2 className="text-lg font-bold text-[#F5F1E8]">
          {editingStore ? 'Editar Chaves da Loja' : 'Conectar Nova Loja'}
        </h2>
        <p className="text-xs text-slate-400 mt-1">Insira chaves do WordPress (Leitura/Escrita) para habilitar sinc.</p>

        <form onSubmit={handleSave} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">Nome da Loja</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0B0B0C] px-3.5 py-2.5 text-xs text-white outline-none" placeholder="Ex: Pallas Moçambique" />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">API REST Endpoint</label>
            <input required value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0B0B0C] px-3.5 py-2.5 text-xs text-white outline-none" placeholder="https://pallas.shop/wp-json/wc/v3" />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">Consumer Key (ck_...)</label>
            <input required value={consumerKey} onChange={(e) => setConsumerKey(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0B0B0C] px-3.5 py-2.5 text-xs text-white outline-none" placeholder="ck_123456abcdef..." />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">Consumer Secret (cs_...)</label>
            <input required type="password" value={consumerSecret} onChange={(e) => setConsumerSecret(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0B0B0C] px-3.5 py-2.5 text-xs text-white outline-none" placeholder="cs_abcdef123456..." />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">Tipo CMS</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0B0B0C] px-3.5 py-2.5 text-xs text-white outline-none">
              <option value="woocommerce">WooCommerce (pallas.shop)</option>
              <option value="shopify">Shopify</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 rounded-xl bg-[#E8B73B] hover:bg-[#F4D06F] px-4 py-3 text-xs font-semibold text-[#0B0B0C] transition">
              {editingStore ? 'Gravar Alterações' : 'Conectar Loja'}
            </button>
            {editingStore && (
              <button type="button" onClick={() => setEditingStore(null)} className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-3 text-xs text-white transition">
                Cancelar
              </button>
            )}
          </div>
          {message && <p className="text-xs text-center text-emerald-400 font-semibold mt-2">{message}</p>}
        </form>
      </div>
    </div>
  );
}

// OUTRAS PÁGINAS MANTIDAS
function FinancePage({ financials, conversions, onActionComplete }) {
  const [amountMzn, setAmountMzn] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const exchangeRate = 63.5;

  const calculatedUsdt = useMemo(() => {
    if (!amountMzn || isNaN(amountMzn)) return 0;
    return Number((Number(amountMzn) / exchangeRate).toFixed(2));
  }, [amountMzn]);

  const handleConvert = async (e) => {
    e.preventDefault();
    if (!amountMzn || Number(amountMzn) <= 0) return;
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${API_BASE}/finance/convert`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount_mzn: Number(amountMzn) })
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(`Câmbio concluído: +${calculatedUsdt} USDT adicionados ao caixa.`);
        setAmountMzn('');
        onActionComplete();
      } else {
        setMessage(`Erro: ${data.error}`);
      }
    } catch (err) {
      setMessage('Erro ao efetuar conversão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-6">
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
          <h2 className="text-xl font-bold text-[#F5F1E8] mb-2">Controlo Financeiro</h2>
          <p className="text-xs text-slate-400">Verifique os fundos disponíveis em MZN (vendas locais) e USDT (compras AliExpress/CJ).</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <SummaryBlock label="Saldo em Caixa MZN">MZN {financials.balance_mzn?.toLocaleString()}</SummaryBlock>
            <SummaryBlock label="Fundo de Compras USDT">{financials.balance_usdt} USDT</SummaryBlock>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
          <h2 className="text-lg font-bold text-[#F5F1E8] mb-4">Histórico de Conversões (Câmbio)</h2>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
            {conversions.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-white/10 bg-[#0B0B0C]/90 p-4 flex justify-between items-center text-xs">
                <div>
                  <p className="font-semibold text-slate-200">
                    MZN {entry.amount_mzn.toLocaleString()} → {entry.amount_usdt} USDT
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">Taxa: {entry.exchange_rate} MZN/USDT • TXID: {entry.binance_tx_id}</p>
                </div>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 text-[10px]">
                  {entry.status.toUpperCase()}
                </span>
              </div>
            ))}
            {conversions.length === 0 && <p className="text-xs text-slate-500 text-center py-4">Nenhuma conversão registrada.</p>}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
          <h2 className="text-lg font-bold text-[#F5F1E8]">Comprar USDT (Câmbio Binance)</h2>
          <p className="mt-1 text-xs text-slate-400">Converta o saldo local em Meticais para USDT para efetuar o pagamento das encomendas no AliExpress.</p>

          <form onSubmit={handleConvert} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs text-slate-300 mb-1.5">Valor em MZN</label>
              <input required type="number" min="1" value={amountMzn} onChange={(e) => setAmountMzn(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0B0B0C] px-3.5 py-2.5 text-xs text-white outline-none" placeholder="Ex: 50000" />
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-3 text-xs text-slate-300 space-y-1">
              <div className="flex justify-between">
                <span>Taxa de Câmbio:</span>
                <span className="font-mono">{exchangeRate} MZN/USDT</span>
              </div>
              <div className="flex justify-between font-semibold text-white">
                <span>Irá Receber:</span>
                <span className="text-[#E8B73B] font-mono">{calculatedUsdt} USDT</span>
              </div>
            </div>

            <button type="submit" disabled={loading || !amountMzn} className="w-full rounded-xl bg-[#E8B73B] hover:bg-[#F4D06F] px-4 py-3 text-xs font-semibold text-[#0B0B0C] transition disabled:opacity-50">
              {loading ? 'A processar...' : 'Confirmar Conversão'}
            </button>

            {message && (
              <p className={classNames('text-xs text-center font-semibold mt-2', message.startsWith('Erro') ? 'text-rose-400' : 'text-emerald-400')}>
                {message}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

function GatewaysPage({ gateways }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
      <h2 className="text-xl font-bold text-[#F5F1E8] mb-2">Gateways de Recebimento</h2>
      <p className="text-xs text-slate-400 mb-6">Métodos ativos configurados para recepção automática em Meticais na pallas.shop.</p>
      <div className="space-y-4">
        {gateways.map((gt) => (
          <div key={gt.id} className="rounded-2xl border border-white/10 bg-[#0B0B0C]/90 p-4 flex justify-between items-center text-xs">
            <div>
              <p className="font-semibold text-slate-200">{gt.name}</p>
              <p className="text-[10px] text-slate-400">Provider: {gt.provider.toUpperCase()} • Endpoint: {gt.api_url}</p>
            </div>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 text-[10px]">
              {gt.status.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportsPage({ reports }) {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-[#F5F1E8]">Relatórios de Saídas</h2>
        <p className="mt-1 text-xs text-slate-400">Estatísticas acumuladas das compras realizadas no WooCommerce.</p>
      </div>
      <div className="rounded-3xl border border-white/10 bg-[#0B0B0C]/95 p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-[#F5F1E8] mb-4">Produtos Mais Vendidos</h3>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80">
          <table className="min-w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-[0.1em]">
              <tr>
                <th className="px-4 py-3.5">Produto</th>
                <th className="px-4 py-3.5">Fornecedor</th>
                <th className="px-4 py-3.5 text-center">Un. Vendidas</th>
                <th className="px-4 py-3.5 text-right">Total Faturado MZN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-[#0B0B0C]">
              {reports.map((item, idx) => (
                <tr key={idx} className="hover:bg-white/5 transition">
                  <td className="px-4 py-4 font-semibold text-[#F5F1E8]">{item.product_name}</td>
                  <td className="px-4 py-4 text-slate-400 uppercase">{item.supplier}</td>
                  <td className="px-4 py-4 font-mono text-center text-[#F5F1E8]">{item.sold_count}</td>
                  <td className="px-4 py-4 font-mono text-right text-[#E8B73B]">{item.total_mzn.toLocaleString()} MZN</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SuppliersPage({ suppliers }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
      <h2 className="text-xl font-bold text-[#F5F1E8] mb-2">Configuração de Fornecedores</h2>
      <p className="text-xs text-slate-400 mb-6">Mapeamento de Markup e conexões automatizadas de fulfillment.</p>
      <div className="space-y-4">
        {suppliers.map((supplier) => (
          <div key={supplier.id} className="rounded-3xl border border-white/10 bg-[#0B0B0C]/95 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-semibold text-[#F5F1E8]">{supplier.name}</p>
                <p className="text-xs text-slate-400">API Suportada: {supplier.api_supported ? 'Sim' : 'Não'}</p>
              </div>
              <span className="rounded-full border border-[#E8B73B]/30 bg-[#E8B73B]/10 px-3 py-1 text-xs font-semibold text-[#F5F1E8]">Markup Fornecedor: {supplier.default_markup_pct}%</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {supplier.products.map((product) => (
                <div key={product.wc_product_id} className="rounded-2xl border border-white/10 bg-slate-900/90 p-4">
                  <p className="text-[11px] text-slate-400">SKU: {product.supplier_sku}</p>
                  <p className="mt-1 font-semibold text-xs text-[#F5F1E8]">{product.name || 'Produto Sincronizado'}</p>
                  <p className="mt-1 text-xs text-slate-400">Preço de Custo: {product.cost_usdt} USDT</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrackingPage({ tracking, notifications }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-[#F5F1E8] mb-2">Logs de Rastreamento</h2>
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 mt-4">
          {tracking.map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-white/10 bg-[#0B0B0C]/90 p-4 text-xs">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-[#E8B73B]">Pedido #{entry.order_id}</span>
                <span className="text-[10px] text-slate-500">Fonte: {entry.raw_source}</span>
              </div>
              <p className="text-slate-300 mt-1">{entry.status}</p>
              <p className="text-[10px] text-slate-500 mt-1.5">Registado em: {new Date(entry.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-[#F5F1E8] mb-2">Auditoria de Notificações</h2>
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 mt-4">
          {notifications.map((notif) => (
            <div key={notif.id} className="rounded-2xl border border-white/10 bg-[#0B0B0C]/90 p-4 text-xs">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-slate-300">Pedido #{notif.order_id}</span>
                <span className="text-[10px] text-slate-500">Estado: {notif.status}</span>
              </div>
              <p className="text-slate-400 mt-1">{notif.message}</p>
              <p className="text-[9px] text-slate-500 mt-1">{new Date(notif.sent_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function UsersPage({ users }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
      <h2 className="text-xl font-bold text-[#F5F1E8] mb-2">Equipa de Gestão</h2>
      <p className="text-xs text-slate-400 mb-6">Operadores com acesso ao painel de fulfillment.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {users.map((user) => (
          <div key={user.id} className="rounded-2xl border border-white/10 bg-[#0B0B0C]/90 p-4 text-xs flex flex-col justify-between">
            <div>
              <p className="font-semibold text-sm text-[#F5F1E8]">{user.name}</p>
              <p className="text-slate-400 mt-1">{user.email}</p>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="rounded-full bg-[#E8B73B]/10 border border-[#E8B73B]/20 text-[#E8B73B] px-2.5 py-1 text-[10px] font-semibold uppercase">
                {user.role}
              </span>
              <span className="text-[10px] text-slate-500">Activo</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditPage() {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
      <h2 className="text-xl font-bold text-[#F5F1E8] mb-2">Auditoria e Segurança</h2>
      <div className="mt-6 rounded-2xl border border-white/10 bg-[#0B0B0C]/95 p-5 text-xs text-slate-400 space-y-3">
        <p>✓ Criptografia `bcryptjs` de 10 rodadas para senhas dos gestores no SQLite.</p>
        <p>✓ Proteção robusta contra webhooks WooCommerce inválidos via tokens JWT expirando em 24h.</p>
        <p>✓ Integridade de saldo garantida via transações SQLite para dedução de MZN e recarga de USDT.</p>
      </div>
    </div>
  );
}

// TELA DE LOGIN
function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState('marta@pallas.shop');
  const [password, setPassword] = useState('pallas123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        onLoginSuccess(data.token, data.user);
      } else {
        setError(data.error || 'Credenciais inválidas.');
      }
    } catch (err) {
      setError('Erro ao conectar ao servidor backend.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0B0C] px-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-[#E8B73B]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md rounded-[32px] border border-white/10 bg-[#0D0D0F]/90 p-8 shadow-2xl relative z-10">
        <div className="text-center">
          <div className="inline-grid h-16 w-16 place-items-center rounded-[24px] bg-[#E8B73B]/10 text-3xl font-bold text-[#E8B73B] border border-[#E8B73B]/20">P</div>
          <h1 className="mt-5 text-2xl font-bold text-[#F5F1E8]">Painel Administrativo</h1>
          <p className="mt-2 text-xs text-slate-400">Por favor, inicie sessão com a sua conta de operador Pallas.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="block text-xs text-slate-300 mb-2">E-mail Corporativo</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#0B0B0C] px-4.5 py-3 text-xs text-white outline-none focus:border-[#E8B73B]/50 transition"
              placeholder="operador@pallas.shop"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-2">Palavra-passe</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#0B0B0C] px-4.5 py-3 text-xs text-white outline-none focus:border-[#E8B73B]/50 transition"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-xs text-rose-400 font-semibold text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-[#E8B73B] hover:bg-[#F4D06F] px-4 py-3 text-xs font-bold text-[#0B0B0C] transition mt-2 disabled:opacity-50"
          >
            {loading ? 'A validar...' : 'Iniciar Sessão'}
          </button>
        </form>

        <div className="mt-6 border-t border-white/5 pt-4 text-center">
          <p className="text-[10px] text-slate-500">
            Acesso exclusivo para gestores autorizados.
          </p>
        </div>
      </div>
    </div>
  );
}

// COMPONENTE APP
function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);

  const [orders, setOrders] = useState([]);
  const [financials, setFinancials] = useState({ balance_mzn: 0, balance_usdt: 0, transactions: [] });
  const [suppliers, setSuppliers] = useState([]);
  const [conversions, setConversions] = useState([]);
  const [tracking, setTracking] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [gateways, setGateways] = useState([]);
  const [reports, setReports] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [ordersRes, financialsRes, suppliersRes, conversionsRes, trackingRes, notificationsRes, usersRes, storesRes, gatewaysRes, reportsRes, productsRes] = await Promise.all([
        fetch(`${API_BASE}/orders`, { headers }),
        fetch(`${API_BASE}/financials`, { headers }),
        fetch(`${API_BASE}/suppliers`, { headers }),
        fetch(`${API_BASE}/conversions`, { headers }),
        fetch(`${API_BASE}/tracking`, { headers }),
        fetch(`${API_BASE}/notifications`, { headers }),
        fetch(`${API_BASE}/users`, { headers }),
        fetch(`${API_BASE}/stores`, { headers }),
        fetch(`${API_BASE}/gateways`, { headers }),
        fetch(`${API_BASE}/reports/top-products`, { headers }),
        fetch(`${API_BASE}/products`, { headers }),
      ]);

      if (ordersRes.status === 401 || ordersRes.status === 403) {
        handleLogout();
        return;
      }

      const [ordersData, financialsData, suppliersData, conversionsData, trackingData, notificationsData, usersData, storesData, gatewaysData, reportsData, productsData] = await Promise.all([
        ordersRes.json(),
        financialsRes.json(),
        suppliersRes.json(),
        conversionsRes.json(),
        trackingRes.json(),
        notificationsRes.json(),
        usersRes.json(),
        storesRes.json(),
        gatewaysRes.json(),
        reportsRes.json(),
        productsRes.json(),
      ]);

      setOrders(ordersData);
      setFinancials(financialsData);
      setSuppliers(suppliersData);
      setConversions(conversionsData);
      setTracking(trackingData);
      setNotifications(notificationsData);
      setUsers(usersData);
      setStores(storesData);
      setGateways(gatewaysData);
      setReports(reportsData);
      setProducts(productsData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [token]);

  const handleLoginSuccess = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    navigate('/');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    navigate('/login');
  };

  if (!token) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const navItems = [
    { to: '/', label: 'Dashboard' },
    { to: '/orders', label: 'Encomendas' },
    { to: '/products', label: 'Produtos' },
    { to: '/stores', label: 'Lojas' },
    { to: '/gateways', label: 'Gateways' },
    { to: '/finance', label: 'Finanças' },
    { to: '/reports', label: 'Relatórios' },
    { to: '/suppliers', label: 'Fornecedores' },
    { to: '/tracking', label: 'Tracking' },
    { to: '/users', label: 'Operadores' },
    { to: '/audit', label: 'Auditoria' }
  ];

  return (
    <div className="min-h-screen bg-[#0B0B0C] text-[#F5F1E8]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row lg:px-6">
        {/* Sidebar */}
        <aside className="w-full rounded-[32px] border border-white/10 bg-[#0D0D0F]/90 p-5 shadow-2xl lg:w-72 flex flex-col justify-between h-fit lg:sticky lg:top-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-3xl bg-[#E8B73B]/15 text-2xl font-bold text-[#E8B73B] border border-[#E8B73B]/10">P</div>
              <div>
                <p className="text-sm font-semibold text-[#F5F1E8]">Pallas.shop</p>
                <p className="text-[11px] text-slate-400">Operações & Fulfillment</p>
              </div>
            </div>

            <nav className="mt-8 space-y-1.5">
              {navItems.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`flex items-center rounded-2xl px-4 py-3 text-xs font-medium transition ${isActive ? 'bg-[#E8B73B]/15 text-[#F5F1E8] font-semibold border border-[#E8B73B]/20' : 'text-slate-400 hover:bg-white/5 hover:text-[#F5F1E8]'}`}
                  >
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div className="mt-8 pt-4 border-t border-white/5 space-y-3">
            <div className="bg-[#0B0B0C] p-3 rounded-2xl border border-white/5 text-[11px]">
              <p className="text-slate-400">Operador activo:</p>
              <p className="font-semibold text-white mt-0.5 truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-500 uppercase font-semibold mt-1">{user?.role}</p>
            </div>

            <a 
              href="https://pallas.shop" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex justify-center items-center w-full rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs py-2.5 font-semibold text-white transition"
            >
              Ir para pallas.shop
            </a>

            <button onClick={handleLogout} className="w-full rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-xs py-2.5 font-semibold text-rose-400 transition">
              Terminar Sessão
            </button>
          </div>
        </aside>

        {/* Content Main */}
        <main className="flex-1 space-y-6">
          <header className="rounded-[32px] border border-white/10 bg-[#0D0D0F]/90 p-6 shadow-2xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.35em] text-[#E8B73B] font-bold">Painel do Gestor</p>
                <h1 className="mt-1 text-3xl font-bold text-[#F5F1E8] tracking-tight">Fulfillment Integrado</h1>
                <p className="mt-1 max-w-2xl text-xs text-slate-400">Importe pedidos reais via WooCommerce REST API, compre USDT na Binance e faça o fulfillment automático no AliExpress.</p>
              </div>
              <div className="rounded-[20px] border border-[#E8B73B]/20 bg-[#E8B73B]/5 px-4 py-2.5 text-xs font-semibold text-[#E8B73B] text-center">
                WooCommerce API Conectada • SQLite
              </div>
            </div>
          </header>

          {loading ? (
            <div className="rounded-[32px] border border-white/10 bg-[#0D0D0F]/90 p-12 text-center text-xs text-slate-400">
              A carregar painel operacional...
            </div>
          ) : (
            <Routes>
              <Route path="/" element={<DashboardPage orders={orders} financials={financials} stores={stores} gateways={gateways} reports={reports} onSyncComplete={loadData} />} />
              <Route path="/orders" element={<OrdersPage orders={orders} financials={financials} onActionComplete={loadData} />} />
              <Route path="/products" element={<ProductsPage products={products} onActionComplete={loadData} />} />
              <Route path="/stores" element={<StoresPage stores={stores} onActionComplete={loadData} />} />
              <Route path="/gateways" element={<GatewaysPage gateways={gateways} />} />
              <Route path="/finance" element={<FinancePage financials={financials} conversions={conversions} onActionComplete={loadData} />} />
              <Route path="/reports" element={<ReportsPage reports={reports} />} />
              <Route path="/suppliers" element={<SuppliersPage suppliers={suppliers} />} />
              <Route path="/tracking" element={<TrackingPage tracking={tracking} notifications={notifications} />} />
              <Route path="/users" element={<UsersPage users={users} />} />
              <Route path="/audit" element={<AuditPage />} />
              <Route path="/login" element={<LoginPage onLoginSuccess={handleLoginSuccess} />} />
            </Routes>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
