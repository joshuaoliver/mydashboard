import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Trash2, MapPin } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/settings/locations')({
  component: LocationsPage,
})

function LocationsPage() {
  const { data: locations } = useSuspenseQuery(
    convexQuery(api.locationQueries.listLocations, {})
  )

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [locationName, setLocationName] = useState('')

  const createLocation = useConvexMutation(api.locationMutations.createLocation)
  const deleteLocation = useConvexMutation(api.locationMutations.deleteLocation)

  const handleCreateLocation = () => {
    if (!locationName.trim()) {
      alert('Please enter a location name')
      return
    }

    createLocation({
      name: locationName.trim(),
    }).then(() => {
      setLocationName('')
      setIsCreateDialogOpen(false)
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to create location'
      alert(message)
    })
  }

  const handleDeleteLocation = (id: string) => {
    if (confirm('Are you sure you want to delete this location? Any contacts using it will have their location cleared.')) {
      deleteLocation({ id: id as any }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Failed to delete location'
        alert(message)
      })
    }
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Locations</h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage location tags for your contacts
            </p>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Location
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Location</DialogTitle>
                <DialogDescription>
                  Add a new location tag that can be assigned to contacts.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="location-name">Location Name</Label>
                  <Input
                    id="location-name"
                    placeholder="e.g., Sydney, New York, London"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateLocation()
                      }
                    }}
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateLocation}>Create Location</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {locations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MapPin className="w-12 h-12 text-gray-400 mb-4" />
              <p className="text-gray-600 mb-2">No locations yet</p>
              <p className="text-sm text-gray-500 mb-4">
                Create your first location tag to organize contacts by location.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Location
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {locations.map((location) => (
              <Card key={location._id}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    <CardTitle className="text-lg font-semibold">
                      {location.name}
                    </CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteLocation(location._id)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-xs text-gray-500">
                    Created {new Date(location.createdAt).toLocaleDateString()}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

