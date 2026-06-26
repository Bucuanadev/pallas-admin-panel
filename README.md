# Pallas.shop Fulfillment Admin Panel

Este projeto reúne um painel administrativo completo para gerir o fulfillment da Pallas.shop. Ele foi construído como um MVP para centralizar pedidos, lojas, gateways de pagamento, finanças, fornecedores, relatórios e notificações numa interface única.

O objetivo é oferecer um sistema de apoio à operação de e-commerce que permite acompanhar o ciclo de cada pedido desde o pagamento até a entrega, rastrear compras e fornecedores, controlar gateways e lojas ativas, e gerar relatórios de produtos mais vendidos.

## Estrutura

- `backend/`: API Node.js + Express com dados mockados em JSON para pedidos, finanças, fornecedores, conversões, tracking, notificações e utilizadores.
- `frontend/`: interface React + Vite + Tailwind com páginas para dashboard, pedidos, finanças, fornecedores, compras, tracking e auditoria.

## Como iniciar

1. Instalar dependências do backend:
   - `cd backend && npm install`
2. Instalar dependências do frontend:
   - `cd frontend && npm install`
3. Iniciar o backend:
   - `cd backend && npm run dev`
4. Iniciar o frontend:
   - `cd frontend && npm run dev`

A interface estará disponível em `http://localhost:5173` e a API em `http://localhost:4000`.
