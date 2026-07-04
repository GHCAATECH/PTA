import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'
export function Badge({className,...props}:HTMLAttributes<HTMLSpanElement>){return <span className={cn('chip bg-slate-100 text-slate-700 dark:bg-white/8 dark:text-slate-200',className)} {...props}/>}
