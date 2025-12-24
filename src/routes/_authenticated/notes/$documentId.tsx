import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { TodoEditor } from '@/components/todos/TodoEditor'
import { TodoSummary } from '@/components/todos/TodoSummary'
import { Loader2, FileWarning } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export const Route = createFileRoute('/_authenticated/notes/$documentId')({
  component: NoteDocumentPage,
})

function NoteDocumentPage() {
  const { documentId } = Route.useParams()
  const navigate = useNavigate()
  const [isSaving, setIsSaving] = useState(false)

  const { data: documents } = useQuery(
    convexQuery(api.todoDocuments.listDocuments, {})
  )

  const { data: document, isLoading: isLoadingDocument } = useQuery(
    convexQuery(api.todoDocuments.getDocument, { 
      id: documentId as Id<"todoDocuments"> 
    })
  )

  const saveContent = useMutation(api.todoDocuments.saveDocumentContent)
  const updateTitle = useMutation(api.todoDocuments.updateDocumentTitle)
  const updateProject = useMutation(api.todoDocuments.updateDocumentProject)
  const deleteDocumentMutation = useMutation(api.todoDocuments.deleteDocument)

  const handleSaveContent = async (content: string) => {
    setIsSaving(true)
    try {
      await saveContent({
        id: documentId as Id<"todoDocuments">,
        content,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateTitle = async (title: string) => {
    await updateTitle({
      id: documentId as Id<"todoDocuments">,
      title,
    })
  }

  const handleUpdateProject = async (projectId: Id<"projects"> | undefined) => {
    await updateProject({
      id: documentId as Id<"todoDocuments">,
      projectId,
    })
  }

  const handleDeleteDocument = async () => {
    await deleteDocumentMutation({ id: documentId as Id<"todoDocuments"> })
    // Navigate to the first remaining document or index
    const remainingDocs = documents?.filter(d => d._id !== documentId)
    if (remainingDocs && remainingDocs.length > 0) {
      navigate({ to: '/notes/$documentId', params: { documentId: remainingDocs[0]._id } })
    } else {
      navigate({ to: '/notes' })
    }
  }

  if (isLoadingDocument) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!document) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <FileWarning className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Document not found</h2>
          <p className="text-muted-foreground mb-6">
            This document may have been deleted or doesn't exist.
          </p>
          <Button onClick={() => navigate({ to: '/notes' })}>
            Go back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      <TodoEditor
        document={document}
        onSave={handleSaveContent}
        onUpdateTitle={handleUpdateTitle}
        onUpdateProject={handleUpdateProject}
        onDelete={handleDeleteDocument}
        isSaving={isSaving}
      />
      <TodoSummary
        todoCount={document.todoCount}
        completedCount={document.completedCount}
      />
    </div>
  )
}

