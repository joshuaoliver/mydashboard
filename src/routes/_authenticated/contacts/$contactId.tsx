import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../../../convex/_generated/api'
import { ArrowLeft, Mail, Phone, Instagram, Calendar, ExternalLink, User as UserIcon, Clock } from 'lucide-react'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/_authenticated/contacts/$contactId')({
  component: ContactDetailPage,
})

function ContactDetailPage() {
  const { contactId } = Route.useParams()
  const { data: contact } = useQuery(convexQuery(api.dexQueries.getContactById, { contactId: contactId as Id<'contacts'> }))

  const formatTimestamp = (ts: number) => new Date(ts).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  const formatDate = (s: string | undefined) => s ? new Date(s).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not set'
  const getInitials = (f?: string, l?: string) => ((f?.charAt(0) || '') + (l?.charAt(0) || '')).toUpperCase() || '?'
  const formatLastSeen = (s: string | undefined) => {
    if (!s) return 'Unknown'
    const d = Math.floor((Date.now() - new Date(s).getTime()) / 86400000)
    if (d === 0) return 'Today'
    if (d === 1) return 'Yesterday'
    if (d < 7) return `${d} days ago`
    if (d < 30) return `${Math.floor(d / 7)} weeks ago`
    if (d < 365) return `${Math.floor(d / 30)} months ago`
    return `${Math.floor(d / 365)} years ago`
  }

  if (!contact) {
    return (
      <div className="space-y-6 max-w-4xl p-6">
        <Button variant="ghost" asChild className="gap-2"><Link to="/contacts"><ArrowLeft className="w-4 h-4" />Back to Contacts</Link></Button>
        <div className="text-center py-12 text-gray-500">Loading contact...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl p-6">
      <Button variant="ghost" asChild className="gap-2"><Link to="/contacts"><ArrowLeft className="w-4 h-4" />Back to Contacts</Link></Button>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            {contact.imageUrl ? <img src={contact.imageUrl} alt="" className="w-24 h-24 rounded-full object-cover" /> : <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white text-2xl font-semibold">{getInitials(contact.firstName, contact.lastName)}</div>}
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{contact.firstName} {contact.lastName}</h1>
              {contact.instagram && <a href={`https://instagram.com/${contact.instagram}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 mb-4"><Instagram className="w-4 h-4" />@{contact.instagram}<ExternalLink className="w-3 h-3" /></a>}
              {contact.lastSeenAt && <div className="flex items-center gap-2 text-gray-600 mt-2"><Clock className="w-4 h-4" /><span className="text-sm">Last seen: {formatLastSeen(contact.lastSeenAt)}</span></div>}
            </div>
          </div>
        </CardContent>
      </Card>
      {contact.description && <Card><CardHeader><CardTitle className="flex items-center gap-2"><UserIcon className="w-5 h-5 text-blue-600" />About</CardTitle></CardHeader><CardContent><p className="text-gray-700 whitespace-pre-wrap">{contact.description}</p></CardContent></Card>}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5 text-green-600" />Contact Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {contact.emails?.length ? <div><p className="text-sm font-medium text-gray-700 mb-2">Email addresses</p>{contact.emails.map((e, i) => <a key={i} href={`mailto:${e.email}`} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"><Mail className="w-4 h-4" />{e.email}</a>)}</div> : <div className="text-sm text-gray-500">No email addresses</div>}
          {contact.phones?.length ? <div><p className="text-sm font-medium text-gray-700 mb-2">Phone numbers</p>{contact.phones.map((p, i) => <a key={i} href={`tel:${p.phone}`} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"><Phone className="w-4 h-4" />{p.phone}</a>)}</div> : <div className="text-sm text-gray-500">No phone numbers</div>}
          {contact.birthday && <div><p className="text-sm font-medium text-gray-700 mb-2">Birthday</p><div className="flex items-center gap-2 text-gray-700"><Calendar className="w-4 h-4" />{formatDate(contact.birthday)}</div></div>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm text-gray-600">Sync Information</CardTitle></CardHeader>
        <CardContent className="text-sm text-gray-600 space-y-2">
          <div><span className="font-medium">Last synced:</span> {formatTimestamp(contact.lastSyncedAt)}</div>
          <div><span className="font-medium">Last modified:</span> {formatTimestamp(contact.lastModifiedAt)}</div>
          <div className="text-xs text-gray-500 mt-3">Contact ID: {contact.dexId}</div>
        </CardContent>
      </Card>
    </div>
  )
}
