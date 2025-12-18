import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/contacts')({
  component: ContactsLayout,
})

function ContactsLayout() {
  return <Outlet />
}
