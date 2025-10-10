import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <DashboardLayout>
      <div className="h-full bg-gray-50">
        {/* Main intro page - header only */}
      </div>
    </DashboardLayout>
  )
}


