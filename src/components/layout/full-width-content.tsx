import { cn } from "@/lib/utils"

/**
 * FullWidthContent Component
 * 
 * Simple full-width flex container for split-pane layouts
 */

interface FullWidthContentProps {
  children: React.ReactNode
  className?: string
}

export function FullWidthContent({ children, className }: FullWidthContentProps) {
  return (
    <div className={cn("h-full flex", className)}>
      {children}
    </div>
  )
}

