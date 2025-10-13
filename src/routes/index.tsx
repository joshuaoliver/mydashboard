import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <DashboardLayout>
      <div className="min-h-full bg-gray-50 p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome to Your Dashboard</h1>
        <p className="text-gray-600 mb-6">
          Your personal hub for managing messages, contacts, and AI-powered tools.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Quick Stats or Featured Content Can Go Here */}
        </div>
      </div>
    </DashboardLayout>
  )
}


