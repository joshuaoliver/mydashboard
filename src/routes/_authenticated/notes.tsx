import { createFileRoute, Outlet, useNavigate, useParams } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useCachedQuery } from '@/lib/convex-cache'
import { api } from '../../../convex/_generated/api'
import { DocumentList } from '@/components/todos/DocumentList'

export const Route = createFileRoute('/_authenticated/notes')({
  component: NotesLayout,
})

function NotesLayout() {
  const navigate = useNavigate()
  // Get documentId from child route params if present
  const params = useParams({ strict: false }) as { documentId?: string }
  const documentId = params.documentId

  const documents = useCachedQuery(api.todoDocuments.listDocuments, {})

  const createDocument = useMutation(api.todoDocuments.createDocument)

  const handleCreateDocument = async () => {
    const id = await createDocument({ title: 'Untitled Note' })
    navigate({ to: '/notes/$documentId', params: { documentId: id } })
  }

  return (
    <div className="h-full flex">
      <DocumentList 
        documents={documents ?? []} 
        isLoading={documents === undefined}
        selectedId={documentId}
        onCreateDocument={handleCreateDocument}
      />
      <Outlet />
    </div>
  )
}

