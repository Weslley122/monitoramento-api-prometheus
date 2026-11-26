# Balcão Aceso

O Balcão Aceso é uma API de pedidos em Java com Spring Boot que mede as próprias requisições.
O Prometheus coleta as métricas a cada 15 segundos e o Grafana exibe os painéis.

```
Balcão Aceso (3 réplicas)     →  Prometheus  →  Grafana
/actuator/prometheus             :9090           :3000
            ↑
     k6 gerando tráfego
```

## Como subir

Precisa do [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado.

```bash
cp .env.example .env   # opcional: só se quiser mudar versão, tráfego ou senha
docker compose up -d --build
```

| Serviço    | Endereço                       | O que é |
|------------|--------------------------------|---------|
| Grafana    | http://localhost:3000          | Dashboards prontos (acesso sem login; admin/admin para editar) |
| Prometheus | http://localhost:9090          | Consultas PromQL e alvos coletados (menu Status, opção Targets) |
| API        | http://localhost:8081 a 8083   | Uma porta por réplica: `/produtos`, `/pedidos`, `/usuarios` |

Em um ou dois minutos o gerador de carga já produz dados. A cada 15 minutos ele dobra o
tráfego por cerca de 3 minutos, e o dashboard mostra o pico, a lentidão e os erros.

Para parar: `docker compose down` (os dados ficam nos volumes; use `down -v` para apagá-los).

## Dashboards

Ficam em `grafana/dashboards/` e são carregados automaticamente:

- **Balcão Aceso**: requisições/s, latência p95, erros 5xx, instâncias ativas, tráfego por
  rota e respostas por classe de status.
- **Deploy · /pedidos**: compara a rota antes e depois de uma versão nova. Uma linha vertical
  marca o deploy sozinha, quando uma versão nova aparece nas métricas.

## Simular o deploy da v1.4.0

1. No `.env`, coloque `APP_VERSION=v1.3.0` e `PEDIDOS_CONSULTA_OTIMIZADA=false` e rode
   `docker compose up -d`.
2. Espere uns 15 minutos.
3. Troque para `APP_VERSION=v1.4.0` e `PEDIDOS_CONSULTA_OTIMIZADA=true` e rode
   `docker compose up -d api`.

No dashboard **Deploy · /pedidos**, o p95 cai logo depois da marcação.

## App React (painel próprio)

O app em `Dashboard/Dashboard grafana e prometheus` lê o mesmo Prometheus, com as mesmas
consultas PromQL dos dashboards do Grafana, e atualiza a cada 15 segundos.

```bash
cd "Dashboard/Dashboard grafana e prometheus"
npm install
npm run dev        # abre em http://localhost:5173
```

- O Vite repassa `/prometheus` para `http://localhost:9090`. Para outro endereço, crie um
  `.env.local` com `PROMETHEUS_URL=http://host:porta`.
- O seletor no topo escolhe a fonte: **Automática** (Prometheus quando estiver no ar; senão,
  dados simulados), **Prometheus** ou **Simulado**.
- A tela de deploy acha o deploy sozinha: é o momento em que uma versão nova aparece no
  rótulo `version` das métricas.
- O proxy existe no `npm run dev` e no `npm run preview`. Publicado como site estático, o app
  não tem o proxy e mostra os dados simulados, com um aviso no topo.
- Quando o painel mostra dados simulados, uma faixa no topo avisa que os números são de exemplo.

### Publicar com domínio próprio

Crie um `.env.local` na pasta do app com os endereços públicos e quem responde pela instalação
(aparece na política de privacidade e nos termos de uso, no rodapé):

```bash
PROMETHEUS_URL=http://prometheus:9090                     # para onde o proxy encaminha
VITE_PROMETHEUS_URL=https://prometheus.seudominio.com.br  # link exibido no painel
VITE_GRAFANA_URL=https://grafana.seudominio.com.br
VITE_RESPONSAVEL=Nome da pessoa ou empresa
VITE_CONTATO=contato@seudominio.com.br
```

## Estrutura

| Pasta | Conteúdo |
|-------|----------|
| `api/` | API Spring Boot 4 (Java 25) com Actuator e Micrometer |
| `prometheus/` | Configuração de coleta (descobre as 3 réplicas pelo DNS do Docker) |
| `grafana/` | Fonte de dados e dashboards provisionados |
| `carga/` | Script do k6 que gera o tráfego |
| `Dashboard/…` | App React que lê o Prometheus ao vivo (ou dados simulados, sem ele) |

As configurações ajustáveis (versão, tráfego, senha do Grafana) estão no `.env`.
