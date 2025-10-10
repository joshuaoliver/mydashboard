import { cn } from "@/lib/utils"

/**
 * FullWidthContent Component
 * 
 * Container for full-width content that breaks out of DashboardLayout's padding
 * Use this when you need edge-to-edge content (like split panes, sidebars, etc.)
 * 
 * Height automatically fills remaining space after DashboardLayout header
 */

interface FullWidthContentProps {
  children: React.ReactNode
  className?: string
}

export function FullWidthContent({ children, className }: FullWidthContentProps) {
  return (
    <div 
      className={cn(
        // Full height minus DashboardLayout header (64px + 2rem padding)
        "h-[calc(100vh-8rem)]",
        // Break out of DashboardLayout's content padding
        "-mx-4 sm:-mx-6 lg:-mx-8 -mt-8",
        // Enable flexbox for children
        "flex min-h-0",
        className
      )}
    >
      {children}
    </div>
  )
}

