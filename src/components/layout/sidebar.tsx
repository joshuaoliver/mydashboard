import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

/**
 * Sidebar Component
 * 
 * Reusable sidebar for lists, navigation, or secondary content
 * Includes header section and scrollable content area
 */

interface SidebarProps {
  /**
   * Fixed width of the sidebar (e.g., "w-80", "w-64")
   * Defaults to w-80 (320px)
   */
  width?: string
  
  /**
   * Content for the sidebar header (title, actions, etc.)
   */
  header?: React.ReactNode
  
  /**
   * Main scrollable content
   */
  children: React.ReactNode
  
  /**
   * Additional className for the container
   */
  className?: string
  
  /**
   * Whether to show a border on the right side
   */
  borderRight?: boolean
}

export function Sidebar({ 
  width = "w-80", 
  header, 
  children, 
  className,
  borderRight = true 
}: SidebarProps) {
  return (
    <div 
      className={cn(
        width,
        "h-full min-h-0 bg-white flex flex-col flex-shrink-0",
        borderRight && "border-r border-gray-200",
        className
      )}
    >
      {header && (
        <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
          {header}
        </div>
      )}
      
      <ScrollArea className="flex-1 min-h-0">
        {children}
      </ScrollArea>
    </div>
  )
}

/**
 * SidebarHeader Component
 * 
 * Standard header layout for sidebars with title and optional actions
 */

interface SidebarHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function SidebarHeader({ title, subtitle, actions }: SidebarHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
      {subtitle && (
        <p className="text-xs text-gray-600">{subtitle}</p>
      )}
    </>
  )
}

