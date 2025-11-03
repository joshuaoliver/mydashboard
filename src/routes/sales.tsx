import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useQuery, useMutation } from 'convex/react'
import type { Id } from '../../convex/_generated/dataModel'
import { api } from '../../convex/_generated/api'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
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

type LeadStatus = 'Talking' | 'Planning' | 'Dated' | 'Connected' | 'Former'
type LeadStatusKey = LeadStatus | 'NoStatus'

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
  {
    id: 'Talking',
    name: 'Talking',
    key: 'Talking',
    label: 'Talking',
    accent: 'bg-sky-100 text-sky-700',
    border: 'border-sky-200',
  },
  {
    id: 'Planning',
    name: 'Planning',
    key: 'Planning',
    label: 'Planning',
    accent: 'bg-amber-100 text-amber-700',
    border: 'border-amber-200',
  },
  {
    id: 'Dated',
    name: 'Drinks',
    key: 'Dated',
    label: 'Drinks',
    accent: 'bg-rose-100 text-rose-700',
    border: 'border-rose-200',
  },
  {
    id: 'Connected',
    name: 'Connected',
    key: 'Connected',
    label: 'Connected',
    accent: 'bg-emerald-100 text-emerald-700',
    border: 'border-emerald-200',
  },
  {
    id: 'Former',
    name: 'Former',
    key: 'Former',
    label: 'Former',
    accent: 'bg-slate-200 text-slate-700',
    border: 'border-slate-300',
  },
  {
    id: 'NoStatus',
    name: 'Unassigned',
    key: 'NoStatus',
    label: 'Unassigned',
    accent: 'bg-gray-100 text-gray-700',
    border: 'border-gray-200',
  },
]

export const Route = createFileRoute('/sales')({
  component: SalesPage,
})

function SalesPage() {
  const [selectedContactId, setSelectedContactId] = useState<Id<'contacts'> | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null)

  const { data } = useSuspenseQuery(
    convexQuery(api.dexQueries.listContacts, {
      limit: 1000,
    })
  )

  const updateLeadStatus = useMutation(api.contactMutations.updateLeadStatus)

  const romanticContacts = useMemo(() => {
    const lowercaseTarget = new Set(['romantic', 'romatic'])

    return data.contacts
      .filter((contact) => {
        if (!contact.connections || contact.connections.length === 0) {
          return false
        }

        return contact.connections.some((connection) =>
          lowercaseTarget.has(connection.toLowerCase())
        )
      })
      .sort((a, b) => (b.lastModifiedAt ?? 0) - (a.lastModifiedAt ?? 0))
  }, [data.contacts])

  // Transform contacts into kanban data format
  const kanbanData: Array<{
    id: Id<'contacts'>
    name: string
    column: string
    contact: ContactRecord
  }> = useMemo(() => {
    return romanticContacts.map((contact) => {
      const statusKey = resolveLeadStatusKey(contact.leadStatus)
      const column = LEAD_STATUS_METADATA.find((col) => col.key === statusKey)
      return {
        id: contact._id,
        name: getContactLabel(contact),
        column: column?.id ?? 'NoStatus',
        contact,
      }
    })
  }, [romanticContacts])

  const selectedContact = useQuery(
    api.dexQueries.getContactById,
    selectedContactId ? { contactId: selectedContactId } : 'skip'
  )

  const handleOpenContact = (contactId: Id<'contacts'>) => {
    setSelectedContactId(contactId)
    setSheetOpen(true)
  }

  const handleCloseSheet = () => {
    setSheetOpen(false)
    setSelectedContactId(null)
  }

  const handleDragOver = (event: DragOverEvent) => {
    if (!event.over) {
      setDraggedOverColumn(null)
      return
    }

    // Try to find the column from the over target
    const column = LEAD_STATUS_METADATA.find((col) => col.id === event.over!.id)
    if (column) {
      setDraggedOverColumn(column.id)
      return
    }

    // If not found, check if it's a card
    const overItem = kanbanData.find((item) => item.id === event.over!.id)
    if (overItem) {
      setDraggedOverColumn(overItem.column)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) {
      setDraggedOverColumn(null)
      return
    }

    // Don't update if dropped on the same card
    if (active.id === over.id) {
      setDraggedOverColumn(null)
      return
    }

    // Find the target column - could be dropped on:
    // 1. A column board/container (over.id matches column.id)
    // 2. Another card (find that card's column)
    // 3. The KanbanCards container (which also has id={column.id})
    // 4. Use the tracked draggedOverColumn as fallback
    let targetColumn = LEAD_STATUS_METADATA.find((col) => col.id === over.id)
    
    if (!targetColumn) {
      // If dropped on another card, find that card's column
      const overItem = kanbanData.find((item) => item.id === over.id)
      if (overItem) {
        targetColumn = LEAD_STATUS_METADATA.find((col) => col.id === overItem.column)
      }
    }

    // Use tracked column as fallback
    if (!targetColumn && draggedOverColumn) {
      targetColumn = LEAD_STATUS_METADATA.find((col) => col.id === draggedOverColumn)
    }

    // If we still don't have a column, try to find it from the active item's potential new column
    // This handles edge cases where the drop target might not be directly identifiable
    if (!targetColumn) {
      // Check if any column matches the over.id (case-insensitive or partial match)
      targetColumn = LEAD_STATUS_METADATA.find((col) => {
        return col.id === over.id || 
               over.id.toString().includes(col.id) ||
               col.id.includes(over.id.toString())
      })
    }

    // If we still don't have a column, don't update
    if (!targetColumn) {
      console.warn('Could not determine target column for drag end', { active: active.id, over: over.id, draggedOverColumn })
      setDraggedOverColumn(null)
      return
    }

    // Don't update if already in the target column
    const activeItem = kanbanData.find((item) => item.id === active.id)
    if (activeItem && activeItem.column === targetColumn.id) {
      setDraggedOverColumn(null)
      return
    }

    const contactId = active.id as Id<'contacts'>
    const newStatus = targetColumn.key === 'NoStatus' ? null : (targetColumn.key as LeadStatus)

    updateLeadStatus({
      contactId,
      leadStatus: newStatus,
    })

    setDraggedOverColumn(null)
  }

  const totalRomanticContacts = romanticContacts.length

  return (
    <DashboardLayout>
      <div className="flex h-full flex-col overflow-hidden">
        <div className="px-6 py-6">
          <PageHeader
            title="Sales"
            description="Keep tabs on romantic leads and progress them through each stage."
          />
        </div>

        <div className="flex-1 overflow-auto px-6 pb-8">
          {totalRomanticContacts === 0 ? (
            <EmptyState />
          ) : (
            <div className="h-full min-h-[600px]">
              <KanbanProvider
                columns={LEAD_STATUS_METADATA}
                data={kanbanData}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
              >
                {(column: typeof LEAD_STATUS_METADATA[number]) => {
                  const columnContacts = kanbanData.filter(
                    (item) => item.column === column.id
                  )
                  return (
                    <KanbanBoard id={column.id} key={column.id}>
                      <KanbanHeader
                        className={cn(
                          'flex items-center justify-between border-b px-4 py-3',
                          column.border
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            {column.label}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            {columnContacts.length}
                          </span>
                        </div>
                      </KanbanHeader>
                      <KanbanCards id={column.id}>
                        {(item: typeof kanbanData[number]) => {
                          const contact: ContactRecord = item.contact as ContactRecord
                          return (
                            <KanbanCard
                              column={column.id}
                              id={item.id}
                              name={item.name}
                              className="cursor-pointer"
                              onClick={() => handleOpenContact(contact._id)}
                            >
                              <div className="flex items-start gap-3">
                                <Avatar className="h-10 w-10 flex-shrink-0">
                                  {contact.imageUrl ? (
                                    <AvatarImage
                                      src={contact.imageUrl}
                                      alt={getContactLabel(contact)}
                                    />
                                  ) : null}
                                  <AvatarFallback>
                                    {getInitials(contact.firstName, contact.lastName)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 space-y-2 min-w-0">
                                  <div>
                                    <div className="text-sm font-semibold text-slate-900">
                                      {getContactLabel(contact)}
                                    </div>
                                    {contact.objective ? (
                                      <p className="text-xs text-slate-600 line-clamp-2 mt-1">
                                        {contact.objective}
                                      </p>
                                    ) : contact.description ? (
                                      <p className="text-xs text-slate-600 line-clamp-2 mt-1">
                                        {contact.description}
                                      </p>
                                    ) : contact.notes ? (
                                      <p className="text-xs text-slate-600 line-clamp-2 mt-1">
                                        {contact.notes}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </KanbanCard>
                          )
                        }}
                      </KanbanCards>
                    </KanbanBoard>
                  )
                }}
              </KanbanProvider>
            </div>
          )}
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={(open) => (open ? setSheetOpen(true) : handleCloseSheet())}>
        <SheetContent side="right" className="flex h-full w-full flex-col gap-0 overflow-hidden px-0 pb-0 sm:max-w-3xl">
          <SheetHeader className="border-b px-6 py-4 text-left">
            <SheetTitle className="text-lg font-semibold text-slate-900">
              Contact Details
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-auto px-6 pb-6">
            <ContactPanel
              key={selectedContact?._id ?? 'empty'}
              contact={selectedContact ?? null}
              isLoading={selectedContact === undefined && selectedContactId !== null}
            />
          </div>
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white py-16 text-center">
      <div className="mx-auto max-w-md space-y-3">
        <p className="text-lg font-semibold text-slate-900">No romantic contacts yet</p>
        <p className="text-sm text-slate-600">
          Assign the <span className="font-medium">Romantic</span> connection type to a contact and
          set a lead status to have them appear on this board.
        </p>
      </div>
    </div>
  )
}

function resolveLeadStatusKey(status?: LeadStatus | null): LeadStatusKey {
  if (!status) {
    return 'NoStatus'
  }

  switch (status) {
    case 'Talking':
    case 'Planning':
    case 'Dated':
    case 'Connected':
    case 'Former':
      return status
    default:
      return 'NoStatus'
  }
}

function getContactLabel(contact: ContactRecord) {
  // Prefer Instagram name if available
  if (contact.instagram) {
    return `@${contact.instagram}`
  }

  // Otherwise use actual contact name
  if (contact.firstName || contact.lastName) {
    return [contact.firstName, contact.lastName].filter(Boolean).join(' ')
  }

  return 'Unnamed contact'
}

function getInitials(firstName?: string, lastName?: string) {
  const first = firstName?.[0] ?? ''
  const last = lastName?.[0] ?? ''
  const initials = `${first}${last}`.trim()
  return initials ? initials.toUpperCase() : '??'
}
