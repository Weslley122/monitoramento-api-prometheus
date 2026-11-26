# Painel do Balcão Aceso

Painel em React que mostra o tráfego, o tempo de resposta e os erros da API, lendo direto do
Prometheus. Quando o Prometheus não está no ar, ele mostra um cenário de demonstração e avisa
no topo da tela que os números são simulados.

## Rodando

```bash
npm install
npm run dev
```

Abre em http://localhost:5173. Para ver dados reais, suba antes a stack na raiz do projeto
(`docker compose up -d --build`). O passo a passo completo está no README da raiz.

## Onde fica cada coisa

| Arquivo | O que faz |
|---------|-----------|
| `src/prometheus.js` | Consultas PromQL e conversão das respostas do Prometheus |
| `src/data.js` | Cenário simulado, usado quando o Prometheus não responde |
| `src/engine.js` | Médias, alertas e comparação antes e depois do deploy |
| `src/useMetrics.js` | Escolhe a fonte de dados e atualiza a cada 15 segundos |
| `src/OverviewDashboard.jsx` | Visão geral |
| `src/DeployDashboard.jsx` | Antes e depois do deploy |
| `src/charts/` | Gráficos em SVG |
| `src/Legal.jsx` | Política de privacidade e termos de uso |

## Comandos

- `npm run dev`: servidor de desenvolvimento, com o proxy para o Prometheus
- `npm run build`: gera a versão final em `dist/`
- `npm run lint`: confere o código com o oxlint
