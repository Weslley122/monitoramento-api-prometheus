import { LINKS, OWNER } from './format.js'
import { Card } from './ui.jsx'

const UPDATED = '26/11/2026'

function Contact() {
  if (OWNER.name || OWNER.contact) {
    return (
      <p>
        Responsável: {OWNER.name || 'não informado'}
        {OWNER.contact && (
          <>
            {'. Contato: '}
            {OWNER.contact.includes('@') ? <a href={`mailto:${OWNER.contact}`}>{OWNER.contact}</a> : OWNER.contact}
          </>
        )}
        .
      </p>
    )
  }
  return <p>Para dúvidas, fale com a pessoa ou equipe que administra esta instalação do painel.</p>
}

function LegalPage({ title, children }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p className="muted">Última atualização: {UPDATED}</p>
        </div>
      </div>
      <Card as="article" className="legal">
        {children}
      </Card>
    </>
  )
}

export function PrivacyPage() {
  const clearPrefs = () => {
    localStorage.removeItem('tema')
    localStorage.removeItem('fonte')
    location.reload()
  }
  return (
    <LegalPage title="Política de privacidade">
      <h2>O que este painel mostra</h2>
      <p>
        Métricas técnicas da API: quantidade de requisições, tempo de resposta, códigos de status HTTP, rota acessada e
        versão da aplicação. Os números são agregados por rota e por status. O painel não recebe nome, e-mail, endereço
        IP, conteúdo de requisições nem qualquer outro dado que identifique uma pessoa.
      </p>

      <h2>O que fica guardado no seu navegador</h2>
      <p>
        Duas preferências, no armazenamento local do navegador (localStorage): <code>tema</code>, com o fundo escolhido,
        e <code>fonte</code>, com a fonte de dados escolhida. O painel não usa cookies.
      </p>
      <p>
        <button type="button" className="btn btn-outline" onClick={clearPrefs}>
          Apagar minhas preferências
        </button>
      </p>

      <h2>Para onde os dados vão</h2>
      <p>
        O navegador consulta o Prometheus configurado para esta instalação ({LINKS.prometheus}) e desenha os gráficos na
        própria tela. O painel não envia dados a terceiros, não usa ferramentas de análise de visitas, não usa
        rastreadores e carrega a fonte tipográfica do próprio servidor. O arquivo do botão "Exportar CSV" é gerado no
        seu navegador e não passa por nenhum servidor.
      </p>

      <h2>Dados simulados</h2>
      <p>
        Quando o Prometheus não está disponível, o painel pode mostrar um cenário de demonstração gerado no próprio
        navegador. Nesse caso, a tela avisa que os números são simulados.
      </p>

      <h2>Serviços ligados ao painel</h2>
      <p>
        Os links para o Grafana ({LINKS.grafana}) e o Prometheus abrem esses serviços diretamente. O tratamento de dados
        neles segue a configuração e as regras de quem os administra.
      </p>

      <h2>Seus direitos</h2>
      <p>
        Como o painel não trata dados pessoais, não há dados seus para consultar, corrigir ou excluir aqui. As
        preferências guardadas no navegador podem ser apagadas a qualquer momento pelo botão acima ou nas configurações
        do próprio navegador.
      </p>

      <h2>Contato</h2>
      <Contact />
    </LegalPage>
  )
}

export function TermsPage() {
  return (
    <LegalPage title="Termos de uso">
      <h2>O que é este painel</h2>
      <p>
        Uma ferramenta para acompanhar o funcionamento da API: tráfego, tempo de resposta, erros e o efeito de novas
        versões. Os dados vêm do Prometheus configurado para esta instalação.
      </p>

      <h2>Como usar</h2>
      <p>
        O painel é de consulta. Ele não altera a API, o Prometheus nem o Grafana. Use-o para acompanhar e investigar o
        comportamento do sistema.
      </p>

      <h2>Limites</h2>
      <p>
        Os números são atualizados a cada 15 segundos e podem ter esse atraso. Quando o Prometheus está fora do ar, os
        gráficos podem ficar desatualizados ou mostrar dados simulados, sempre com aviso na tela. Antes de uma decisão
        importante, confira os números no Grafana ou no Prometheus.
      </p>

      <h2>Disponibilidade</h2>
      <p>
        O painel depende da API, do Prometheus e da rede para funcionar. Não há garantia de que esteja disponível o
        tempo todo.
      </p>

      <h2>Software de terceiros</h2>
      <p>
        O painel usa React (licença MIT) e a fonte Inter (SIL Open Font License). A stack de monitoramento usa
        Prometheus (Apache 2.0) e Grafana (AGPL 3.0). Cada um segue a sua própria licença.
      </p>

      <h2>Mudanças nestes termos</h2>
      <p>Quando estes termos mudarem, a data no topo desta página será atualizada.</p>

      <h2>Contato</h2>
      <Contact />
    </LegalPage>
  )
}

/** Rodapé com os links legais e de onde vêm os números. */
export function SiteFooter({ source, onNavigate }) {
  return (
    <footer className="site-footer">
      <span>{source === 'prometheus' ? 'Dados do Prometheus' : 'Dados simulados para demonstração'}</span>
      <nav aria-label="Informações legais">
        <button type="button" onClick={() => onNavigate('privacidade')}>
          Política de privacidade
        </button>
        <button type="button" onClick={() => onNavigate('termos')}>
          Termos de uso
        </button>
      </nav>
    </footer>
  )
}
