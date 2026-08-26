import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
/* Loaded after index.css on purpose. index.css is the previous theme plus the
   utilities the admin dashboard and the inner pages still depend on, so it
   stays; this sheet is the new design system and needs to win ties against it
   without resorting to !important. Import order is the whole mechanism. */
import './styles/gk-system.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

