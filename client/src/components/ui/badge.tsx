import * as React from 'react';
import { cn } from '../../lib/utils';

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-[color:var(--panel-border)] bg-[color:var(--surface-soft)] px-2 py-1 text-xs text-[color:var(--text-main)]',
        className
      )}
      {...props}
    />
  );
}
