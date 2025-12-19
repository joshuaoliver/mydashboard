import { createFileRoute, Outlet, useNavigate, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { DocumentList } from '@/components/todos/DocumentList'

export const Route = createFileRoute('/_authenticated/todos')({
  component: TodosLayout,
})

function TodosLayout() {
  const navigate = useNavigate()
  // Get documentId from child route params if present
  const params = useParams({ strict: false }) as { documentId?: string }
  const documentId = params.documentId

  const { data: documents, isLoading } = useQuery(
    convexQuery(api.todoDocuments.listDocuments, {})
  )

  const createDocument = useMutation(api.todoDocuments.createDocument)

  const handleCreateDocument = async () => {
    const id = await createDocument({ title: 'Untitled Note' })
    navigate({ to: '/todos/$documentId', params: { documentId: id } })
  }

  return (
    <div className="h-full flex">
      <DocumentList 
        documents={documents ?? []} 
        isLoading={isLoading}
        selectedId={documentId}
        onCreateDocument={handleCreateDocument}
      />
      <Outlet />
    </div>
  )
}
