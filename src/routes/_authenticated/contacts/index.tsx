import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../../../convex/_generated/api'
import { useState, useCallback } from 'react'
import { Search, User, Mail, Instagram, Calendar, Plus, Phone, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/contacts/')({
  component: ContactsListPage,
})

const PAGE_SIZE = 50

function ContactsListPage() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [cursorHistory, setCursorHistory] = useState<(string | undefined)[]>([])

  // Debounce search input
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value)
    // Reset pagination when search changes
    setCursor(undefined)
    setCursorHistory([])
    // Debounce the actual search
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(value)
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [])

  const { data, isLoading, isFetching } = useQuery(
    convexQuery(api.dexQueries.listContactsPaginated, { 
      searchTerm: debouncedSearch || undefined, 
      limit: PAGE_SIZE,
      cursor: cursor,
    })
  )

  const contacts = data?.contacts ?? []
  const total = data?.total ?? 0
  const nextCursor = data?.nextCursor
  const currentPage = cursorHistory.length + 1
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const handleNextPage = () => {
    if (nextCursor) {
      setCursorHistory(prev => [...prev, cursor])
      setCursor(nextCursor)
    }
  }

  const handlePrevPage = () => {
    if (cursorHistory.length > 0) {
      const newHistory = [...cursorHistory]
      const prevCursor = newHistory.pop()
      setCursorHistory(newHistory)
      setCursor(prevCursor)
    }
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getInitials = (firstName?: string, lastName?: string) => {
    return ((firstName?.charAt(0) || '') + (lastName?.charAt(0) || '')).toUpperCase() || '?'
  }

  const formatPhone = (phones: { phone: string }[] | undefined) => {
    if (!phones || phones.length === 0) return null
    return phones[0].phone
  }

  // Calculate showing range
  const startIndex = cursorHistory.length * PAGE_SIZE + 1
  const endIndex = Math.min(startIndex + contacts.length - 1, total)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-6 py-6 flex-shrink-0">
        <PageHeader
          title="Contacts"
          description={`${total.toLocaleString()} contact${total !== 1 ? 's' : ''} synced from Dex`}
          actions={<Button className="gap-2"><Plus className="w-4 h-4" />Add Custom Contact</Button>}
        />
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input 
            placeholder="Search contacts by name, email, phone, or Instagram..." 
            value={searchTerm} 
            onChange={(e) => handleSearchChange(e.target.value)} 
            className="pl-10" 
          />
          {isFetching && (
            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 animate-spin" />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="w-8 h-8 text-gray-400 mx-auto mb-4 animate-spin" />
              <p className="text-gray-600">Loading contacts...</p>
            </CardContent>
          </Card>
        ) : contacts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">{debouncedSearch ? 'No contacts found' : 'No contacts synced yet'}</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Instagram</TableHead>
                  <TableHead>Birthday</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow 
                    key={contact._id} 
                    className="cursor-pointer hover:bg-muted/50" 
                    onClick={() => navigate({ to: '/contacts/$contactId', params: { contactId: contact._id } })}
                  >
                    <TableCell>
                      {contact.imageUrl ? (
                        <img src={contact.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white text-sm font-semibold">
                          {getInitials(contact.firstName, contact.lastName)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {contact.firstName} {contact.lastName}
                    </TableCell>
                    <TableCell>
                      {formatPhone(contact.phones) ? (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="w-4 h-4" />
                          {formatPhone(contact.phones)}
                        </div>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      {contact.emails?.[0]?.email ? (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail className="w-4 h-4" />
                          <span className="truncate max-w-[180px]">{contact.emails[0].email}</span>
                        </div>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      {contact.instagram ? (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Instagram className="w-4 h-4" />
                          @{contact.instagram}
                        </div>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      {contact.birthday ? (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          {formatDate(contact.birthday)}
                        </div>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <div className="text-sm text-gray-600">
                  Showing {startIndex.toLocaleString()}–{endIndex.toLocaleString()} of {total.toLocaleString()} contacts
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handlePrevPage}
                    disabled={cursorHistory.length === 0 || isFetching}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600 px-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleNextPage}
                    disabled={!nextCursor || isFetching}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
