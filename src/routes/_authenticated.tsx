import { createFileRoute, Outlet } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

/**
 * Layout route for authenticated pages
 * 
 * This wraps all child routes with DashboardLayout, ensuring the header/navigation
 * persists across route changes without remounting.
 * 
 * Child routes should be named: _authenticated/routeName.tsx
 */
export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  )
}
