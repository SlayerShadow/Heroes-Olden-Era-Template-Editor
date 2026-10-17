import { Component, type ErrorInfo, type ReactNode } from 'react'
import i18n from '../i18n'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
  componentStack: string | null
}

/**
 * Глобальный предохранитель: без него любая ошибка рендера размонтирует всё
 * React-дерево (белый экран без единой зацепки). Boundary показывает экран с
 * диагностикой вместо этого. Состояние шаблона не теряется: аварийный снапшот
 * сессии (localStorage `oe-editor:session`) восстанавливается при перезагрузке.
 *
 * Намеренно class-компонент: hook-эквивалента getDerivedStateFromError /
 * componentDidCatch в React 19 нет. i18n используется напрямую (не
 * react-i18next): на момент аварии контекст провайдера может быть разрушен,
 * а синглтон i18next жив.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, componentStack: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error, componentStack: null }
  }

  componentDidCatch(_error: Error, info: ErrorInfo): void {
    this.setState({ componentStack: info.componentStack ?? null })
  }

  render(): ReactNode {
    const { error, componentStack } = this.state
    if (!error) return this.props.children
    return (
      <div className="error-boundary" role="alert">
        <div className="error-boundary__card">
          <h1 className="error-boundary__title">{i18n.t('error.title')}</h1>
          <p className="error-boundary__hint">{i18n.t('error.hint')}</p>
          <pre className="error-boundary__message">{error.stack || error.message || String(error)}</pre>
          {componentStack != null && componentStack !== '' && (
            <details className="error-boundary__details">
              <summary>{i18n.t('error.details')}</summary>
              <pre>{componentStack}</pre>
            </details>
          )}
          <button
            type="button"
            className="btn error-boundary__reload"
            onClick={() => window.location.reload()}
          >
            {i18n.t('error.reload')}
          </button>
        </div>
      </div>
    )
  }
}
