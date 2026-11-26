import { Component } from 'react'

/**
 * Se algum componente quebrar, mostra o erro e formas de sair dele
 * em vez de deixar a página inteira em branco.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Erro na tela:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const useSimulated = () => {
      localStorage.setItem('fonte', 'simulado')
      location.reload()
    }
    const resetPrefs = () => {
      localStorage.removeItem('fonte')
      localStorage.removeItem('tema')
      location.reload()
    }

    return (
      <div className="crash" role="alert">
        <h1>Algo deu errado nesta tela</h1>
        <p className="muted">
          O app encontrou um erro e parou de desenhar a página. Os dados não foram perdidos; escolha uma das opções
          abaixo.
        </p>
        <pre>{String(error?.message || error)}</pre>
        <div className="crash-actions">
          <button type="button" className="btn btn-outline" onClick={() => this.setState({ error: null })}>
            Tentar de novo
          </button>
          <button type="button" className="btn btn-outline" onClick={() => location.reload()}>
            Recarregar a página
          </button>
          <button type="button" className="btn btn-outline" onClick={useSimulated}>
            Usar dados simulados
          </button>
          <button type="button" className="btn btn-outline" onClick={resetPrefs}>
            Limpar preferências
          </button>
        </div>
      </div>
    )
  }
}
