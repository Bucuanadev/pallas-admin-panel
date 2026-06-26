import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';

const API_BASE = '/api';

const PIPELINE_STAGES = [
  { key: 'paid', label: 'Pago' },
  { key: 'awaiting_conversion', label: 'Convertido' },
  { key: 'awaiting_purchase', label: 'Comprado' },
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
    <div className="flex items-center gap-3 overflow-x-auto rounded-3xl border border-white/10 bg-slate-950/70 px-3 py-3 text-[0.85rem] text-slate-300">
      {PIPELINE_STAGES.map((item, index) => {
        const isActive = index === activeIndex;
        const isDone = index <= activeIndex;
        return (
          <div key={item.key} className="flex items-center gap-3">
            <div className={classNames(
              'relative flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold',
              isDone ? 'border-[#F4D06F] bg-[#F4D06F]/20 text-[#F5F1E8]' : 'border-white/10 bg-white/5 text-slate-400'
            )}>
              <span>{index + 1}</span>
            </div>
            <div className="min-w-[86px]">
              <p className={classNames('font-semibold', isActive ? 'text-[#F4D06F]' : 'text-slate-300')}>{item.label}</p>
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
      <p className="text-sm uppercase tracking-[0.25em] text-slate-400">{title}</p>
      <p className="mt-4 text-4xl font-semibold text-[#F5F1E8]">{value}</p>
      {subtitle && <p className="mt-2 text-sm text-slate-300">{subtitle}</p>}
    </div>
  );
}

function SummaryBlock({ label, children }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-xl">
      <p className="text-sm uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <div className="mt-4 text-[#F5F1E8]">{children}</div>
    </div>
  );
}

function DashboardPage({ orders, financials, stores, gateways, reports }) {
  const summary = useMemo(() => {
    const paid = orders.filter((order) => order.payment_status === 'paid').length;
    const awaitingPurchase = orders.filter((order) => order.purchase_status === 'awaiting_purchase').length;
    const purchased = orders.filter((order) => order.purchase_status === 'purchased').length;
    const delivered = orders.filter((order) => order.purchase_status === 'delivered').length;
    return { paid, awaitingPurchase, purchased, delivered };
  }, [orders]);

  return (
    <div className="space-y-6">
      <div className="grid gap-5 xl:grid-cols-4">
        <StatCard title="Pedidos pagos" value={summary.paid} />
        <StatCard title="Aguardam compra" value={summary.awaitingPurchase} tone="red" />
        <StatCard title="Comprados" value={summary.purchased} tone="white" />
        <StatCard title="Entregues" value={summary.delivered} tone="gold" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-[#F5F1E8]">Resumo rápido</h2>
              <p className="mt-1 text-sm text-slate-400">Fluxo de fulfillment com notificações e pipeline por pedido.</p>
            </div>
            <Link to="/orders" className="inline-flex items-center rounded-full bg-[#E8B73B] px-4 py-2 text-sm font-semibold text-[#0B0B0C] transition hover:bg-[#F4D06F]">
              Ver pipeline completo
            </Link>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <SummaryBlock label="Saldo MZN">MZN {financials.balance_mzn?.toLocaleString()}</SummaryBlock>
            <SummaryBlock label="Saldo USDT">{financials.balance_usdt} USDT</SummaryBlock>
            <SummaryBlock label="Lojas ativas">{stores.length}</SummaryBlock>
            <SummaryBlock label="Gateways configurados">{gateways.length}</SummaryBlock>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
          <h2 className="text-2xl font-semibold text-[#F5F1E8]">Top produtos</h2>
          <p className="mt-2 text-sm text-slate-400">Produtos mais vendidos nos últimos pedidos sincronizados.</p>
          <div className="mt-6 space-y-3">
            {reports.slice(0, 4).map((item) => (
              <div key={`${item.product_id}-${item.product_name}`} className="rounded-3xl border border-white/10 bg-[#0E0E10] p-4">
                <p className="font-semibold text-[#F5F1E8]">{item.product_name}</p>
                <p className="mt-1 text-sm text-slate-400">{item.sold_count} vendas • {item.total_mzn.toLocaleString()} MZN</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderPipelineSummary({ purchase_status }) {
  const pageStage = purchase_status === 'awaiting_conversion' ? 'awaiting_conversion' : purchase_status;
  return <StagePill stage={pageStage} />;
}

function OrdersPage({ orders }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[#F5F1E8]">Ligações de pedidos</h2>
          <p className="text-sm text-slate-400">Veja em que fase do fluxo cada encomenda está.</p>
        </div>
        <span className="rounded-full border border-[#E8B73B]/40 bg-[#E8B73B]/10 px-4 py-2 text-sm font-semibold text-[#F5F1E8]">Pipeline único</span>
      </div>

      <div className="mt-6 space-y-5">
        {orders.map((order) => (
          <div key={order.id} className="rounded-3xl border border-white/10 bg-[#0B0B0C]/95 p-5 shadow-inner shadow-black/20">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Pedido #{order.wc_order_id}</p>
                <p className="mt-2 text-xl font-semibold text-[#F5F1E8]">{order.customer_name}</p>
                <p className="mt-1 text-sm text-slate-400">{order.supplier} • {order.product_name || `Produto ${order.product_id}`}</p>
              </div>
              <div className="space-y-2 text-right">
                <p className="text-sm text-slate-400">Valor</p>
                <p className="text-2xl font-semibold text-[#F5F1E8]">MZN {order.amount_mzn.toLocaleString()}</p>
              </div>
            </div>

            <div className="mt-5">
              <OrderPipelineSummary purchase_status={order.purchase_status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinancePage({ financials, conversions }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
        <h2 className="text-2xl font-semibold text-[#F5F1E8]">Gestão financeira</h2>
        <p className="mt-2 text-sm text-slate-400">Margens, saldos e conversões.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <SummaryBlock label="Saldo MZN">MZN {financials.balance_mzn?.toLocaleString()}</SummaryBlock>
          <SummaryBlock label="Saldo USDT">{financials.balance_usdt} USDT</SummaryBlock>
        </div>
      </div>
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
        <h2 className="text-2xl font-semibold text-[#F5F1E8]">Conversões</h2>
        <div className="mt-6 space-y-3">
          {conversions.map((entry) => (
            <div key={entry.id} className="rounded-3xl border border-white/10 bg-[#0B0B0C]/90 p-4">
              <p className="font-semibold text-[#F5F1E8]">{entry.amount_mzn.toLocaleString()} MZN → {entry.amount_usdt} USDT</p>
              <p className="mt-1 text-sm text-slate-400">Taxa {entry.exchange_rate} • {entry.status}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SuppliersPage({ suppliers }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
      <h2 className="text-2xl font-semibold text-[#F5F1E8]">Fornecedores</h2>
      <p className="mt-2 text-sm text-slate-400">Mapeamento de produto, APIs e fornecedores preferidos.</p>
      <div className="mt-6 space-y-4">
        {suppliers.map((supplier) => (
          <div key={supplier.id} className="rounded-3xl border border-white/10 bg-[#0B0B0C]/95 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xl font-semibold text-[#F5F1E8]">{supplier.name}</p>
                <p className="text-sm text-slate-400">API suportada: {supplier.api_supported ? 'Sim' : 'Não'}</p>
              </div>
              <span className="rounded-full border border-[#E8B73B]/30 bg-[#E8B73B]/10 px-3 py-1 text-sm font-semibold text-[#F5F1E8]">Markup {supplier.default_markup_pct}%</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {supplier.products.map((product) => (
                <div key={product.wc_product_id} className="rounded-3xl border border-white/10 bg-slate-900/90 p-4">
                  <p className="text-sm text-slate-400">Produto WooCommerce #{product.wc_product_id}</p>
                  <p className="mt-1 font-semibold text-[#F5F1E8]">SKU: {product.supplier_sku}</p>
                  <p className="mt-1 text-sm text-slate-400">Custo {product.cost_usdt} USDT</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StoresPage({ stores }) {
  const [name, setName] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [type, setType] = useState('woocommerce');
  const [message, setMessage] = useState('');

  const handleCreate = async () => {
    const payload = { name, api_url: apiUrl, type, status: 'active', country: 'MZ' };
    const response = await fetch(`${API_BASE}/stores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      setMessage('Loja criada com sucesso. Atualize a página para ver a lista.');
      setName('');
      setApiUrl('');
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
        <h2 className="text-2xl font-semibold text-[#F5F1E8]">Lojas</h2>
        <p className="mt-2 text-sm text-slate-400">Gerencie conexão WooCommerce e múltiplas lojas.</p>
        <div className="mt-6 space-y-4">
          {stores.map((store) => (
            <div key={store.id} className="rounded-3xl border border-white/10 bg-[#0B0B0C]/90 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#F5F1E8]">{store.name}</p>
                  <p className="text-sm text-slate-400">{store.type} • {store.country}</p>
                </div>
                <span className="rounded-full border border-[#E8B73B]/30 bg-[#E8B73B]/10 px-3 py-1 text-sm text-[#F5F1E8]">{store.status}</span>
              </div>
              <p className="mt-3 text-sm text-slate-400">API URL: {store.api_url}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
        <h2 className="text-2xl font-semibold text-[#F5F1E8]">Adicionar nova loja</h2>
        <div className="mt-6 space-y-4">
          <label className="block text-sm text-slate-300">Nome</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#0B0B0C] px-4 py-3 text-white outline-none" placeholder="Pallas.shop WooCommerce" />
          <label className="block text-sm text-slate-300">API URL</label>
          <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#0B0B0C] px-4 py-3 text-white outline-none" placeholder="https://pallas.shop/wp-json/wc/v3" />
          <label className="block text-sm text-slate-300">Tipo</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#0B0B0C] px-4 py-3 text-white outline-none">
            <option value="woocommerce">WooCommerce</option>
            <option value="shopify">Shopify</option>
          </select>
          <button onClick={handleCreate} className="w-full rounded-2xl bg-[#E8B73B] px-4 py-3 font-semibold text-[#0B0B0C] transition hover:bg-[#F4D06F]">Criar loja</button>
          {message && <p className="text-sm text-emerald-300">{message}</p>}
        </div>
      </div>
    </div>
  );
}

function GatewaysPage({ gateways }) {
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('mpesa');
  const [apiUrl, setApiUrl] = useState('');
  const [message, setMessage] = useState('');

  const handleCreate = async () => {
    const payload = { name, provider, api_url: apiUrl, status: 'active' };
    const response = await fetch(`${API_BASE}/gateways`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      setMessage('Gateway criado com sucesso. Atualize a página para ver a lista.');
      setName('');
      setApiUrl('');
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
        <h2 className="text-2xl font-semibold text-[#F5F1E8]">Gateways</h2>
        <p className="mt-2 text-sm text-slate-400">Configuração de M-Pesa, banco local e PSPs.</p>
        <div className="mt-6 space-y-4">
          {gateways.map((gateway) => (
            <div key={gateway.id} className="rounded-3xl border border-white/10 bg-[#0B0B0C]/90 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-[#F5F1E8]">{gateway.name}</p>
                  <p className="text-sm text-slate-400">{gateway.provider}</p>
                </div>
                <span className="rounded-full border border-[#E8B73B]/30 bg-[#E8B73B]/10 px-3 py-1 text-sm text-[#F5F1E8]">{gateway.status}</span>
              </div>
              <p className="mt-3 text-sm text-slate-400">Endpoint: {gateway.api_url}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
        <h2 className="text-2xl font-semibold text-[#F5F1E8]">Adicionar gateway</h2>
        <div className="mt-6 space-y-4">
          <label className="block text-sm text-slate-300">Nome</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#0B0B0C] px-4 py-3 text-white outline-none" placeholder="M-Pesa Moçambique" />
          <label className="block text-sm text-slate-300">Provider</label>
          <select value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#0B0B0C] px-4 py-3 text-white outline-none">
            <option value="mpesa">M-Pesa</option>
            <option value="bank">Banco</option>
            <option value="other">Outro</option>
          </select>
          <label className="block text-sm text-slate-300">API URL</label>
          <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#0B0B0C] px-4 py-3 text-white outline-none" placeholder="https://api.example.com" />
          <button onClick={handleCreate} className="w-full rounded-2xl bg-[#E8B73B] px-4 py-3 font-semibold text-[#0B0B0C] transition hover:bg-[#F4D06F]">Criar gateway</button>
          {message && <p className="text-sm text-emerald-300">{message}</p>}
        </div>
      </div>
    </div>
  );
}

function ReportsPage({ reports }) {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
        <h2 className="text-2xl font-semibold text-[#F5F1E8]">Relatórios</h2>
        <p className="mt-2 text-sm text-slate-400">Produtos mais vendidos e tendências de fulfillment.</p>
      </div>
      <div className="rounded-3xl border border-white/10 bg-[#0B0B0C]/95 p-6 shadow-xl">
        <h3 className="text-xl font-semibold text-[#F5F1E8]">Top produtos</h3>
        <div className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/80">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400">
              <tr>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Quant.</th>
                <th className="px-4 py-3">Total MZN</th>
                <th className="px-4 py-3">Fornecedor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-[#0B0B0C]">
              {reports.map((item) => (
                <tr key={`${item.product_id}-${item.product_name}`}>
                  <td className="px-4 py-4 font-semibold text-[#F5F1E8]">{item.product_name}</td>
                  <td className="px-4 py-4 font-mono text-[#F5F1E8]">{item.sold_count}</td>
                  <td className="px-4 py-4 font-mono text-[#F5F1E8]">{item.total_mzn.toLocaleString()}</td>
                  <td className="px-4 py-4 text-slate-400">{item.supplier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TrackingPage({ tracking, notifications }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
        <h2 className="text-2xl font-semibold text-[#F5F1E8]">Tracking & notificações</h2>
        <div className="mt-6 space-y-3">
          {tracking.map((entry) => (
            <div key={entry.id} className="rounded-3xl border border-white/10 bg-[#0B0B0C]/90 p-4">
              <p className="font-semibold text-[#F5F1E8]">Pedido #{entry.order_id}</p>
              <p className="mt-1 text-sm text-slate-400">{entry.status}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">Fonte: {entry.raw_source}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
        <h2 className="text-2xl font-semibold text-[#F5F1E8]">Log de notificações</h2>
        <div className="mt-6 space-y-3">
          {notifications.map((notification) => (
            <div key={notification.id} className="rounded-3xl border border-white/10 bg-[#0B0B0C]/90 p-4">
              <p className="font-semibold text-[#F5F1E8]">Pedido #{notification.order_id}</p>
              <p className="mt-1 text-sm text-slate-400">{notification.channel} • {notification.status}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">{notification.sent_at}</p>
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
      <h2 className="text-2xl font-semibold text-[#F5F1E8]">Utilizadores & permissões</h2>
      <p className="mt-2 text-sm text-slate-400">Crie operadores com acesso controlado aos módulos de finanças, compras e supervisão.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {users.map((user) => (
          <div key={user.id} className="rounded-3xl border border-white/10 bg-[#0B0B0C]/90 p-4">
            <p className="font-semibold text-[#F5F1E8]">{user.name}</p>
            <p className="mt-1 text-sm text-slate-400">{user.email}</p>
            <p className="mt-3 inline-flex rounded-full border border-[#E8B73B]/30 bg-[#E8B73B]/10 px-3 py-1 text-sm font-semibold text-[#F5F1E8]">{user.role}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditPage() {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
      <h2 className="text-2xl font-semibold text-[#F5F1E8]">Auditoria & logs</h2>
      <p className="mt-3 text-sm text-slate-400">Registe cada ação financeira, cada webhook e cada atualização de estado para reconciliação.</p>
      <div className="mt-6 rounded-3xl border border-white/10 bg-[#0B0B0C]/90 p-4">
        <p className="text-sm text-slate-400">O audit trail já suporta notificações por email quando uma compra é confirmada pelo fornecedor.</p>
      </div>
    </div>
  );
}

function App() {
  const location = useLocation();
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [ordersRes, financialsRes, suppliersRes, conversionsRes, trackingRes, notificationsRes, usersRes, storesRes, gatewaysRes, reportsRes] = await Promise.all([
          fetch(`${API_BASE}/orders`),
          fetch(`${API_BASE}/financials`),
          fetch(`${API_BASE}/suppliers`),
          fetch(`${API_BASE}/conversions`),
          fetch(`${API_BASE}/tracking`),
          fetch(`${API_BASE}/notifications`),
          fetch(`${API_BASE}/users`),
          fetch(`${API_BASE}/stores`),
          fetch(`${API_BASE}/gateways`),
          fetch(`${API_BASE}/reports/top-products`),
        ]);

        const [ordersData, financialsData, suppliersData, conversionsData, trackingData, notificationsData, usersData, storesData, gatewaysData, reportsData] = await Promise.all([
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
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const navItems = [
    { to: '/', label: 'Dashboard' },
    { to: '/orders', label: 'Pedidos' },
    { to: '/stores', label: 'Lojas' },
    { to: '/gateways', label: 'Gateways' },
    { to: '/finance', label: 'Finanças' },
    { to: '/reports', label: 'Relatórios' },
    { to: '/suppliers', label: 'Fornecedores' },
    { to: '/tracking', label: 'Tracking' },
    { to: '/users', label: 'Utilizadores' },
    { to: '/audit', label: 'Auditoria' }
  ];

  return (
    <div className="min-h-screen bg-[#0B0B0C] text-[#F5F1E8]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row lg:px-6">
        <aside className="w-full rounded-[32px] border border-white/10 bg-[#0D0D0F]/90 p-5 shadow-2xl lg:w-72">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-3xl bg-[#E8B73B]/15 text-2xl font-semibold text-[#F4D06F]">P</div>
            <div>
              <p className="text-lg font-semibold text-[#F5F1E8]">Pallas.shop</p>
              <p className="text-sm text-slate-400">Fulfillment Admin</p>
            </div>
          </div>

          <nav className="mt-8 space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`flex items-center rounded-2xl px-4 py-3 text-sm transition ${isActive ? 'bg-[#E8B73B]/15 text-[#F5F1E8]' : 'text-slate-400 hover:bg-white/5 hover:text-[#F5F1E8]'}`}
                >
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 space-y-6">
          <header className="rounded-[32px] border border-white/10 bg-[#0D0D0F]/90 p-6 shadow-2xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-[#E8B73B]">Admin panel</p>
                <h1 className="mt-1 text-4xl font-semibold text-[#F5F1E8]">Tudo o que você precisa, num só lugar</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-400">Orquestra pagamentos em MZN, conversões para USDT, compras ao fornecedor e tracking com stages visíveis.</p>
              </div>
              <div className="rounded-[28px] border border-[#E8B73B]/20 bg-[#E8B73B]/10 px-4 py-3 text-sm font-semibold text-[#0B0B0C]">
                Pipeline de pedidos ativo • notificações de email ligadas
              </div>
            </div>
          </header>

          {loading ? (
            <div className="rounded-[32px] border border-white/10 bg-[#0D0D0F]/90 p-8 text-center text-slate-400">A carregar dados do painel...</div>
          ) : (
            <Routes>
              <Route path="/" element={<DashboardPage orders={orders} financials={financials} stores={stores} gateways={gateways} reports={reports} />} />
              <Route path="/orders" element={<OrdersPage orders={orders} />} />
              <Route path="/stores" element={<StoresPage stores={stores} />} />
              <Route path="/gateways" element={<GatewaysPage gateways={gateways} />} />
              <Route path="/finance" element={<FinancePage financials={financials} conversions={conversions} />} />
              <Route path="/reports" element={<ReportsPage reports={reports} />} />
              <Route path="/suppliers" element={<SuppliersPage suppliers={suppliers} />} />
              <Route path="/tracking" element={<TrackingPage tracking={tracking} notifications={notifications} />} />
              <Route path="/users" element={<UsersPage users={users} />} />
              <Route path="/audit" element={<AuditPage />} />
            </Routes>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
