import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { Showroom } from './Showroom'
import { startPersistence } from './persist'
import { useStore } from './store'
import { useUi } from './ui/uiStore'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {new URLSearchParams(location.search).has('showroom') ? <Showroom /> : <App />}
  </StrictMode>,
)

void startPersistence()

// Handles for scripting the app from the browser console (and for recording demos).
if (import.meta.env.DEV) Object.assign(window, { roomStore: useStore, roomUi: useUi })
