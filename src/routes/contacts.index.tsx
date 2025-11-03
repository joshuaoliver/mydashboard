import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import { useState } from 'react'
import { Search, User, Mail, Instagram, Calendar, Plus } from 'lucide-react'

export const Route = createFileRoute('/contacts/')({
  component: ContactsListPage,
})

function ContactsListPage() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const { data: { contacts, total } } = useSuspenseQuery(
    convexQuery(api.dexQueries.listContacts, { 
      searchTerm: searchTerm || undefined,
      limit: 1000 
    })
  )

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return null
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.charAt(0) || ''
    const last = lastName?.charAt(0) || ''
    return (first + last).toUpperCase() || '?'
  }

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header with proper padding */}
        <div className="px-6 py-6 flex-shrink-0">
          <PageHeader
            title="Contacts"
            description={`${total} contact${total !== 1 ? 's' : ''} synced from Dex`}
            actions={
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add Custom Contact
              </Button>
            }
          />

          {/* Search Bar */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Search contacts by name, email, Instagram..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Contacts Table */}
        <div className="flex-1 overflow-auto px-6 pb-6">
          {contacts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">
                  {searchTerm ? 'No contacts found' : 'No contacts synced yet'}
                </p>
                {!searchTerm && (
                  <p className="text-sm text-gray-500">
                    Contacts will sync automatically from Dex every 2 hours
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Instagram</TableHead>
                    <TableHead>Birthday</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow 
                      key={contact._id}
                      className="cursor-pointer"
                      onClick={() => {
                        navigate({ to: '/contacts/$contactId', params: { contactId: contact._id } })
                      }}
                    >
                      <TableCell>
                        {contact.imageUrl ? (
                          <img
                            src={contact.imageUrl}
                            alt={`${contact.firstName} ${contact.lastName}`}
                            className="w-10 h-10 rounded-full object-cover"
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                              // Fallback to initials if image fails to load
                              const target = e.currentTarget;
                              target.style.display = 'none';
                              const fallback = document.createElement('div');
                              fallback.className = 'w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white text-sm font-semibold';
                              fallback.textContent = getInitials(contact.firstName, contact.lastName);
                              target.parentElement?.appendChild(fallback);
                            }}
                          />
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
                        {contact.emails && contact.emails.length > 0 ? (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate max-w-[200px]">{contact.emails[0].email}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.instagram ? (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Instagram className="w-4 h-4 flex-shrink-0" />
                            <span>@{contact.instagram}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.birthday ? (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4 flex-shrink-0" />
                            <span>{formatDate(contact.birthday)}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.description ? (
                          <p className="text-sm text-gray-600 line-clamp-2 max-w-[300px]">
                            {contact.description}
                          </p>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

