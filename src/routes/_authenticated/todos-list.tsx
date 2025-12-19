import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Loader2,
  CheckSquare,
  FileText,
  FolderKanban,
  Hash,
  Filter,
  Calendar,
  Clock,
} from 'lucide-react'
import { cn } from '~/lib/utils'

export const Route = createFileRoute('/_authenticated/todos-list')({
  component: TodosListPage,
})

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  
  return formatDate(timestamp)
}

type ProjectFilter = Id<"projects"> | "none" | "all"
type CompletionFilter = "all" | "pending" | "completed"

function TodosListPage() {
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("all")
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>("pending")
  const [hashtagFilter, setHashtagFilter] = useState<string | null>(null)

  // Fetch projects for filter dropdown
  const { data: projects } = useQuery(
    convexQuery(api.projectsStore.listActiveProjects, {})
  )

  // Fetch all hashtags
  const { data: hashtags } = useQuery(
    convexQuery(api.todoItems.listAllHashtags, {})
  )

  // Fetch todos with filters
  const { data: todos, isLoading } = useQuery(
    convexQuery(api.todoItems.listAllTodos, {
      projectId: projectFilter === "all" ? undefined : projectFilter,
      showCompleted: completionFilter === "all" ? undefined : completionFilter === "completed",
      hashtag: hashtagFilter ?? undefined,
    })
  )

  // Fetch stats
  const { data: stats } = useQuery(
    convexQuery(api.todoItems.getSummaryStats, {})
  )

  const toggleCompletion = useMutation(api.todoItems.toggleTodoCompletion)

  const handleToggle = async (id: Id<"todoItems">) => {
    await toggleCompletion({ id })
  }

  const clearFilters = () => {
    setProjectFilter("all")
    setCompletionFilter("pending")
    setHashtagFilter(null)
  }

  const hasActiveFilters = projectFilter !== "all" || completionFilter !== "pending" || hashtagFilter !== null

  return (
    <div className="h-full flex">
      {/* Sidebar with filters */}
      <div className="w-72 border-r bg-muted/30 flex flex-col h-full">
        {/* Header with stats */}
        <div className="p-4 border-b bg-gradient-to-b from-background to-transparent">
          <h2 className="font-semibold text-lg flex items-center gap-2 mb-4">
            <CheckSquare className="w-5 h-5 text-primary" />
            Todos
          </h2>
          {stats && (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gradient-to-br from-blue-500/15 to-blue-500/5 rounded-xl p-3 text-center border border-blue-500/10">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.pending}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Pending</div>
              </div>
              <div className="bg-gradient-to-br from-green-500/15 to-green-500/5 rounded-xl p-3 text-center border border-green-500/10">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {stats.completedToday}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Done today</div>
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" />
              Filters
            </span>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-5 px-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Reset
              </Button>
            )}
          </div>

          {/* Filter buttons row */}
          <div className="flex gap-1.5">
            {/* Status pills */}
            <div className="flex-1 flex rounded-lg bg-muted/50 p-0.5">
              {(['pending', 'completed', 'all'] as CompletionFilter[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setCompletionFilter(status)}
                  className={cn(
                    "flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all",
                    completionFilter === status
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {status === 'pending' ? 'Open' : status === 'completed' ? 'Done' : 'All'}
                </button>
              ))}
            </div>
          </div>

          {/* Project filter */}
          <Select
            value={projectFilter}
            onValueChange={(v) => setProjectFilter(v as ProjectFilter)}
          >
            <SelectTrigger className="h-9 bg-background/50 border-muted-foreground/20">
              <FolderKanban className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              <SelectItem value="none">No project</SelectItem>
              {projects?.map((project) => (
                <SelectItem key={project._id} value={project._id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Hashtags */}
        {hashtags && hashtags.length > 0 && (
          <div className="flex-1 overflow-hidden flex flex-col border-t">
            <div className="px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" />
                Hashtags
              </span>
            </div>
            <ScrollArea className="flex-1 px-2">
              <div className="space-y-0.5 pb-2">
                {hashtags.map(({ tag, count }) => (
                  <button
                    key={tag}
                    onClick={() => setHashtagFilter(hashtagFilter === tag ? null : tag)}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm",
                      "hover:bg-accent/50 transition-all",
                      hashtagFilter === tag 
                        ? "bg-primary/10 text-primary border border-primary/20" 
                        : "text-muted-foreground"
                    )}
                  >
                    <span className={cn(
                      "font-medium",
                      hashtagFilter === tag && "text-primary"
                    )}>
                      #{tag}
                    </span>
                    <Badge 
                      variant={hashtagFilter === tag ? "default" : "secondary"} 
                      className="h-5 px-1.5 text-xs"
                    >
                      {count}
                    </Badge>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">
              {completionFilter === "pending" ? "Pending Todos" : 
               completionFilter === "completed" ? "Completed Todos" : "All Todos"}
              {hashtagFilter && (
                <span className="text-muted-foreground ml-2">
                  #{hashtagFilter}
                </span>
              )}
            </h1>
            <span className="text-sm text-muted-foreground">
              {todos?.length ?? 0} items
            </span>
          </div>
        </div>

        {/* Todo list */}
        <ScrollArea className="flex-1">
          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : !todos || todos.length === 0 ? (
              <div className="text-center py-12">
                <CheckSquare className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No todos found</h3>
                <p className="text-muted-foreground text-sm">
                  {hasActiveFilters
                    ? "Try adjusting your filters"
                    : "Create todos by adding task items in your notes"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {todos.map((todo) => (
                  <div
                    key={todo._id}
                    className={cn(
                      "group flex items-start gap-3 p-4 rounded-lg border",
                      "hover:bg-accent/50 transition-colors",
                      todo.isCompleted && "opacity-60"
                    )}
                  >
                    <Checkbox
                      checked={todo.isCompleted}
                      onCheckedChange={() => handleToggle(todo._id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm",
                          todo.isCompleted && "line-through text-muted-foreground"
                        )}
                      >
                        {todo.text}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {/* Document link */}
                        <Link
                          to="/todos/$documentId"
                          params={{ documentId: todo.documentId }}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <FileText className="w-3 h-3" />
                          {todo.documentTitle}
                        </Link>

                        {/* Project badge */}
                        {todo.projectName && (
                          <Badge variant="outline" className="h-5 text-xs">
                            <FolderKanban className="w-3 h-3 mr-1" />
                            {todo.projectName}
                          </Badge>
                        )}

                        {/* Hashtags */}
                        {todo.hashtags.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => setHashtagFilter(tag)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Timestamps */}
                    <div className="text-right text-xs text-muted-foreground space-y-1 flex-shrink-0">
                      <div className="flex items-center gap-1 justify-end">
                        <Calendar className="w-3 h-3" />
                        {formatRelativeTime(todo.createdAt)}
                      </div>
                      {todo.completedAt && (
                        <div className="flex items-center gap-1 justify-end text-green-600 dark:text-green-400">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(todo.completedAt)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
