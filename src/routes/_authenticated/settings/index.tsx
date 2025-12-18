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
    <div className="min-h-full bg-slate-900 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-1">Manage your dashboard configuration and integrations</p>
      </div>
      <div className="space-y-6 max-w-4xl">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              <CardTitle className="text-slate-100">Dex Contacts Sync</CardTitle>
            </div>
            <CardDescription className="text-slate-400">Automatic sync with Dex CRM</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {syncResult && (
              <div className={`rounded-lg p-4 flex items-start gap-3 border ${
                syncResult.type === 'success' 
                  ? 'bg-green-900/20 border-green-700' 
                  : 'bg-red-900/20 border-red-700'
              }`}>
                {syncResult.type === 'success' 
                  ? <CheckCircle className="w-5 h-5 text-green-400" /> 
                  : <AlertCircle className="w-5 h-5 text-red-400" />
                }
                <p className={`text-sm ${syncResult.type === 'success' ? 'text-green-300' : 'text-red-300'}`}>
                  {syncResult.message}
                </p>
              </div>
            )}
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-slate-400">Total Contacts</p>
                <p className="text-2xl font-bold text-slate-100">{dexStats?.totalContacts ?? '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-400">Last Synced</p>
                <p className="text-lg font-semibold text-slate-100">{formatTimestamp(dexStats?.lastSyncTime ?? null)}</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Button 
                onClick={handleDexSync} 
                disabled={isSyncing} 
                variant="outline" 
                className="gap-2 bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-slate-100"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
              <div>
                <p className="text-sm font-medium text-slate-300">Manual Sync</p>
                <p className="text-xs text-slate-500">Trigger immediate sync from Dex</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-400" />
              <CardTitle className="text-slate-100">Beeper Cache</CardTitle>
            </div>
            <CardDescription className="text-slate-400">Manage cached messages and chats</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {clearResult && (
              <div className={`rounded-lg p-4 flex items-start gap-3 border ${
                clearResult.type === 'success' 
                  ? 'bg-green-900/20 border-green-700' 
                  : 'bg-red-900/20 border-red-700'
              }`}>
                {clearResult.type === 'success' 
                  ? <CheckCircle className="w-5 h-5 text-green-400" /> 
                  : <AlertCircle className="w-5 h-5 text-red-400" />
                }
                <p className={`text-sm ${clearResult.type === 'success' ? 'text-green-300' : 'text-red-300'}`}>
                  {clearResult.message}
                </p>
              </div>
            )}
            <div className="flex items-start gap-4">
              <Button 
                onClick={handleClearMessages} 
                disabled={isClearing} 
                variant="outline" 
                className="gap-2 bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-slate-100"
              >
                <Trash2 className="w-4 h-4" />
                Clear Messages
              </Button>
              <div>
                <p className="text-sm font-medium text-slate-300">Clear Messages Only</p>
                <p className="text-xs text-slate-500">Chats remain intact</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Button 
                onClick={handleClearChats} 
                disabled={isClearing} 
                variant="outline" 
                className="gap-2 bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-slate-100"
              >
                <Trash2 className="w-4 h-4" />
                Clear All
              </Button>
              <div>
                <p className="text-sm font-medium text-slate-300">Full Cache Reset</p>
                <p className="text-xs text-slate-500">Delete everything and resync</p>
              </div>
            </div>
            
            <div className="border-t border-slate-700 pt-4 mt-2">
              <h4 className="text-sm font-medium text-slate-200 mb-3">Message Re-sync</h4>
              {resyncResult && (
                <div className={`rounded-lg p-4 flex items-start gap-3 border mb-4 ${
                  resyncResult.type === 'success' 
                    ? 'bg-green-900/20 border-green-700' 
                    : 'bg-red-900/20 border-red-700'
                }`}>
                  {resyncResult.type === 'success' 
                    ? <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" /> 
                    : <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  }
                  <p className={`text-sm ${resyncResult.type === 'success' ? 'text-green-300' : 'text-red-300'}`}>
                    {resyncResult.message}
                  </p>
                </div>
              )}
              <div className="flex items-end gap-4">
                <div className="space-y-2">
                  <Label htmlFor="messageLimit" className="text-slate-400 text-xs">Messages per chat</Label>
                  <Input
                    id="messageLimit"
                    type="number"
                    min={10}
                    max={500}
                    value={messageLimit}
                    onChange={(e) => setMessageLimit(Number(e.target.value))}
                    className="w-24 bg-slate-900 border-slate-600 text-slate-200"
                  />
                </div>
                <Button 
                  onClick={handleFullResync} 
                  disabled={isResyncing} 
                  variant="outline" 
                  className="gap-2 bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-slate-100"
                >
                  <RotateCcw className={`w-4 h-4 ${isResyncing ? 'animate-spin' : ''}`} />
                  {isResyncing ? 'Re-syncing...' : 'Full Re-sync'}
                </Button>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-300">Re-sync Messages</p>
                  <p className="text-xs text-slate-500">Fetches fresh data from Beeper (updates existing messages)</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <div className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-purple-400" />
              <CardTitle className="text-slate-100">Configuration</CardTitle>
            </div>
            <CardDescription className="text-slate-400">
              Manage AI models, prompts, and other settings
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Link 
              to="/settings/ai"
              className="flex items-center gap-3 p-4 rounded-lg bg-slate-900/50 border border-slate-700 hover:border-blue-500/50 hover:bg-slate-800/50 transition-all group"
            >
              <Bot className="h-5 w-5 text-blue-400 group-hover:text-blue-300" />
              <div>
                <p className="font-medium text-slate-200 group-hover:text-slate-100">AI Models</p>
                <p className="text-xs text-slate-500">Configure which models to use</p>
              </div>
            </Link>
            <Link 
              to="/settings/prompts"
              className="flex items-center gap-3 p-4 rounded-lg bg-slate-900/50 border border-slate-700 hover:border-purple-500/50 hover:bg-slate-800/50 transition-all group"
            >
              <MessageSquare className="h-5 w-5 text-purple-400 group-hover:text-purple-300" />
              <div>
                <p className="font-medium text-slate-200 group-hover:text-slate-100">AI Prompts</p>
                <p className="text-xs text-slate-500">Edit prompt templates</p>
              </div>
            </Link>
            <Link 
              to="/settings/locations"
              className="flex items-center gap-3 p-4 rounded-lg bg-slate-900/50 border border-slate-700 hover:border-green-500/50 hover:bg-slate-800/50 transition-all group"
            >
              <MapPin className="h-5 w-5 text-green-400 group-hover:text-green-300" />
              <div>
                <p className="font-medium text-slate-200 group-hover:text-slate-100">Locations</p>
                <p className="text-xs text-slate-500">Manage location tags</p>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
