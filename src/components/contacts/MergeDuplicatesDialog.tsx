import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Instagram, Phone } from 'lucide-react'
import { useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'

interface Contact {
  _id: Id<"contacts">
  firstName?: string
  lastName?: string
  description?: string
  instagram?: string
  whatsapp?: string
  imageUrl?: string
  emails?: Array<{ email: string }>
  phones?: Array<{ phone: string }>
  connections?: string[]
  notes?: string
  leadStatus?: string
  dexId?: string
}

interface Duplicate {
  contactId: string
  contact: Contact
  matchReason: string
  confidence: "high" | "medium" | "low"
}

interface MergeDuplicatesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentContact: Contact
  duplicates: Duplicate[]
  onMerge: (primaryId: Id<"contacts">, duplicateId: Id<"contacts">) => Promise<void>
}

export function MergeDuplicatesDialog({
  open,
  onOpenChange,
  currentContact,
  duplicates,
  onMerge,
}: MergeDuplicatesDialogProps) {
  const [merging, setMerging] = useState(false)
  const [selectedDuplicate, setSelectedDuplicate] = useState<Duplicate | null>(null)

  const handleMerge = async () => {
    if (!selectedDuplicate) return
    
    setMerging(true)
    try {
      await onMerge(currentContact._id, selectedDuplicate.contact._id as Id<"contacts">)
      onOpenChange(false)
      setSelectedDuplicate(null)
    } catch (err) {
      console.error('Merge failed:', err)
      alert('Failed to merge contacts: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setMerging(false)
    }
  }

  const getFullName = (contact: Contact) => {
    return [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unknown"
  }

  const confidenceColors = {
    high: "bg-red-100 text-red-800 border-red-300",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
    low: "bg-gray-100 text-gray-800 border-gray-300",
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            Potential Duplicate Contacts Found
          </DialogTitle>
          <DialogDescription>
            The following contacts might be duplicates of{' '}
            <strong>{getFullName(currentContact)}</strong>. 
            Select a duplicate to merge it with the current contact.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Contact Card */}
          <div className="p-4 bg-blue-50 border-2 border-blue-500 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              {currentContact.imageUrl ? (
                <img
                  src={currentContact.imageUrl}
                  alt={getFullName(currentContact)}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                  {getFullName(currentContact).charAt(0)}
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{getFullName(currentContact)}</h3>
                <Badge variant="outline" className="text-xs">Current Contact (Keep)</Badge>
              </div>
            </div>
            <div className="text-sm space-y-1 text-gray-700">
              {currentContact.instagram && (
                <div className="flex items-center gap-2">
                  <Instagram className="w-3 h-3" />
                  @{currentContact.instagram}
                </div>
              )}
              {currentContact.whatsapp && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3 h-3" />
                  {currentContact.whatsapp}
                </div>
              )}
              {currentContact.dexId && (
                <div className="text-xs text-gray-500">Dex ID: {currentContact.dexId}</div>
              )}
            </div>
          </div>

          {/* Duplicates List */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-gray-700">Select duplicate to merge:</h4>
            {duplicates.map((dup) => (
              <button
                key={dup.contactId}
                onClick={() => setSelectedDuplicate(dup)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  selectedDuplicate?.contactId === dup.contactId
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3 flex-1">
                    {dup.contact.imageUrl ? (
                      <img
                        src={dup.contact.imageUrl}
                        alt={getFullName(dup.contact)}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center text-white font-semibold text-sm">
                        {getFullName(dup.contact).charAt(0)}
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-medium">{getFullName(dup.contact)}</h3>
                      <p className="text-xs text-gray-600">{dup.matchReason}</p>
                    </div>
                  </div>
                  <Badge className={`text-xs ${confidenceColors[dup.confidence]}`}>
                    {dup.confidence} confidence
                  </Badge>
                </div>
                <div className="text-sm space-y-1 text-gray-700 ml-13">
                  {dup.contact.instagram && (
                    <div className="flex items-center gap-2">
                      <Instagram className="w-3 h-3" />
                      @{dup.contact.instagram}
                    </div>
                  )}
                  {dup.contact.whatsapp && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3 h-3" />
                      {dup.contact.whatsapp}
                    </div>
                  )}
                  {dup.contact.dexId && (
                    <div className="text-xs text-gray-500">Dex ID: {dup.contact.dexId}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={merging}>
            Cancel
          </Button>
          <Button
            onClick={handleMerge}
            disabled={!selectedDuplicate || merging}
          >
            {merging ? 'Merging...' : 'Merge Selected Contact'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

