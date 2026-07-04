import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { AuthProvider } from './features/auth/auth-context'
import App from './App'
import './index.css'
const queryClient=new QueryClient({defaultOptions:{queries:{staleTime:30_000,retry:1,refetchOnWindowFocus:false}}})
const Router=window.location.protocol==='file:'?HashRouter:BrowserRouter
createRoot(document.getElementById('root')!).render(<StrictMode><ThemeProvider attribute="class" defaultTheme="system" enableSystem><QueryClientProvider client={queryClient}><Router><AuthProvider><App/><Toaster richColors position="top-right"/></AuthProvider></Router></QueryClientProvider></ThemeProvider></StrictMode>)
