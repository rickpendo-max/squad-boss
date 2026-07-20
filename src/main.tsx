import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './index.css'
import App from './App'
import { AthleteProvider } from './context/AthleteContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AthleteProvider>
      <App />
    </AthleteProvider>
  </StrictMode>,
)
