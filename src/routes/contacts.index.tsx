import { createFileRoute, Link } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import { useState } from 'react'
import { Search, User, Mail, Instagram, Calendar, ExternalLink } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'

export const Route = createFileRoute('/contacts/')({
  component: ContactsListPage,
})

function ContactsListPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const { data: { contacts } } = useSuspenseQuery(
    convexQuery(api.dexQueries.listContacts, { 
      searchTerm: searchTerm || undefined,
      limit: 100 
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
      <PageHeader
        title="Contacts"
        description={`${contacts.length} contacts synced from Dex`}
      />

      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            placeholder="Search contacts by name, email, Instagram..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Contacts Grid */}
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {contacts.map((contact) => (
              <Link
                key={contact._id}
                to="/contacts/$contactId"
                params={{ contactId: contact._id }}
              >
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      {contact.imageUrl ? (
                        <img
                          src={contact.imageUrl}
                          alt={`${contact.firstName} ${contact.lastName}`}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white font-semibold">
                          {getInitials(contact.firstName, contact.lastName)}
                        </div>
                      )}

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">
                          {contact.firstName} {contact.lastName}
                        </CardTitle>
                        {contact.instagram && (
                          <CardDescription className="flex items-center gap-1 mt-1">
                            <Instagram className="w-3 h-3" />
                            <span className="text-xs">@{contact.instagram}</span>
                          </CardDescription>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-2">
                    {/* Email */}
                    {contact.emails && contact.emails.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{contact.emails[0].email}</span>
                      </div>
                    )}

                    {/* Birthday */}
                    {contact.birthday && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4 flex-shrink-0" />
                        <span>{formatDate(contact.birthday)}</span>
                      </div>
                    )}

                    {/* Description Preview */}
                    {contact.description && (
                      <p className="text-sm text-gray-600 line-clamp-2 mt-2">
                        {contact.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

