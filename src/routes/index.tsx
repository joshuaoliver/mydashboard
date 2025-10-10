import { createFileRoute } from '@tanstack/react-router'
import { api } from '../../convex/_generated/api'
import { useMutation } from 'convex/react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const {
    data: { viewer, numbers },
  } = useSuspenseQuery(convexQuery(api.myFunctions.listNumbers, { count: 10 }))

  const addNumber = useMutation(api.myFunctions.addNumber)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Section */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome to Your Dashboard
          </h1>
          <p className="text-gray-600 mt-2">
            Manage your personal tools and data sources in one place.
          </p>
        </div>

        {/* Demo Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Real-time Demo</CardTitle>
              <CardDescription>
                Test the Convex integration with live data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Welcome {viewer ?? 'Anonymous'}!
              </p>
              <p className="text-sm">
                Numbers: {numbers?.length === 0 ? 'None yet' : numbers?.join(', ')}
              </p>
              <Button 
                onClick={() => {
                  void addNumber({ value: Math.floor(Math.random() * 10) })
                }}
                size="sm"
              >
                Add Random Number
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
              <CardDescription>
                Next steps to customize your dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">1. Add authentication</p>
                <p className="text-xs text-gray-600">Set up login/signup flows</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">2. Connect data sources</p>
                <p className="text-xs text-gray-600">APIs, files, and services</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">3. Create tools</p>
                <p className="text-xs text-gray-600">Build custom widgets and views</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resources</CardTitle>
              <CardDescription>
                Helpful links and documentation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <a 
                href="https://docs.convex.dev/home" 
                className="block text-sm text-blue-600 hover:text-blue-800"
              >
                → Convex Documentation
              </a>
              <a 
                href="https://tanstack.com/start" 
                className="block text-sm text-blue-600 hover:text-blue-800"
              >
                → TanStack Start Docs
              </a>
              <a 
                href="https://ui.shadcn.com" 
                className="block text-sm text-blue-600 hover:text-blue-800"
              >
                → Shadcn/ui Components
              </a>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks and tools for your dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button variant="outline" className="h-24 flex-col">
                <span className="text-2xl mb-2">📊</span>
                <span className="text-sm">Analytics</span>
              </Button>
              <Button variant="outline" className="h-24 flex-col">
                <span className="text-2xl mb-2">📅</span>
                <span className="text-sm">Calendar</span>
              </Button>
              <Button variant="outline" className="h-24 flex-col">
                <span className="text-2xl mb-2">📁</span>
                <span className="text-sm">Files</span>
              </Button>
              <Button variant="outline" className="h-24 flex-col">
                <span className="text-2xl mb-2">⚙️</span>
                <span className="text-sm">Settings</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}


