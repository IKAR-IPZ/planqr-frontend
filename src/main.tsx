import ReactDOM from 'react-dom/client'
import './index.css'
import React from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router/Routes.tsx'
import { ThemeProvider } from './context/ThemeContext.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(  
  <React.StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </React.StrictMode>,
)
