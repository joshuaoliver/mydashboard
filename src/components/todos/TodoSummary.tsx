import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronUp, ChevronDown, CheckCircle2, Circle } from 'lucide-react'
import { cn } from '~/lib/utils'

interface TodoSummaryProps {
  todoCount: number
  completedCount: number
}

export function TodoSummary({ todoCount, completedCount }: TodoSummaryProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  
  const pendingCount = todoCount - completedCount
  const completionPercent = todoCount > 0 
    ? Math.round((completedCount / todoCount) * 100) 
    : 0

  if (todoCount === 0) {
    return null
  }

  return (
    <div className={cn(
      "absolute bottom-4 right-4 bg-card border rounded-lg shadow-lg transition-all",
      isCollapsed ? "w-auto" : "w-64"
    )}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between px-3 py-2 h-auto"
      >
        <span className="font-medium text-sm">Todo Summary</span>
        {isCollapsed ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </Button>

      {!isCollapsed && (
        <div className="px-3 pb-3 space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{todoCount} todos in this document</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>{completedCount} completed ({completionPercent}%)</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <Circle className="w-4 h-4 text-muted-foreground" />
              <span>{pendingCount} pending</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-300",
                completionPercent === 100 
                  ? "bg-green-500" 
                  : "bg-primary"
              )}
              style={{ width: `${completionPercent}%` }}
            />
          </div>

          {completionPercent === 100 && (
            <p className="text-xs text-green-600 dark:text-green-400 font-medium text-center">
              🎉 All done!
            </p>
          )}
        </div>
      )}
    </div>
  )
}
