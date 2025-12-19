import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useQuery as useConvexQuery, useMutation } from 'convex/react'
import type { Id } from '../../../convex/_generated/dataModel'
import { api } from '../../../convex/_generated/api'
import { PageHeader } from '@/components/layout/page-header'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ContactPanel } from '@/components/contacts/ContactPanel'
import {
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  KanbanProvider,
  type DragEndEvent,
} from '@/components/ui/shadcn-io/kanban'
import type { DragOverEvent } from '@dnd-kit/core'
import { cn } from '~/lib/utils'

type LeadStatus = 'Talking' | 'Planning' | 'Dated' | 'Connected' | 'Current' | 'Former'
type LeadStatusKey = LeadStatus | 'NoStatus' // Current is now between Connected and Former

interface ContactRecord {
  _id: Id<'contacts'>
  firstName?: string
  lastName?: string
  instagram?: string
  description?: string
  notes?: string
  connections?: string[]
  leadStatus?: LeadStatus
  imageUrl?: string
  objective?: string
  lastModifiedAt: number
}

const LEAD_STATUS_METADATA: Array<{
  id: string
  name: string
  key: LeadStatusKey
  label: string
  accent: string
  border: string
}> = [
  { id: 'Talking', name: 'Talking', key: 'Talking', label: 'Talking', accent: 'bg-sky-100 text-sky-700', border: 'border-sky-200' },
  { id: 'Planning', name: 'Planning', key: 'Planning', label: 'Planning', accent: 'bg-amber-100 text-amber-700', border: 'border-amber-200' },
  { id: 'Dated', name: 'Drinks', key: 'Dated', label: 'Drinks', accent: 'bg-rose-100 text-rose-700', border: 'border-rose-200' },
  { id: 'Connected', name: 'Connected', key: 'Connected', label: 'Connected', accent: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-200' },
  { id: 'Current', name: 'Current', key: 'Current', label: 'Current', accent: 'bg-violet-100 text-violet-700', border: 'border-violet-200' },
  { id: 'Former', name: 'Former', key: 'Former', label: 'Former', accent: 'bg-slate-200 text-slate-700', border: 'border-slate-300' },
  { id: 'NoStatus', name: 'Unassigned', key: 'NoStatus', label: 'Unassigned', accent: 'bg-gray-100 text-gray-700', border: 'border-gray-200' },
]

export const Route = createFileRoute('/_authenticated/sales')({
  component: SalesPage,
})

function SalesPage() {
  const [selectedContactId, setSelectedContactId] = useState<Id<'contacts'> | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null)

  const { data } = useQuery(convexQuery(api.dexQueries.listContacts, { limit: 1000 }))
  const updateLeadStatus = useMutation(api.contactMutations.updateLeadStatus)

  const romanticContacts = useMemo(() => {
    if (!data?.contacts) return []
    const lowercaseTarget = new Set(['romantic', 'romatic'])
    return data.contacts
      .filter((contact) => contact.connections?.some((c) => lowercaseTarget.has(c.toLowerCase())))
      .sort((a, b) => (b.lastModifiedAt ?? 0) - (a.lastModifiedAt ?? 0))
  }, [data?.contacts])

  const kanbanData = useMemo(() => {
    return romanticContacts.map((contact) => {
      const statusKey = contact.leadStatus || 'NoStatus'
      const column = LEAD_STATUS_METADATA.find((col) => col.key === statusKey)
      return { id: contact._id, name: getContactLabel(contact), column: column?.id ?? 'NoStatus', contact }
    })
  }, [romanticContacts])

  const selectedContact = useConvexQuery(api.dexQueries.getContactById, selectedContactId ? { contactId: selectedContactId } : 'skip')

  const handleOpenContact = (contactId: Id<'contacts'>) => { setSelectedContactId(contactId); setSheetOpen(true) }
  const handleCloseSheet = () => { setSheetOpen(false); setSelectedContactId(null) }
  const handleDragOver = (event: DragOverEvent) => {
    if (!event.over) { setDraggedOverColumn(null); return }
    const column = LEAD_STATUS_METADATA.find((col) => col.id === event.over!.id)
    if (column) { setDraggedOverColumn(column.id); return }
    const overItem = kanbanData.find((item) => item.id === event.over!.id)
    if (overItem) setDraggedOverColumn(overItem.column)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) { setDraggedOverColumn(null); return }
    let targetColumn = LEAD_STATUS_METADATA.find((col) => col.id === over.id)
    if (!targetColumn) {
      const overItem = kanbanData.find((item) => item.id === over.id)
      if (overItem) targetColumn = LEAD_STATUS_METADATA.find((col) => col.id === overItem.column)
    }
    if (!targetColumn && draggedOverColumn) targetColumn = LEAD_STATUS_METADATA.find((col) => col.id === draggedOverColumn)
    if (!targetColumn) { setDraggedOverColumn(null); return }
    const activeItem = kanbanData.find((item) => item.id === active.id)
    if (activeItem && activeItem.column === targetColumn.id) { setDraggedOverColumn(null); return }
    updateLeadStatus({ contactId: active.id as Id<'contacts'>, leadStatus: targetColumn.key === 'NoStatus' ? null : (targetColumn.key as LeadStatus) })
    setDraggedOverColumn(null)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="px-6 py-6">
        <PageHeader title="Sales" description="Keep tabs on romantic leads and progress them through each stage." />
      </div>
      <div className="flex-1 overflow-auto px-6 pb-8">
        {romanticContacts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white py-16 text-center">
            <p className="text-lg font-semibold text-slate-900">No romantic contacts yet</p>
            <p className="text-sm text-slate-600">Assign the Romantic connection type to a contact.</p>
          </div>
        ) : (
          <div className="h-full min-h-[600px]">
            <KanbanProvider columns={LEAD_STATUS_METADATA} data={kanbanData} onDragEnd={handleDragEnd} onDragOver={handleDragOver}>
              {(column: typeof LEAD_STATUS_METADATA[number]) => {
                const columnContacts = kanbanData.filter((item) => item.column === column.id)
                return (
                  <KanbanBoard id={column.id} key={column.id}>
                    <KanbanHeader className={cn('flex items-center justify-between border-b px-4 py-3', column.border)}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{column.label}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{columnContacts.length}</span>
                      </div>
                    </KanbanHeader>
                    <KanbanCards id={column.id}>
                      {(item: typeof kanbanData[number]) => (
                        <KanbanCard column={column.id} id={item.id} name={item.name} className="cursor-pointer" onClick={() => handleOpenContact(item.contact._id)}>
                          <div className="flex items-start gap-3">
                            <Avatar className="h-10 w-10 flex-shrink-0">
                              {item.contact.imageUrl && <AvatarImage src={item.contact.imageUrl} alt={item.name} />}
                              <AvatarFallback>{getInitials(item.contact.firstName, item.contact.lastName)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-slate-900">{item.name}</div>
                              {(item.contact.objective || item.contact.description || item.contact.notes) && (
                                <p className="text-xs text-slate-600 line-clamp-2 mt-1">{item.contact.objective || item.contact.description || item.contact.notes}</p>
                              )}
                            </div>
                          </div>
                        </KanbanCard>
                      )}
                    </KanbanCards>
                  </KanbanBoard>
                )
              }}
            </KanbanProvider>
          </div>
        )}
      </div>
      <Sheet open={sheetOpen} onOpenChange={(open) => !open && handleCloseSheet()}>
        <SheetContent side="left" className="flex h-full w-full flex-col gap-0 overflow-hidden px-0 pb-0 sm:max-w-3xl">
          <SheetHeader className="border-b px-6 py-4 text-left"><SheetTitle className="text-lg font-semibold text-slate-900">Contact Details</SheetTitle></SheetHeader>
          <div className="flex-1 overflow-auto px-6 pb-6">
            <ContactPanel key={selectedContact?._id ?? 'empty'} contact={selectedContact ?? null} isLoading={selectedContact === undefined && selectedContactId !== null} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function getContactLabel(contact: ContactRecord) {
  if (contact.instagram) return `@${contact.instagram}`
  if (contact.firstName || contact.lastName) return [contact.firstName, contact.lastName].filter(Boolean).join(' ')
  return 'Unnamed contact'
}

function getInitials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '??'
}
