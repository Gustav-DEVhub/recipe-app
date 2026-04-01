import * as React from 'react';
import { cn } from '../../lib/utils';

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('inline-flex items-center rounded-full border border-border bg-white/5 px-2 py-1 text-xs text-slate-100', className)} {...props} />;
}

