import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/stats')({
  component: StatsLayout,
})

function StatsLayout() {
  return <Outlet />
}
