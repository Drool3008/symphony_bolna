import { PRODUCT_NAME } from '@family-health/shared'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'

document.title = PRODUCT_NAME

const root = document.getElementById('root')
if (!root) throw new Error('index.html has no #root to mount the app on')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
