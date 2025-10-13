import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"
import { 
  Settings, 
  User, 
  MessageSquare,
  LayoutDashboard,
  Users,
  LogOut
} from "lucide-react"
import { Link, useNavigate } from '@tanstack/react-router'
import { useAuthActions } from '@convex-dev/auth/react'
import { cn } from "~/lib/utils"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { signOut } = useAuthActions()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate({ to: '/sign-in' })
  }
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-700/50 flex-shrink-0">
        <div className="px-6 h-16 flex items-center justify-between">
          {/* Left side - Nav */}
          <div className="flex items-center gap-1">
            <NavigationMenu>
              <NavigationMenuList className="gap-1">
                <NavigationMenuItem>
                  <NavigationMenuLink asChild>
                    <Link 
                      to="/" 
                      className={cn(
                        "inline-flex items-center gap-2 px-4 py-2 rounded-md",
                        "text-sm font-medium transition-all",
                        "text-slate-300 hover:text-white hover:bg-slate-800/80",
                        "[&.active]:bg-slate-800 [&.active]:text-white"
                      )}
                      activeProps={{
                        className: "active"
                      }}
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      Home
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuLink asChild>
                    <Link 
                      to="/messages"
                      search={{ chatId: undefined }}
                      className={cn(
                        "inline-flex items-center gap-2 px-4 py-2 rounded-md",
                        "text-sm font-medium transition-all",
                        "text-slate-300 hover:text-white hover:bg-slate-800/80",
                        "[&.active]:bg-slate-800 [&.active]:text-white"
                      )}
                      activeProps={{
                        className: "active"
                      }}
                    >
                      <MessageSquare className="h-4 w-4" />
                      Messages
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuLink asChild>
                    <Link 
                      to="/contacts" 
                      className={cn(
                        "inline-flex items-center gap-2 px-4 py-2 rounded-md",
                        "text-sm font-medium transition-all",
                        "text-slate-300 hover:text-white hover:bg-slate-800/80",
                        "[&.active]:bg-slate-800 [&.active]:text-white"
                      )}
                      activeProps={{
                        className: "active"
                      }}
                    >
                      <Users className="h-4 w-4" />
                      Contacts
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuLink asChild>
                    <Link 
                      to="/settings" 
                      className={cn(
                        "inline-flex items-center gap-2 px-4 py-2 rounded-md",
                        "text-sm font-medium transition-all",
                        "text-slate-300 hover:text-white hover:bg-slate-800/80",
                        "[&.active]:bg-slate-800 [&.active]:text-white"
                      )}
                      activeProps={{
                        className: "active"
                      }}
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          {/* Right side - User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-slate-300 hover:text-white hover:bg-slate-800/80 h-9 w-9 p-0"
              >
                <User className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex items-center cursor-pointer">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleSignOut}
                className="cursor-pointer text-red-600 focus:text-red-600"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}