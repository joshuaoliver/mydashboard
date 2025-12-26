import { useMemo, useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation } from 'convex/react'
import type { Id } from '../../../../convex/_generated/dataModel'
import { api } from '../../../../convex/_generated/api'
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
import { PinEntry } from '@/components/auth/PinEntry'
import { Button } from '@/components/ui/button'
import { Settings2, Check } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

type LeadStatus = 'Potential' | 'Talking' | 'Planning' | 'Dated' | 'Connected' | 'Current' | 'Former'
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
  setName?: string
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
  { id: 'Potential', name: 'Potential', key: 'Potential', label: 'Potential', accent: 'bg-purple-100 text-purple-700', border: 'border-purple-200' },
  { id: 'Talking', name: 'Talking', key: 'Talking', label: 'Talking', accent: 'bg-sky-100 text-sky-700', border: 'border-sky-200' },
  { id: 'Planning', name: 'Planning', key: 'Planning', label: 'Planning', accent: 'bg-amber-100 text-amber-700', border: 'border-amber-200' },
  { id: 'Dated', name: 'Drinks', key: 'Dated', label: 'Drinks', accent: 'bg-rose-100 text-rose-700', border: 'border-rose-200' },
  { id: 'Connected', name: 'Connected', key: 'Connected', label: 'Connected', accent: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-200' },
  { id: 'Current', name: 'Current', key: 'Current', label: 'Current', accent: 'bg-violet-100 text-violet-700', border: 'border-violet-200' },
  { id: 'Former', name: 'Former', key: 'Former', label: 'Former', accent: 'bg-slate-200 text-slate-700', border: 'border-slate-300' },
]

const STORAGE_KEY = 'dating-visible-columns'
const DEFAULT_VISIBLE = ['Potential', 'Talking', 'Planning', 'Dated', 'Connected', 'Current']

export const Route = createFileRoute('/_authenticated/people/dating')({
  component: DatingPageWrapper,
})

// Wrapper component to handle PIN protection
function DatingPageWrapper() {
  const [isDatingUnlocked, setIsDatingUnlocked] = useState(() => {
    return sessionStorage.getItem('dating-unlocked') === 'true'
  })

  const handlePinUnlock = () => {
    sessionStorage.setItem('dating-unlocked', 'true')
    setIsDatingUnlocked(true)
  }

  // Show PIN entry if dating page is not unlocked
  if (!isDatingUnlocked) {
    return <PinEntry onUnlock={handlePinUnlock} />
  }

  return <DatingPage />
}

function DatingPage() {
  const [selectedContactId, setSelectedContactId] = useState<Id<'contacts'> | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null)
  
  // Track which columns are visible - load from localStorage
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return new Set(Array.isArray(parsed) ? parsed : DEFAULT_VISIBLE)
      }
    } catch {}
    return new Set(DEFAULT_VISIBLE)
  })

  // Save to localStorage when visibility changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(visibleColumns)))
  }, [visibleColumns])

  const data = useQuery(api.dexQueries.listContactsWithLeadStatus, {})
  const updateLeadStatus = useMutation(api.contactMutations.updateLeadStatus)

  // Data comes pre-filtered and sorted from backend
  const datingContacts = data?.contacts ?? []

  const kanbanData = useMemo(() => {
    return datingContacts.map((contact) => {
      const statusKey = contact.leadStatus || 'NoStatus'
      const column = LEAD_STATUS_METADATA.find((col) => col.key === statusKey)
      return { id: contact._id, name: getContactLabel(contact), column: column?.id ?? 'NoStatus', contact }
    })
  }, [datingContacts])

  // Filter columns to only show visible ones
  const visibleColumnsList = useMemo(() => {
    return LEAD_STATUS_METADATA.filter(col => visibleColumns.has(col.id))
  }, [visibleColumns])

  const selectedContact = useQuery(api.dexQueries.getContactById, selectedContactId ? { contactId: selectedContactId } : 'skip')

  const handleOpenContact = (contactId: Id<'contacts'>) => { setSelectedContactId(contactId); setSheetOpen(true) }
  const handleCloseSheet = () => { setSheetOpen(false); setSelectedContactId(null) }
  
  const toggleColumnVisibility = (columnId: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev)
      if (next.has(columnId)) {
        // Don't allow hiding all columns
        if (next.size > 1) {
          next.delete(columnId)
        }
      } else {
        next.add(columnId)
      }
      return next
    })
  }
  
  const handleDragOver = (event: DragOverEvent) => {
    if (!event.over) { setDraggedOverColumn(null); return }
    const column = LEAD_STATUS_METADATA.find((col) => col.id === event.over!.id)
    if (column) { setDraggedOverColumn(column.id); return }
    const overItem = kanbanData.find((item) => item.id === event.over!.id)
    if (overItem) setDraggedOverColumn(overItem.column)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    // Save draggedOverColumn before clearing it (for fallback logic)
    const savedDraggedOverColumn = draggedOverColumn
    setDraggedOverColumn(null)
    
    if (!over || active.id === over.id) return
    
    // Find the target column - check if dropped on column or on a card
    let targetColumn = LEAD_STATUS_METADATA.find((col) => col.id === over.id)
    if (!targetColumn) {
      // Dropped on a card - find what column that card is in
      const overItem = kanbanData.find((item) => item.id === over.id)
      if (overItem) targetColumn = LEAD_STATUS_METADATA.find((col) => col.id === overItem.column)
    }
    // Fallback to the column we were dragging over
    if (!targetColumn && savedDraggedOverColumn) {
      targetColumn = LEAD_STATUS_METADATA.find((col) => col.id === savedDraggedOverColumn)
    }
    
    if (!targetColumn) return
    
    // Get the ORIGINAL lead status from the Convex data, not the mutated kanbanData
    // The Kanban component mutates kanbanData during drag, so we need to check the source data
    const activeContact = datingContacts.find((c) => c._id === active.id)
    const currentLeadStatus = activeContact?.leadStatus
    
    // Check if already in this column (using original data, not mutated)
    if (currentLeadStatus === targetColumn.key) return
    
    // Update the lead status in the database
    const newStatus = targetColumn.key === 'NoStatus' ? null : (targetColumn.key as LeadStatus)
    try {
      await updateLeadStatus({ 
        contactId: active.id as Id<'contacts'>, 
        leadStatus: newStatus 
      })
    } catch (error) {
      console.error('Failed to update lead status:', error)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Minimal header with just the settings button */}
      <div className="flex items-center justify-end px-6 py-3 border-b">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <Settings2 className="h-4 w-4" />
              <span className="text-sm">Columns</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-48 p-2">
            <div className="space-y-1">
              {LEAD_STATUS_METADATA.map((col) => {
                const isVisible = visibleColumns.has(col.id)
                const count = kanbanData.filter(item => item.column === col.id).length
                return (
                  <button
                    key={col.id}
                    onClick={() => toggleColumnVisibility(col.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors',
                      isVisible ? 'bg-slate-100' : 'hover:bg-slate-50'
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center',
                      isVisible ? 'bg-slate-900 border-slate-900' : 'border-slate-300'
                    )}>
                      {isVisible && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <span className="flex-1 text-left">{col.label}</span>
                    <span className="text-xs text-slate-400">{count}</span>
                  </button>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      
      <div className="flex-1 overflow-auto px-4 py-4">
        {datingContacts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white py-16 text-center">
            <p className="text-lg font-semibold text-slate-900">No dating contacts yet</p>
            <p className="text-sm text-slate-600">Assign a lead status to a contact to track them here.</p>
          </div>
        ) : (
          <div className="h-full">
            <KanbanProvider columns={visibleColumnsList} data={kanbanData} onDragEnd={handleDragEnd} onDragOver={handleDragOver}>
              {(column: typeof LEAD_STATUS_METADATA[number]) => {
                const columnContacts = kanbanData.filter((item) => item.column === column.id)
                
                return (
                  <KanbanBoard id={column.id} key={column.id}>
                    <KanbanHeader className={cn('flex items-center justify-between border-b px-3 py-2', column.border)}>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-sm font-semibold text-slate-900 truncate">{column.label}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 flex-shrink-0">{columnContacts.length}</span>
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
                              <div className="text-sm font-semibold text-slate-900 truncate">{item.name}</div>
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
  // Prioritize: setName (override) > actual name > Instagram handle
  if (contact.setName) return contact.setName
  if (contact.firstName || contact.lastName) return [contact.firstName, contact.lastName].filter(Boolean).join(' ')
  if (contact.instagram) return `@${contact.instagram}`
  return 'Unnamed contact'
}

function getInitials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '??'
}
