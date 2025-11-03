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
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu"
import { 
  Settings, 
  User, 
  MessageSquare,
  LayoutDashboard,
  Users,
  LogOut,
  MessageCircle,
  MapPin
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
            <NavigationMenu viewport={false}>
              <NavigationMenuList className="gap-1">
                <NavigationMenuItem>
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
                </NavigationMenuItem>
                <NavigationMenuItem>
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
                </NavigationMenuItem>
                <NavigationMenuItem>
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
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className={cn(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-md",
                    "text-sm font-medium transition-all",
                    "text-slate-300 hover:text-white hover:bg-slate-800/80 data-[state=open]:bg-slate-800 data-[state=open]:text-white",
                    "bg-transparent"
                  )}>
                    <Settings className="h-4 w-4" />
                    Settings
                  </NavigationMenuTrigger>
                  <NavigationMenuContent className="!bg-slate-800 !border-slate-700 !text-slate-300 z-[100] !mt-0">
                    <ul className="grid w-[200px] gap-1 p-2">
                      <li>
                        <NavigationMenuLink asChild>
                          <Link 
                            to="/settings/prompts"
                            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm !text-slate-300 hover:!text-white hover:!bg-slate-700 transition-colors w-full"
                          >
                            <MessageCircle className="h-4 w-4" />
                            Prompts
                          </Link>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink asChild>
                          <Link 
                            to="/settings/locations"
                            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm !text-slate-300 hover:!text-white hover:!bg-slate-700 transition-colors w-full"
                          >
                            <MapPin className="h-4 w-4" />
                            Locations
                          </Link>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink asChild>
                          <Link 
                            to="/settings"
                            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm !text-slate-300 hover:!text-white hover:!bg-slate-700 transition-colors w-full"
                          >
                            <Settings className="h-4 w-4" />
                            Settings
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    </ul>
                  </NavigationMenuContent>
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
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}