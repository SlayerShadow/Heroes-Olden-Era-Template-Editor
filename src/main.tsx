import './i18n'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  // Boundary снаружи StrictMode: ловит ошибки рендера всего дерева и показывает
  // экран с диагностикой вместо белого экрана (см. ErrorBoundary.tsx).
  <ErrorBoundary>
    <StrictMode>
      <App />
    </StrictMode>
  </ErrorBoundary>,
)
