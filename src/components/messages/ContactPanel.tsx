import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { User, Save, Lock, Unlock, X, Check } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
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
  locationIds?: Id<"locations">[]
  intimateConnection?: boolean
  leadStatus?: "Talking" | "Planning" | "Dated" | "Connected"
}

interface ContactPanelProps {
  contact: Contact | null
  isLoading?: boolean
  searchedUsername?: string
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
] as const

export function ContactPanel({ contact, isLoading, searchedUsername }: ContactPanelProps) {
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
  
  // Extended fields state
  const [privateNotes, setPrivateNotes] = useState(contact?.privateNotes || "")
  const [intimateConnection, setIntimateConnection] = useState(contact?.intimateConnection || false)
  const [leadStatus, setLeadStatus] = useState<string | undefined>(contact?.leadStatus)
  
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
  
  // Query locations
  const locations = useQuery(api.locationQueries.listLocations)

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
    setLeadStatus(contact?.leadStatus)
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

  const handleToggleIntimateConnection = async (checked: boolean) => {
    if (!contact) return
    
    setIntimateConnection(checked)
    setIsSaving(true)
    try {
      await updateIntimateConn({
        contactId: contact._id,
        intimateConnection: checked,
      })
    } catch (error) {
      console.error('Failed to update intimate connection:', error)
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

  const handleRemoveLocation = (locationId: Id<"locations">) => {
    handleToggleLocation(locationId)
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
    if (!searchedUsername) return
    
    setIsSaving(true)
    try {
      await createContactMutation({
        instagram: searchedUsername,
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
          {searchedUsername ? (
            <div className="mt-4 space-y-3">
              <div className="text-xs text-gray-600 bg-gray-100 px-3 py-2 rounded-lg inline-block">
                <p className="font-medium mb-1">Searched for:</p>
                <code className="text-blue-600">@{searchedUsername}</code>
                <p className="mt-1 text-gray-500">Not found in Dex contacts</p>
              </div>
              <Button
                onClick={handleCreateContact}
                disabled={isSaving}
                className="w-full max-w-xs"
              >
                {isSaving ? 'Creating...' : 'Create Contact'}
              </Button>
              <p className="text-xs text-gray-400 mt-2">
                Create now, sync later. When Dex syncs, matching contacts will be linked automatically.
              </p>
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

  const selectedConnections = contact.connections || []
  const selectedSex = contact.sex || []
  const selectedLocations = contact.locationIds || []

  return (
    <div 
      className="h-full flex flex-col border-b border-gray-200 bg-white overflow-y-auto"
      onMouseEnter={() => setIsHoverRevealed(true)}
    >
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 space-y-4">
        {/* Contact Header */}
        <div className="flex items-center gap-3">
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

        {/* Local Notes Field - Always visible at top, no title */}
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

          {/* Lead Status - Button style */}
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

          {/* Location Tags - Autocomplete dropdown */}
          <div>
            <Label className="text-xs text-gray-600 mb-2 block">Locations</Label>
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
