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
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"
import { 
  Settings, 
  User, 
  MessageSquare,
  LayoutDashboard,
  Users,
  HeartHandshake,
  LogOut,
  MessageCircle,
  MapPin,
  Menu,
  Bot,
  BarChart3
} from "lucide-react"
import { Link, useNavigate } from '@tanstack/react-router'
import { useAuthActions } from '@convex-dev/auth/react'
import { cn } from "~/lib/utils"
import * as React from 'react'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { signOut } = useAuthActions()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate({ to: '/sign-in' })
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-700/50 flex-shrink-0">
        <div className="px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Mobile menu button */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm"
                className="lg:hidden text-slate-300 hover:text-white hover:bg-slate-800/80 h-9 w-9 p-0"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-slate-900 border-slate-700 text-slate-300 w-64">
              <nav className="flex flex-col gap-4 mt-8">
                <Link 
                  to="/" 
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md",
                    "text-base font-medium transition-all",
                    "text-slate-300 hover:text-white hover:bg-slate-800/80",
                    "[&.active]:bg-slate-800 [&.active]:text-white"
                  )}
                  activeProps={{ className: "active" }}
                >
                  <LayoutDashboard className="h-5 w-5" />
                  Home
                </Link>
                <Link 
                  to="/messages"
                  search={{ chatId: undefined }}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md",
                    "text-base font-medium transition-all",
                    "text-slate-300 hover:text-white hover:bg-slate-800/80",
                    "[&.active]:bg-slate-800 [&.active]:text-white"
                  )}
                  activeProps={{ className: "active" }}
                >
                  <MessageSquare className="h-5 w-5" />
                  Messages
                </Link>
                <Link 
                  to="/contacts"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md",
                    "text-base font-medium transition-all",
                    "text-slate-300 hover:text-white hover:bg-slate-800/80",
                    "[&.active]:bg-slate-800 [&.active]:text-white"
                  )}
                  activeProps={{ className: "active" }}
                >
                  <Users className="h-5 w-5" />
                  Contacts
                </Link>
                <Link 
                  to="/sales"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md",
                    "text-base font-medium transition-all",
                    "text-slate-300 hover:text-white hover:bg-slate-800/80",
                    "[&.active]:bg-slate-800 [&.active]:text-white"
                  )}
                  activeProps={{ className: "active" }}
                >
                  <HeartHandshake className="h-5 w-5" />
                  Sales
                </Link>
                <Link 
                  to="/stats"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md",
                    "text-base font-medium transition-all",
                    "text-slate-300 hover:text-white hover:bg-slate-800/80",
                    "[&.active]:bg-slate-800 [&.active]:text-white"
                  )}
                  activeProps={{ className: "active" }}
                >
                  <BarChart3 className="h-5 w-5" />
                  Stats
                </Link>
                <div className="border-t border-slate-700 pt-4 mt-2">
                  <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Settings
                  </div>
                  <Link 
                    to="/settings/prompts"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-md text-base text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all"
                  >
                    <MessageCircle className="h-5 w-5" />
                    Prompts
                  </Link>
                  <Link 
                    to="/settings/locations"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-md text-base text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all"
                  >
                    <MapPin className="h-5 w-5" />
                    Locations
                  </Link>
                  <Link 
                    to="/settings/ai"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-md text-base text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all"
                  >
                    <Bot className="h-5 w-5" />
                    AI Models
                  </Link>
                  <Link 
                    to="/settings"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-md text-base text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all"
                  >
                    <Settings className="h-5 w-5" />
                    Settings
                  </Link>
                </div>
                <div className="border-t border-slate-700 pt-4 mt-2">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false)
                      handleSignOut()
                    }}
                    className="flex items-center gap-3 px-4 py-3 rounded-md text-base text-red-400 hover:text-red-300 hover:bg-slate-800/80 transition-all w-full text-left"
                  >
                    <LogOut className="h-5 w-5" />
                    Sign out
                  </button>
                </div>
              </nav>
            </SheetContent>
          </Sheet>

          {/* Desktop nav - hidden on mobile */}
          <div className="hidden lg:flex items-center gap-1">
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
                  <Link 
                    to="/sales"
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
                    <HeartHandshake className="h-4 w-4" />
                    Sales
                  </Link>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <Link 
                    to="/stats"
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
                    <BarChart3 className="h-4 w-4" />
                    Stats
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
                            to="/settings/ai"
                            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm !text-slate-300 hover:!text-white hover:!bg-slate-700 transition-colors w-full"
                          >
                            <Bot className="h-4 w-4" />
                            AI Models
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

          {/* Center - App title (mobile only) */}
          <div className="lg:hidden flex-1 text-center">
            <h1 className="text-lg font-semibold text-white">Dashboard</h1>
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
            <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
              <DropdownMenuLabel className="text-slate-300">My Account</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-700" />
              <DropdownMenuItem asChild className="lg:flex hidden">
                <Link to="/settings" className="flex items-center cursor-pointer text-slate-300 hover:text-white focus:text-white focus:bg-slate-700">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-700 lg:flex hidden" />
              <DropdownMenuItem 
                onClick={handleSignOut}
                className="cursor-pointer text-red-400 hover:text-red-300 focus:text-red-300 focus:bg-slate-700"
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
