import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

const buttonVariants = cva('inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20', { variants: { variant: { default:'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20 hover:bg-indigo-700', outline:'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800', ghost:'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/8', danger:'bg-rose-600 text-white hover:bg-rose-700' }, size: { default:'h-11', sm:'h-9 min-h-9 px-3 text-xs', icon:'h-11 w-11 p-0' } }, defaultVariants:{variant:'default',size:'default'} })
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }
export function Button({ className, variant, size, asChild, ...props }: ButtonProps) { const Comp = asChild ? Slot : 'button'; return <Comp className={cn(buttonVariants({variant,size}),className)} {...props} /> }
