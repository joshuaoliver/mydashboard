import { createFileRoute, Link } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import { ArrowLeft, Mail, Phone, Instagram, Calendar, ExternalLink, User as UserIcon, Clock } from 'lucide-react'
import type { Id } from '../../convex/_generated/dataModel'

export const Route = createFileRoute('/contacts/$contactId')({
  component: ContactDetailPage,
})

function ContactDetailPage() {
  const { contactId } = Route.useParams()
  const { data: contact } = useSuspenseQuery(
    convexQuery(api.dexQueries.getContactById, { 
      contactId: contactId as Id<'contacts'> 
    })
  )

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Not set'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric',
      year: 'numeric' 
    })
  }

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.charAt(0) || ''
    const last = lastName?.charAt(0) || ''
    return (first + last).toUpperCase() || '?'
  }

  const formatLastSeen = (lastSeenString: string | undefined) => {
    if (!lastSeenString) return 'Unknown'
    const date = new Date(lastSeenString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
    return `${Math.floor(diffDays / 365)} years ago`
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Back Button */}
        <Button variant="ghost" asChild className="gap-2">
          <Link to="/contacts">
            <ArrowLeft className="w-4 h-4" />
            Back to Contacts
          </Link>
        </Button>

        {/* Header Card with Avatar */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-6">
              {/* Avatar */}
              {contact.imageUrl ? (
                <img
                  src={contact.imageUrl}
                  alt={`${contact.firstName} ${contact.lastName}`}
                  className="w-24 h-24 rounded-full object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white text-2xl font-semibold">
                  {getInitials(contact.firstName, contact.lastName)}
                </div>
              )}

              {/* Name & Info */}
              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-2">
                  {contact.firstName} {contact.lastName}
                </h1>
                {contact.instagram && (
                  <a
                    href={`https://instagram.com/${contact.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 mb-4"
                  >
                    <Instagram className="w-4 h-4" />
                    @{contact.instagram}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {contact.lastSeenAt && (
                  <div className="flex items-center gap-2 text-gray-600 mt-2">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">Last seen: {formatLastSeen(contact.lastSeenAt)}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Description */}
        {contact.description && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-blue-600" />
                About
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 whitespace-pre-wrap">{contact.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-green-600" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Emails */}
            {contact.emails && contact.emails.length > 0 ? (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Email addresses</p>
                <div className="space-y-2">
                  {contact.emails.map((emailObj, idx) => (
                    <a
                      key={idx}
                      href={`mailto:${emailObj.email}`}
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
                    >
                      <Mail className="w-4 h-4" />
                      {emailObj.email}
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">No email addresses</div>
            )}

            {/* Phones */}
            {contact.phones && contact.phones.length > 0 ? (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Phone numbers</p>
                <div className="space-y-2">
                  {contact.phones.map((phoneObj, idx) => (
                    <a
                      key={idx}
                      href={`tel:${phoneObj.phone}`}
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
                    >
                      <Phone className="w-4 h-4" />
                      {phoneObj.phone}
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">No phone numbers</div>
            )}

            {/* Birthday */}
            {contact.birthday && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Birthday</p>
                <div className="flex items-center gap-2 text-gray-700">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(contact.birthday)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sync Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-600">Sync Information</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 space-y-2">
            <div>
              <span className="font-medium">Last synced from Dex:</span>{' '}
              {formatTimestamp(contact.lastSyncedAt)}
            </div>
            <div>
              <span className="font-medium">Last modified locally:</span>{' '}
              {formatTimestamp(contact.lastModifiedAt)}
            </div>
            <div className="text-xs text-gray-500 mt-3">
              Contact ID: {contact.dexId}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
