import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AuthProvider } from './components/auth/AuthProvider.tsx'
import { Root } from './Root.tsx'

// `AuthProvider` va por encima de todo, y no dentro de `App`: es lo que decide
// si `App` llega a montarse. Los otros dos contextos (`DataContext`,
// `NavContext`) viven en `AppShell`, o sea dentro del área ya autenticada.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </StrictMode>,
)
