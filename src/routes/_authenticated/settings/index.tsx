import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useMutation, useAction } from 'convex/react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../../../convex/_generated/api'
import { useState } from 'react'
import { Trash2, Database, AlertCircle, CheckCircle, Settings as SettingsIcon, Users, RefreshCw, Bot, MessageSquare, MapPin, RotateCcw } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/settings/')({
  component: SettingsPage,
})

function SettingsPage() {
  const [isClearing, setIsClearing] = useState(false)
  const [clearResult, setClearResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isResyncing, setIsResyncing] = useState(false)
  const [resyncResult, setResyncResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [messageLimit, setMessageLimit] = useState(50)

  const clearMessages = useMutation(api.cleanupMessages.clearAllMessages)
  const clearChats = useMutation(api.cleanupMessages.clearAllChats)
  const triggerDexSync = useMutation(api.dexAdmin.triggerManualSync)
  const fullResync = useAction(api.beeperSync.fullResync)
  const { data: dexStats } = useQuery(convexQuery(api.dexQueries.getSyncStats, {}))

  const handleClearMessages = async () => {
    if (!confirm('Delete all cached messages?')) return
    setIsClearing(true); setClearResult(null)
    try { const r = await clearMessages(); setClearResult({ type: 'success', message: `Deleted ${r.deleted} messages.` }) }
    catch (e) { setClearResult({ type: 'error', message: `Failed: ${e instanceof Error ? e.message : 'Unknown'}` }) }
    finally { setIsClearing(false) }
  }

  const handleClearChats = async () => {
    if (!confirm('Delete all cached chats AND messages?')) return
    setIsClearing(true); setClearResult(null)
    try { const r = await clearChats(); setClearResult({ type: 'success', message: `Deleted ${r.deleted} chats.` }) }
    catch (e) { setClearResult({ type: 'error', message: `Failed: ${e instanceof Error ? e.message : 'Unknown'}` }) }
    finally { setIsClearing(false) }
  }

  const handleDexSync = async () => {
    setIsSyncing(true); setSyncResult(null)
    try { await triggerDexSync(); setSyncResult({ type: 'success', message: 'Dex sync started!' }) }
    catch (e) { setSyncResult({ type: 'error', message: `Failed: ${e instanceof Error ? e.message : 'Unknown'}` }) }
    finally { setIsSyncing(false) }
  }

  const handleFullResync = async () => {
    setIsResyncing(true); setResyncResult(null)
    try {
      const result = await fullResync({ messageLimit, clearFirst: false })
      if (result.success) {
        setResyncResult({ 
          type: 'success', 
          message: `Re-synced ${result.syncedChats} chats with ${result.syncedMessages} messages.` 
        })
      } else {
        setResyncResult({ type: 'error', message: result.error || 'Resync failed' })
      }
    } catch (e) { 
      setResyncResult({ type: 'error', message: `Failed: ${e instanceof Error ? e.message : 'Unknown'}` }) 
    }
    finally { setIsResyncing(false) }
  }

  const formatTimestamp = (ts: number | null) => {
    if (!ts) return 'Never'
    const m = Math.floor((Date.now() - ts) / 60000)
    if (m < 1) return 'Just now'
    if (m < 60) return `${m} min ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h} hours ago`
    return `${Math.floor(h / 24)} days ago`
  }

  return (
    <div className="p-6">
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your dashboard configuration and integrations</p>
        </div>

        {/* Dex Contacts Sync */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-500" />
              <CardTitle>Dex Contacts Sync</CardTitle>
            </div>
            <CardDescription>Automatic sync with Dex CRM</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {syncResult && (
              <div className={`rounded-lg p-4 flex items-start gap-3 border ${
                syncResult.type === 'success' 
                  ? 'bg-green-500/10 border-green-500/20' 
                  : 'bg-destructive/10 border-destructive/20'
              }`}>
                {syncResult.type === 'success' 
                  ? <CheckCircle className="w-5 h-5 text-green-500" /> 
                  : <AlertCircle className="w-5 h-5 text-destructive" />
                }
                <p className={`text-sm ${syncResult.type === 'success' ? 'text-green-500' : 'text-destructive'}`}>
                  {syncResult.message}
                </p>
              </div>
            )}
            <div className="bg-muted rounded-lg p-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Contacts</p>
                <p className="text-2xl font-bold">{dexStats?.totalContacts ?? '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Last Synced</p>
                <p className="text-lg font-semibold">{formatTimestamp(dexStats?.lastSyncTime ?? null)}</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Button 
                onClick={handleDexSync} 
                disabled={isSyncing} 
                variant="outline" 
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
              <div>
                <p className="text-sm font-medium">Manual Sync</p>
                <p className="text-xs text-muted-foreground">Trigger immediate sync from Dex</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Beeper Cache */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-500" />
              <CardTitle>Beeper Cache</CardTitle>
            </div>
            <CardDescription>Manage cached messages and chats</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {clearResult && (
              <div className={`rounded-lg p-4 flex items-start gap-3 border ${
                clearResult.type === 'success' 
                  ? 'bg-green-500/10 border-green-500/20' 
                  : 'bg-destructive/10 border-destructive/20'
              }`}>
                {clearResult.type === 'success' 
                  ? <CheckCircle className="w-5 h-5 text-green-500" /> 
                  : <AlertCircle className="w-5 h-5 text-destructive" />
                }
                <p className={`text-sm ${clearResult.type === 'success' ? 'text-green-500' : 'text-destructive'}`}>
                  {clearResult.message}
                </p>
              </div>
            )}
            <div className="flex items-start gap-4">
              <Button 
                onClick={handleClearMessages} 
                disabled={isClearing} 
                variant="outline" 
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Messages
              </Button>
              <div>
                <p className="text-sm font-medium">Clear Messages Only</p>
                <p className="text-xs text-muted-foreground">Chats remain intact</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Button 
                onClick={handleClearChats} 
                disabled={isClearing} 
                variant="outline" 
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </Button>
              <div>
                <p className="text-sm font-medium">Full Cache Reset</p>
                <p className="text-xs text-muted-foreground">Delete everything and resync</p>
              </div>
            </div>
            
            <div className="border-t pt-4 mt-2">
              <h4 className="text-sm font-medium mb-3">Message Re-sync</h4>
              {resyncResult && (
                <div className={`rounded-lg p-4 flex items-start gap-3 border mb-4 ${
                  resyncResult.type === 'success' 
                    ? 'bg-green-500/10 border-green-500/20' 
                    : 'bg-destructive/10 border-destructive/20'
                }`}>
                  {resyncResult.type === 'success' 
                    ? <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" /> 
                    : <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                  }
                  <p className={`text-sm ${resyncResult.type === 'success' ? 'text-green-500' : 'text-destructive'}`}>
                    {resyncResult.message}
                  </p>
                </div>
              )}
              <div className="flex items-end gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Messages per chat</Label>
                  <Input
                    type="number"
                    min={10}
                    max={500}
                    value={messageLimit}
                    onChange={(e) => setMessageLimit(Number(e.target.value))}
                    className="w-24"
                  />
                </div>
                <Button 
                  onClick={handleFullResync} 
                  disabled={isResyncing} 
                  variant="outline" 
                >
                  <RotateCcw className={`w-4 h-4 mr-2 ${isResyncing ? 'animate-spin' : ''}`} />
                  {isResyncing ? 'Re-syncing...' : 'Full Re-sync'}
                </Button>
                <div className="flex-1">
                  <p className="text-sm font-medium">Re-sync Messages</p>
                  <p className="text-xs text-muted-foreground">Fetches fresh data from Beeper (updates existing messages)</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configuration Links */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-purple-500" />
              <CardTitle>Configuration</CardTitle>
            </div>
            <CardDescription>
              Manage AI models, prompts, and other settings
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Link 
              to="/settings/ai"
              className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border hover:border-blue-500/50 hover:bg-accent transition-all group"
            >
              <Bot className="h-5 w-5 text-blue-500 group-hover:text-blue-400" />
              <div>
                <p className="font-medium group-hover:text-accent-foreground">AI Models</p>
                <p className="text-xs text-muted-foreground">Configure which models to use</p>
              </div>
            </Link>
            <Link 
              to="/settings/prompts"
              className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border hover:border-purple-500/50 hover:bg-accent transition-all group"
            >
              <MessageSquare className="h-5 w-5 text-purple-500 group-hover:text-purple-400" />
              <div>
                <p className="font-medium group-hover:text-accent-foreground">AI Prompts</p>
                <p className="text-xs text-muted-foreground">Edit prompt templates</p>
              </div>
            </Link>
            <Link 
              to="/settings/locations"
              className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border hover:border-green-500/50 hover:bg-accent transition-all group"
            >
              <MapPin className="h-5 w-5 text-green-500 group-hover:text-green-400" />
              <div>
                <p className="font-medium group-hover:text-accent-foreground">Locations</p>
                <p className="text-xs text-muted-foreground">Manage location tags</p>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
