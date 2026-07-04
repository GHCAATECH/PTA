import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'
export const Card = ({className,...props}:HTMLAttributes<HTMLDivElement>) => <div className={cn('surface',className)} {...props}/>
export const CardHeader = ({className,...props}:HTMLAttributes<HTMLDivElement>) => <div className={cn('flex items-start justify-between gap-4 p-5 pb-0 sm:p-6 sm:pb-0',className)} {...props}/>
export const CardTitle = ({className,...props}:HTMLAttributes<HTMLHeadingElement>) => <h3 className={cn('text-base font-bold tracking-tight',className)} {...props}/>
export const CardContent = ({className,...props}:HTMLAttributes<HTMLDivElement>) => <div className={cn('p-5 sm:p-6',className)} {...props}/>
