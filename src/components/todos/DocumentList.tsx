import { Link } from '@tanstack/react-router'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Plus, FileText, Loader2, FolderKanban } from 'lucide-react'
import { cn } from '~/lib/utils'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

interface TodoDocument {
  _id: string
  title: string
  projectId?: Id<"projects">
  todoCount: number
  completedCount: number
  updatedAt: number
}

interface DocumentListProps {
  documents: TodoDocument[]
  isLoading: boolean
  selectedId: string | undefined
  onCreateDocument: () => void
}

type ProjectFilter = Id<"projects"> | "none" | "all"

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
  
  return new Date(timestamp).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  })
}

export function DocumentList({ 
  documents, 
  isLoading, 
  selectedId,
  onCreateDocument 
}: DocumentListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("all")

  // Fetch projects to show project names
  const { data: projects } = useQuery(
    convexQuery(api.projectsStore.listActiveProjects, {})
  )

  // Create a map of project IDs to names
  const projectMap = useMemo(() => {
    const map = new Map<string, string>()
    projects?.forEach(p => map.set(p._id, p.name))
    return map
  }, [projects])

  const filteredDocuments = useMemo(() => {
    let filtered = documents

    // Filter by project
    if (projectFilter === "none") {
      filtered = filtered.filter(doc => !doc.projectId)
    } else if (projectFilter !== "all") {
      filtered = filtered.filter(doc => doc.projectId === projectFilter)
    }

    // Filter by search term
    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      filtered = filtered.filter(doc => 
        doc.title.toLowerCase().includes(lower)
      )
    }

    return filtered
  }, [documents, searchTerm, projectFilter])

  return (
    <div className="w-72 border-r bg-muted/30 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg">Notes</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
            <Input
              placeholder="Filter..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Button 
            size="icon"
            variant="secondary"
            onClick={onCreateDocument}
            className="h-8 w-8 flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Document List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {searchTerm || projectFilter !== "all" ? 'No matching notes' : 'No notes yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredDocuments.map((doc) => {
                const projectName = doc.projectId ? projectMap.get(doc.projectId) : null
                return (
                  <Link
                    key={doc._id}
                    to="/notes/$documentId"
                    params={{ documentId: doc._id }}
                    className={cn(
                      "block p-3 rounded-lg transition-colors",
                      "hover:bg-accent",
                      selectedId === doc._id 
                        ? "bg-accent border-l-2 border-l-primary" 
                        : "border-l-2 border-l-transparent"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-sm truncate flex-1">
                        {doc.title}
                      </h3>
                    </div>
                    {projectName && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <FolderKanban className="w-3 h-3" />
                        <span className="truncate">{projectName}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-1.5">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        doc.todoCount === 0 
                          ? "bg-muted text-muted-foreground"
                          : doc.completedCount === doc.todoCount
                            ? "bg-green-500/20 text-green-600 dark:text-green-400"
                            : "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                      )}>
                        {doc.todoCount === 0 
                          ? 'No todos' 
                          : `${doc.completedCount}/${doc.todoCount} done`}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(doc.updatedAt)}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Project filter at bottom */}
      <div className="p-3 border-t flex-shrink-0">
        <Select
          value={projectFilter}
          onValueChange={(v) => setProjectFilter(v as ProjectFilter)}
        >
          <SelectTrigger className="h-8 text-xs">
            <FolderKanban className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All projects" />
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
    </div>
  )
}
