import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { User, Save, Lock, Unlock, X, Check, AlertCircle, MoreVertical, Merge, Pencil } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { MergeDuplicatesDialog } from '../contacts/MergeDuplicatesDialog'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp'

const CORRECT_PIN = "2010"

interface Contact {
  _id: Id<"contacts">
  firstName?: string
  lastName?: string
  description?: string
  instagram?: string
  imageUrl?: string
  connections?: string[]
  notes?: string
  objective?: string
  sex?: string[]
  privateNotes?: string
  tagIds?: Id<"tags">[]
  locationIds?: Id<"locations">[]
  intimateConnection?: boolean
  intimateConnectionDate?: string
  leadStatus?: "Talking" | "Planning" | "Dated" | "Connected" | "Current" | "Former"
  setName?: string
  priority?: number
}

interface ContactPanelProps {
  contact: Contact | null
  isLoading?: boolean
  searchedUsername?: string
  searchedPhoneNumber?: string // WhatsApp phone number
}

const connectionOptions = [
  { value: "Professional", emoji: "💼", label: "Professional" },
  { value: "Friend", emoji: "👥", label: "Friend" },
  { value: "Good friend", emoji: "🤝", label: "Good friend" },
  { value: "Romantic", emoji: "💝", label: "Romantic" },
  { value: "Party", emoji: "🎉", label: "Party" },
  { value: "Other", emoji: "⚙️", label: "Other" },
] as const

const sexOptions = [
  { value: "Female", emoji: "👧", label: "Female" },
  { value: "Male", emoji: "👦", label: "Male" },
] as const

const leadStatusOptions = [
  { value: "Talking", label: "Talking" },
  { value: "Planning", label: "Planning" },
  { value: "Dated", label: "Dated" },
  { value: "Connected", label: "Connected" },
  { value: "Current", label: "Current" },
  { value: "Former", label: "Former" },
] as const

export function ContactPanel({ contact, isLoading, searchedUsername, searchedPhoneNumber }: ContactPanelProps) {
  const [notes, setNotes] = useState(contact?.notes || "")
  const [objective, setObjective] = useState(contact?.objective || "")
  const [isSaving, setIsSaving] = useState(false)
  const [isPinUnlocked, setIsPinUnlocked] = useState(false)
  const [pin, setPin] = useState("")
  const [pinError, setPinError] = useState(false)
  const [isHoverRevealed, setIsHoverRevealed] = useState(false)
  const [isPinHovered, setIsPinHovered] = useState(false)
  const [currentContactId, setCurrentContactId] = useState<string | undefined>(contact?._id)
  const [isLocationPopoverOpen, setIsLocationPopoverOpen] = useState(false)
  const [locationSearch, setLocationSearch] = useState("")
  const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false)
  const [tagSearch, setTagSearch] = useState("")
  
  // Extended fields state
  const [privateNotes, setPrivateNotes] = useState(contact?.privateNotes || "")
  const [intimateConnection, setIntimateConnection] = useState(contact?.intimateConnection || false)
  const [intimateConnectionDate, setIntimateConnectionDate] = useState(contact?.intimateConnectionDate || "")
  const [leadStatus, setLeadStatus] = useState<string | undefined>(contact?.leadStatus)
  
  // Name editing state
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedSetName, setEditedSetName] = useState(contact?.setName || "")
  
  // Priority state
  const [priority, setPriority] = useState<number>(contact?.priority || 50)
  
  // Duplicate detection state
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  
  // Mutations
  const toggleConnection = useMutation(api.contactMutations.toggleConnectionType)
  const toggleSexMutation = useMutation(api.contactMutations.toggleSex)
  const updateNotes = useMutation(api.contactMutations.updateContactNotes)
  const updateObjectiveMutation = useMutation(api.contactMutations.updateContactObjective)
  const updatePrivateNotes = useMutation(api.contactMutations.updatePrivateNotes)
  const toggleLocationMutation = useMutation(api.contactMutations.toggleLocation)
  const updateIntimateConn = useMutation(api.contactMutations.updateIntimateConnection)
  const updateLeadStatusMutation = useMutation(api.contactMutations.updateLeadStatus)
  const createContactMutation = useMutation(api.contactMutations.createContact)
  const createLocationMutation = useMutation(api.locationMutations.createLocation)
  const createTagMutation = useMutation(api.tagMutations.createTag)
  const toggleTagMutation = useMutation(api.tagMutations.toggleTag)
  const mergeContactsMutation = useMutation(api.contactMerge.mergeContacts)
  const updateSetNameMutation = useMutation(api.contactMutations.updateSetName)
  const updatePriorityMutation = useMutation(api.contactMutations.updatePriority)
  
  // Query locations, tags, and duplicates
  const locations = useQuery(api.locationQueries.listLocations)
  const tags = useQuery(api.tagQueries.listTags)
  const duplicates = useQuery(
    api.contactDuplicates.findDuplicates,
    contact?._id ? { contactId: contact._id } : "skip"
  )

  // Reset hover and PIN states when contact changes
  useEffect(() => {
    if (contact?._id !== currentContactId) {
      setCurrentContactId(contact?._id)
      setIsHoverRevealed(false)
      setIsPinUnlocked(false)
      setIsPinHovered(false)
      setPin("")
      setPinError(false)
    }
  }, [contact?._id, currentContactId])

  // Auto-hide after 2 minutes of no interaction
  useEffect(() => {
    if (!isHoverRevealed) return
    
    const hideTimer = setTimeout(() => {
      setIsHoverRevealed(false)
    }, 2 * 60 * 1000) // 2 minutes
    
    return () => clearTimeout(hideTimer)
  }, [isHoverRevealed])

  // Auto-lock PIN after 2 minutes
  useEffect(() => {
    if (!isPinUnlocked) return
    
    const lockTimer = setTimeout(() => {
      setIsPinUnlocked(false)
      setPin("")
    }, 2 * 60 * 1000) // 2 minutes
    
    return () => clearTimeout(lockTimer)
  }, [isPinUnlocked])

  // Update local state when contact changes
  useEffect(() => {
    setNotes(contact?.notes || "")
    setObjective(contact?.objective || "")
    setPrivateNotes(contact?.privateNotes || "")
    setIntimateConnection(contact?.intimateConnection || false)
    setIntimateConnectionDate(contact?.intimateConnectionDate || "")
    setLeadStatus(contact?.leadStatus)
    setEditedSetName(contact?.setName || "")
    setPriority(contact?.priority || 50)
    setIsEditingName(false)
  }, [contact])

  const handleConnectionToggle = async (connectionType: string) => {
    if (!contact) return
    
    setIsSaving(true)
    try {
      await toggleConnection({
        contactId: contact._id,
        connectionType,
      })
    } catch (error) {
      console.error('Failed to toggle connection:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSexToggle = async (sexType: string) => {
    if (!contact) return
    
    setIsSaving(true)
    try {
      await toggleSexMutation({
        contactId: contact._id,
        sexType,
      })
    } catch (error) {
      console.error('Failed to toggle sex:', error)
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

  const handleSaveObjective = async () => {
    if (!contact) return
    
    setIsSaving(true)
    try {
      await updateObjectiveMutation({
        contactId: contact._id,
        objective,
      })
    } catch (error) {
      console.error('Failed to update objective:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSavePrivateNotes = async () => {
    if (!contact) return
    
    setIsSaving(true)
    try {
      await updatePrivateNotes({
        contactId: contact._id,
        privateNotes,
      })
    } catch (error) {
      console.error('Failed to update private notes:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleLocation = async (locationId: Id<"locations">) => {
    if (!contact) return
    
    setIsSaving(true)
    try {
      await toggleLocationMutation({
        contactId: contact._id,
        locationId,
      })
    } catch (error) {
      console.error('Failed to toggle location:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleTag = async (tagId: Id<"tags">) => {
    if (!contact) return
    
    setIsSaving(true)
    try {
      await toggleTagMutation({
        contactId: contact._id,
        tagId,
      })
    } catch (error) {
      console.error('Failed to toggle tag:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleIntimateConnection = async (checked: boolean) => {
    if (!contact) return
    
    setIntimateConnection(checked)
    setIsSaving(true)
    try {
      await updateIntimateConn({
        contactId: contact._id,
        intimateConnection: checked,
        intimateConnectionDate: checked ? intimateConnectionDate : undefined,
      })
    } catch (error) {
      console.error('Failed to update intimate connection:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleIntimateConnectionDateChange = async (date: string) => {
    if (!contact) return
    
    setIntimateConnectionDate(date)
    setIsSaving(true)
    try {
      await updateIntimateConn({
        contactId: contact._id,
        intimateConnection: intimateConnection,
        intimateConnectionDate: date,
      })
    } catch (error) {
      console.error('Failed to update intimate connection date:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleLeadStatusToggle = async (status: string) => {
    if (!contact) return
    
    // Toggle: if already selected, clear it; otherwise set it
    const newStatus = leadStatus === status ? null : (status as typeof leadStatusOptions[number]['value'])
    setLeadStatus(newStatus ?? undefined)
    setIsSaving(true)
    try {
      await updateLeadStatusMutation({
        contactId: contact._id,
        leadStatus: newStatus,
      })
    } catch (error) {
      console.error('Failed to update lead status:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreateAndSelectLocation = async (name: string) => {
    if (!name.trim()) return
    
    setIsSaving(true)
    try {
      const locationId = await createLocationMutation({
        name: name.trim(),
      })
      // Auto-select the newly created location
      await handleToggleLocation(locationId)
      setLocationSearch("")
    } catch (error) {
      console.error('Failed to create location:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreateAndSelectTag = async (name: string) => {
    if (!name.trim()) return
    
    setIsSaving(true)
    try {
      const { tagId } = await createTagMutation({
        name: name.trim(),
      })
      // Auto-select the newly created tag
      await handleToggleTag(tagId)
      setTagSearch("")
    } catch (error) {
      console.error('Failed to create tag:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemoveTag = async (tagId: Id<"tags">) => {
    await handleToggleTag(tagId)
  }

  const handleRemoveLocation = (locationId: Id<"locations">) => {
    handleToggleLocation(locationId)
  }

  const handleSaveSetName = async () => {
    if (!contact) return
    
    setIsSaving(true)
    try {
      await updateSetNameMutation({
        contactId: contact._id,
        setName: editedSetName.trim() || null,
      })
      setIsEditingName(false)
    } catch (error) {
      console.error('Failed to update set name:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEditName = () => {
    setEditedSetName(contact?.setName || "")
    setIsEditingName(false)
  }

  const handlePriorityChange = async (value: number[]) => {
    if (!contact) return
    
    const newPriority = value[0]
    setPriority(newPriority)
    
    // Debounce the save - we'll save on mouse up / interaction end
  }

  const handlePriorityCommit = async (value: number[]) => {
    if (!contact) return
    
    const newPriority = value[0]
    try {
      await updatePriorityMutation({
        contactId: contact._id,
        priority: newPriority,
      })
    } catch (error) {
      console.error('Failed to update priority:', error)
    }
  }

  const handlePinComplete = (value: string) => {
    if (value === CORRECT_PIN) {
      setPinError(false)
      setIsPinUnlocked(true)
    } else {
      setPinError(true)
      setTimeout(() => {
        setPin("")
        setPinError(false)
      }, 1000)
    }
  }

  const handleCreateContact = async () => {
    if (!searchedUsername && !searchedPhoneNumber) return
    
    setIsSaving(true)
    try {
      await createContactMutation({
        instagram: searchedUsername,
        whatsapp: searchedPhoneNumber,
        phoneNumber: searchedPhoneNumber, // For iMessage contacts
      })
      // Contact will be refetched automatically via Convex reactivity
    } catch (error) {
      console.error('Failed to create contact:', error)
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
          {(searchedUsername || searchedPhoneNumber) ? (
            <div className="mt-4 space-y-3">
              <div className="text-xs text-gray-600 bg-gray-100 px-3 py-2 rounded-lg inline-block">
                <p className="font-medium mb-1">Searched for:</p>
                {searchedUsername && (
                  <div className="mb-1">
                    <span className="text-gray-500">Instagram: </span>
                    <code className="text-blue-600">@{searchedUsername}</code>
                  </div>
                )}
                {searchedPhoneNumber && (
                  <div className="mb-1">
                    <span className="text-gray-500">Phone: </span>
                    <code className="text-green-600">{searchedPhoneNumber}</code>
                  </div>
                )}
                <p className="mt-1 text-gray-500">Not found in contacts</p>
              </div>
              <Button
                onClick={handleCreateContact}
                disabled={isSaving}
                className="w-full max-w-xs"
              >
                {isSaving ? 'Creating...' : 'Create Contact'}
              </Button>
              <p className="text-xs text-gray-400 mt-2">
                {searchedPhoneNumber && !searchedUsername 
                  ? "Create contact for iMessage. Won't sync to Dex."
                  : "Create now, sync later. When Dex syncs, matching contacts will be linked automatically."
                }
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-400 mt-1">Select a chat to view contact details</p>
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

  const originalName = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unknown"
  const displayName = contact.setName || originalName
  const showOriginalInParens = contact.setName && contact.setName !== originalName
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const selectedConnections = contact.connections || []
  const selectedSex = contact.sex || []
  const selectedTags = contact.tagIds || []
  const selectedLocations = contact.locationIds || []

  return (
    <div 
      className="h-full flex flex-col border-b border-gray-200 bg-white overflow-y-auto"
      onMouseEnter={() => setIsHoverRevealed(true)}
    >
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 space-y-4">
        {/* Contact Header */}
        <div className="flex items-start gap-3">
          {contact.imageUrl ? (
            <img
              src={contact.imageUrl}
              alt={displayName}
              className="w-12 h-12 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editedSetName}
                  onChange={(e) => setEditedSetName(e.target.value)}
                  placeholder={originalName}
                  className="h-8 text-sm font-semibold"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveSetName()
                    if (e.key === 'Escape') handleCancelEditName()
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={handleSaveSetName}
                  disabled={isSaving}
                >
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={handleCancelEditName}
                >
                  <X className="h-4 w-4 text-gray-500" />
                </Button>
              </div>
            ) : (
              <div 
                className="group cursor-pointer"
                onClick={() => {
                  setEditedSetName(contact.setName || "")
                  setIsEditingName(true)
                }}
              >
                <div className="flex items-center gap-1">
                  <h3 className="font-semibold text-gray-900 truncate">{displayName}</h3>
                  <Pencil className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {showOriginalInParens && (
                  <p className="text-xs text-gray-400">({originalName})</p>
                )}
              </div>
            )}
            {contact.instagram && (
              <p className="text-sm text-gray-500">@{contact.instagram}</p>
            )}
          </div>
          
          {/* Priority Slider */}
          <div className="flex flex-col items-center flex-shrink-0 w-8">
            <Slider
              value={[priority]}
              onValueChange={handlePriorityChange}
              onValueCommit={handlePriorityCommit}
              min={1}
              max={100}
              step={1}
              orientation="vertical"
              className="h-10 min-h-10"
            />
          </div>
          
          {/* Kebab Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowMergeDialog(true)}>
                <Merge className="h-4 w-4 mr-2" />
                Merge with another contact
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Duplicate Warning */}
        {duplicates && duplicates.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-orange-800">
                  {duplicates.length} potential duplicate{duplicates.length > 1 ? 's' : ''} found
                </p>
                <p className="text-xs text-orange-600 mt-1">
                  This contact may be the same as {duplicates.length} other{duplicates.length > 1 ? 's' : ''} in your database
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMergeDialog(true)}
              className="w-full mt-2 text-xs border-orange-300 hover:bg-orange-100"
            >
              Review & Merge Duplicates
            </Button>
          </div>
        )}

        {/* Tags - Autocomplete dropdown - NO LABEL */}
        <div>
          <Popover open={isTagPopoverOpen} onOpenChange={setIsTagPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start h-auto min-h-[40px] p-2"
                disabled={isSaving}
              >
                <div className="flex flex-wrap gap-1">
                  {selectedTags.length > 0 ? (
                    selectedTags.map((tagId) => {
                      const tag = tags?.find(t => t._id === tagId)
                      return tag ? (
                        <Badge key={tagId} variant="secondary" className="gap-1">
                          {tag.name}
                          <X
                            className="w-3 h-3 cursor-pointer hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveTag(tagId)
                            }}
                          />
                        </Badge>
                      ) : null
                    })
                  ) : (
                    <span className="text-muted-foreground text-sm">Select tags...</span>
                  )}
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0 bg-white" align="start">
              <Command>
                <CommandInput 
                  placeholder="Search or create tag..." 
                  value={tagSearch}
                  onValueChange={setTagSearch}
                />
                <CommandList>
                  <CommandEmpty>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-sm"
                      onClick={() => {
                        handleCreateAndSelectTag(tagSearch)
                        setIsTagPopoverOpen(false)
                      }}
                      disabled={!tagSearch.trim()}
                    >
                      Create "{tagSearch}"
                    </Button>
                  </CommandEmpty>
                  <CommandGroup>
                    {tags?.map((tag) => {
                      const isSelected = selectedTags.includes(tag._id)
                      return (
                        <CommandItem
                          key={tag._id}
                          onSelect={() => {
                            handleToggleTag(tag._id)
                          }}
                          className="cursor-pointer"
                        >
                          <span className="flex-1">{tag.name}</span>
                          {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Location Tags - Autocomplete dropdown - NO LABEL */}
        <div>
          <Popover open={isLocationPopoverOpen} onOpenChange={setIsLocationPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start h-auto min-h-[40px] p-2"
                disabled={isSaving}
              >
                <div className="flex flex-wrap gap-1">
                  {selectedLocations.length > 0 ? (
                    selectedLocations.map((locId) => {
                      const location = locations?.find(l => l._id === locId)
                      return location ? (
                        <Badge key={locId} variant="secondary" className="gap-1">
                          {location.name}
                          <X
                            className="w-3 h-3 cursor-pointer hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveLocation(locId)
                            }}
                          />
                        </Badge>
                      ) : null
                    })
                  ) : (
                    <span className="text-muted-foreground text-sm">Select locations...</span>
                  )}
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0 bg-white" align="start">
              <Command>
                <CommandInput 
                  placeholder="Search or create location..." 
                  value={locationSearch}
                  onValueChange={setLocationSearch}
                />
                <CommandList>
                  <CommandEmpty>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-sm"
                      onClick={() => {
                        handleCreateAndSelectLocation(locationSearch)
                        setIsLocationPopoverOpen(false)
                      }}
                      disabled={!locationSearch.trim()}
                    >
                      Create "{locationSearch}"
                    </Button>
                  </CommandEmpty>
                  <CommandGroup>
                    {locations?.map((location) => {
                      const isSelected = selectedLocations.includes(location._id)
                      return (
                        <CommandItem
                          key={location._id}
                          onSelect={() => {
                            handleToggleLocation(location._id)
                          }}
                          className="cursor-pointer"
                        >
                          <span className="flex-1">{location.name}</span>
                          {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Local Notes Field - Always visible, no title */}
        <div>
          <Textarea
            id="contact-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this contact..."
            className="min-h-[120px] text-sm"
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

        {/* Hidden sections - visible on hover and persists for 2 minutes */}
        <div className={`transition-opacity duration-200 space-y-4 ${isHoverRevealed ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          {/* Connection Direction - Multi-select with grayscale emojis, no label */}
          <div className="flex flex-wrap gap-2">
            {connectionOptions.map((option) => {
              const isSelected = selectedConnections.includes(option.value)
              return (
                <button
                  key={option.value}
                  onClick={() => handleConnectionToggle(option.value)}
                  disabled={isSaving}
                  title={option.label}
                  className={`px-3 py-2 text-lg rounded-lg transition-all border-2 ${
                    isSelected
                      ? 'bg-blue-100 border-blue-500 scale-110'
                      : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  style={{ filter: 'grayscale(100%)' }}
                >
                  {option.emoji}
                </button>
              )
            })}
          </div>

          {/* Objective Field */}
          <div>
            <Label htmlFor="objective" className="text-xs text-gray-600 mb-1 block">
              Objective
            </Label>
            <Textarea
              id="objective"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder=""
              className="min-h-[60px] text-sm"
              disabled={isSaving}
            />
            {objective !== (contact.objective || "") && (
              <Button
                onClick={handleSaveObjective}
                disabled={isSaving}
                size="sm"
                className="mt-2 w-full"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Objective'}
              </Button>
            )}
          </div>

          {/* Sex - Multi-select, no label */}
          <div className="flex flex-wrap gap-2">
            {sexOptions.map((option) => {
              const isSelected = selectedSex.includes(option.value)
              return (
                <button
                  key={option.value}
                  onClick={() => handleSexToggle(option.value)}
                  disabled={isSaving}
                  title={option.label}
                  className={`px-3 py-2 text-lg rounded-lg transition-all border-2 ${
                    isSelected
                      ? 'bg-blue-100 border-blue-500 scale-110'
                      : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  style={{ filter: 'grayscale(100%)' }}
                >
                  {option.emoji}
                </button>
              )
            })}
          </div>

          {/* Lead Status - Button style (in hover section) */}
          <div>
            <Label className="text-xs text-gray-600 mb-2 block">Lead Status</Label>
            <div className="flex flex-wrap gap-2">
              {leadStatusOptions.map((option) => {
                const isSelected = leadStatus === option.value
                return (
                  <button
                    key={option.value}
                    onClick={() => handleLeadStatusToggle(option.value)}
                    disabled={isSaving}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-all border-2 ${
                      isSelected
                        ? 'bg-blue-100 border-blue-500'
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Description from Dex */}
          {contact.description && (
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Description (from Dex)</Label>
              <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-200">
                {contact.description}
              </p>
            </div>
          )}

          {/* PIN-Protected Section - Shows PIN input only on hover over "More" */}
          <div className="border-t-2 border-gray-200 pt-4">
            {!isPinUnlocked ? (
              <div className="space-y-3">
                <div 
                  className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer"
                  onMouseEnter={() => setIsPinHovered(true)}
                  onMouseLeave={() => setIsPinHovered(false)}
                >
                  <Lock className="w-4 h-4" />
                  <Label className="text-xs text-gray-600 cursor-pointer">More</Label>
                </div>
                {isPinHovered && (
                  <div className="flex flex-col items-center gap-3">
                    <InputOTP
                      maxLength={4}
                      value={pin}
                      onChange={(value) => {
                        setPin(value)
                        setPinError(false)
                        if (value.length === 4) {
                          handlePinComplete(value)
                        }
                      }}
                      autoFocus
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                      </InputOTPGroup>
                    </InputOTP>
                    {pinError && (
                      <p className="text-xs text-red-600">Incorrect PIN. Try again.</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                  <Unlock className="w-4 h-4" />
                  <span>Private fields unlocked</span>
                </div>

                {/* Private Notes */}
                <div>
                  <Label htmlFor="private-notes" className="text-xs text-gray-600 mb-1 block">
                    Private Notes
                  </Label>
                  <Textarea
                    id="private-notes"
                    value={privateNotes}
                    onChange={(e) => setPrivateNotes(e.target.value)}
                    placeholder="Add private notes..."
                    className="min-h-[80px] text-sm"
                    disabled={isSaving}
                  />
                  {privateNotes !== (contact.privateNotes || "") && (
                    <Button
                      onClick={handleSavePrivateNotes}
                      disabled={isSaving}
                      size="sm"
                      className="mt-2 w-full"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {isSaving ? 'Saving...' : 'Save Private Notes'}
                    </Button>
                  )}
                </div>

                {/* Intimate Connection Toggle */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="intimate-connection" className="text-xs text-gray-600">
                      Intimate Connection
                    </Label>
                    <Switch
                      id="intimate-connection"
                      checked={intimateConnection}
                      onCheckedChange={handleToggleIntimateConnection}
                      disabled={isSaving}
                    />
                  </div>
                  
                  {/* Date Picker - Shows when switch is ON */}
                  {intimateConnection && (
                    <div>
                      <Label htmlFor="intimate-connection-date" className="text-xs text-gray-600 mb-1 block">
                        Date
                      </Label>
                      <Input
                        id="intimate-connection-date"
                        type="date"
                        value={intimateConnectionDate}
                        onChange={(e) => handleIntimateConnectionDateChange(e.target.value)}
                        disabled={isSaving}
                        className="text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Merge Duplicates Dialog */}
      {duplicates && duplicates.length > 0 && (
        <MergeDuplicatesDialog
          open={showMergeDialog}
          onOpenChange={setShowMergeDialog}
          currentContact={contact}
          duplicates={duplicates}
          onMerge={async (primaryId, duplicateId) => {
            await mergeContactsMutation({ primaryId, duplicateId })
          }}
        />
      )}
    </div>
  )
}
