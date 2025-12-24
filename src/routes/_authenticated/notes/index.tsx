import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { FileText, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_authenticated/notes/')({
  component: NotesIndexPage,
})

function NotesIndexPage() {
  const navigate = useNavigate()
  const { data: documents } = useQuery(
    convexQuery(api.todoDocuments.listDocuments, {})
  )
  const createDocument = useMutation(api.todoDocuments.createDocument)

  const handleCreateDocument = async () => {
    const id = await createDocument({ title: 'Untitled Note' })
    navigate({ to: '/notes/$documentId', params: { documentId: id } })
  }

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">
          {documents && documents.length > 0 
            ? 'Select a note' 
            : 'No notes yet'}
        </h2>
        <p className="text-muted-foreground mb-6">
          {documents && documents.length > 0 
            ? 'Choose a note from the sidebar to start editing'
            : 'Create your first note to start adding todos'}
        </p>
        {(!documents || documents.length === 0) && (
          <Button onClick={handleCreateDocument} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Note
          </Button>
        )}
      </div>
    </div>
  )
}

