import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { User, Save } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

interface Contact {
  _id: Id<"contacts">
  firstName?: string
  lastName?: string
  description?: string
  instagram?: string
  imageUrl?: string
  connection?: "Professional" | "Friend" | "Good friend" | "Romantic" | "Other"
  notes?: string
}

interface ContactPanelProps {
  contact: Contact | null
  isLoading?: boolean
  searchedUsername?: string  // For debugging - show what username we searched for
}

const connectionOptions = [
  { value: "Professional", emoji: "💼", label: "Professional" },
  { value: "Friend", emoji: "👥", label: "Friend" },
  { value: "Good friend", emoji: "🤝", label: "Good friend" },
  { value: "Romantic", emoji: "💝", label: "Romantic" },
  { value: "Other", emoji: "⚙️", label: "Other" },
] as const

export function ContactPanel({ contact, isLoading, searchedUsername }: ContactPanelProps) {
  const [selectedConnection, setSelectedConnection] = useState<string | undefined>(contact?.connection)
  const [notes, setNotes] = useState(contact?.notes || "")
  const [isSaving, setIsSaving] = useState(false)
  
  const updateConnection = useMutation(api.contactMutations.updateContactConnection)
  const updateNotes = useMutation(api.contactMutations.updateContactNotes)

  // Update local state when contact changes
  useEffect(() => {
    setSelectedConnection(contact?.connection)
    setNotes(contact?.notes || "")
  }, [contact])

  const handleConnectionSelect = async (value: typeof connectionOptions[number]['value']) => {
    if (!contact) return
    
    setSelectedConnection(value)
    setIsSaving(true)
    
    try {
      await updateConnection({
        contactId: contact._id,
        connection: value,
      })
    } catch (error) {
      console.error('Failed to update connection:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveNotes = async () => {
    if (!contact) return
    
    setIsSaving(true)
    try {
      await updateNotes({
        contactId: contact._id,
        notes,
      })
    } catch (error) {
      console.error('Failed to update notes:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // No contact matched state
  if (!contact && !isLoading) {
    return (
      <div className="h-full flex items-center justify-center px-6 py-8 border-b border-gray-200 bg-gray-50">
        <div className="text-center">
          <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500">No contact matched</p>
          {searchedUsername ? (
            <div className="mt-2 text-xs text-gray-600 bg-gray-100 px-3 py-2 rounded-lg inline-block">
              <p className="font-medium mb-1">Searched for:</p>
              <code className="text-blue-600">@{searchedUsername}</code>
              <p className="mt-1 text-gray-500">Not found in Dex contacts</p>
            </div>
          ) : (
            <p className="text-xs text-gray-400 mt-1">No Instagram username available</p>
          )}
        </div>
      </div>
    )
  }

  // Loading state
  if (isLoading || !contact) {
    return (
      <div className="h-full flex items-center justify-center px-6 py-8 border-b border-gray-200">
        <div className="text-sm text-gray-500">Loading contact...</div>
      </div>
    )
  }

  const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unknown"
  const initials = contactName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="h-full flex flex-col border-b border-gray-200 bg-white overflow-y-auto">
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
        {/* Contact Header */}
        <div className="flex items-center gap-3 mb-4">
          {contact.imageUrl ? (
            <img
              src={contact.imageUrl}
              alt={contactName}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{contactName}</h3>
            {contact.instagram && (
              <p className="text-sm text-gray-500">@{contact.instagram}</p>
            )}
          </div>
        </div>

        {/* Connection Type Selector */}
        <div className="mb-4">
          <Label className="text-xs text-gray-600 mb-2 block">Connection Type</Label>
          <div className="flex flex-wrap gap-2">
            {connectionOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleConnectionSelect(option.value)}
                disabled={isSaving}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  selectedConnection === option.value
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                    : 'bg-gray-50 text-gray-700 border-2 border-gray-200 hover:border-gray-300'
                }`}
              >
                <span>{option.emoji}</span>
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Description from Dex */}
        {contact.description && (
          <div className="mb-4">
            <Label className="text-xs text-gray-600 mb-1 block">Description (from Dex)</Label>
            <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-200">
              {contact.description}
            </p>
          </div>
        )}

        {/* Notes Field */}
        <div>
          <Label htmlFor="contact-notes" className="text-xs text-gray-600 mb-1 block">
            Local Notes
          </Label>
          <Textarea
            id="contact-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this contact..."
            className="min-h-[80px] text-sm"
            disabled={isSaving}
          />
          {notes !== (contact.notes || "") && (
            <Button
              onClick={handleSaveNotes}
              disabled={isSaving}
              size="sm"
              className="mt-2 w-full"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Notes'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

