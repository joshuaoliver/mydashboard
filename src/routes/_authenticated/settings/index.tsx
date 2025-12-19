import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useMutation, useAction } from 'convex/react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../../../convex/_generated/api'
import { useState, useEffect, useRef } from 'react'
import { Trash2, Database, AlertCircle, CheckCircle, Settings as SettingsIcon, Users, RefreshCw, Bot, MessageSquare, MapPin, RotateCcw, Compass, Clock, History, Square, Play, FileText } from 'lucide-react'

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
  const [isResettingCursors, setIsResettingCursors] = useState(false)
  const [cursorResetResult, setCursorResetResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isRematching, setIsRematching] = useState(false)
  const [rematchResult, setRematchResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  
  // Historical sync state
  const [messagesPerChat, setMessagesPerChat] = useState(100)
  const [loadOlderChatsFirst, setLoadOlderChatsFirst] = useState(true)
  const [isHistoricalSyncing, setIsHistoricalSyncing] = useState(false)
  const [historicalSyncResult, setHistoricalSyncResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const clearMessages = useMutation(api.cleanupMessages.clearAllMessages)
  const clearChats = useMutation(api.cleanupMessages.clearAllChats)
  const triggerDexSync = useMutation(api.dexAdmin.triggerManualSync)
  const fullResync = useAction(api.beeperSync.fullResync)
  const resetCursors = useMutation(api.cursorHelpers.resetAllCursors)
  const triggerRematch = useAction(api.contactMutations.triggerFullRematch)
  const runHistoricalBatch = useAction(api.beeperPagination.runHistoricalSyncBatch)
  const stopHistoricalSync = useAction(api.beeperPagination.stopHistoricalSync)
  const { data: dexStats } = useQuery(convexQuery(api.dexQueries.getSyncStats, {}))
  const { data: syncDiagnostics } = useQuery(convexQuery(api.cursorHelpers.getSyncDiagnostics, {}))
  const { data: historicalSyncStatus } = useQuery(convexQuery(api.beeperPagination.getHistoricalSyncStatus, {}))

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

  const handleResetCursors = async () => {
    if (!confirm('Reset all sync cursors? This will force a full re-sync on next sync but keeps existing cached data.')) return
    setIsResettingCursors(true); setCursorResetResult(null)
    try {
      const result = await resetCursors()
      if (result.success) {
        setCursorResetResult({ 
          type: 'success', 
          message: `Reset cursors for ${result.chatsReset} chats. Run a sync to refresh data.` 
        })
      } else {
        setCursorResetResult({ type: 'error', message: 'Reset failed' })
      }
    } catch (e) { 
      setCursorResetResult({ type: 'error', message: `Failed: ${e instanceof Error ? e.message : 'Unknown'}` }) 
    }
    finally { setIsResettingCursors(false) }
  }

  const handleRematch = async () => {
    setIsRematching(true); setRematchResult(null)
    try {
      const result = await triggerRematch()
      setRematchResult({ 
        type: 'success', 
        message: `Matched ${result.matchedCount} chats to contacts. ${result.unchangedCount} already matched.` 
      })
    } catch (e) { 
      setRematchResult({ type: 'error', message: `Failed: ${e instanceof Error ? e.message : 'Unknown'}` }) 
    }
    finally { setIsRematching(false) }
  }

  const runOneBatch = async () => {
    try {
      const result = await runHistoricalBatch({
        loadOlderChats: loadOlderChatsFirst,
        messagesPerRequest: messagesPerChat,
      })
      
      if (result.success) {
        setHistoricalSyncResult({ 
          type: 'success', 
          message: `Loaded ${result.messagesLoaded} messages from ${result.chatsProcessed} chats` 
        })
        return { hasMore: result.hasMoreChats || result.hasMoreMessages, stoppedByUser: result.stoppedByUser }
      } else {
        setHistoricalSyncResult({ type: 'error', message: result.error || 'Sync failed' })
        return { hasMore: false, stoppedByUser: false }
      }
    } catch (e) {
      setHistoricalSyncResult({ type: 'error', message: `Failed: ${e instanceof Error ? e.message : 'Unknown'}` })
      return { hasMore: false, stoppedByUser: false }
    }
  }

  const handleStartHistoricalSync = async () => {
    setIsHistoricalSyncing(true)
    setHistoricalSyncResult(null)
    
    // Run first batch immediately
    const firstResult = await runOneBatch()
    
    if (firstResult.hasMore && !firstResult.stoppedByUser) {
      // Set up interval to run more batches
      syncIntervalRef.current = setInterval(async () => {
        const result = await runOneBatch()
        if (!result.hasMore || result.stoppedByUser) {
          if (syncIntervalRef.current) {
            clearInterval(syncIntervalRef.current)
            syncIntervalRef.current = null
          }
          setIsHistoricalSyncing(false)
        }
      }, 5000) // 5 second delay between batches
    } else {
      setIsHistoricalSyncing(false)
    }
  }

  const handleStopHistoricalSync = async () => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current)
      syncIntervalRef.current = null
    }
    await stopHistoricalSync()
    setIsHistoricalSyncing(false)
    setHistoricalSyncResult({ type: 'success', message: 'Sync stopped by user' })
  }

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [])

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
            
            <div className="border-t pt-4 mt-2">
              <h4 className="text-sm font-medium mb-3">Contact Matching</h4>
              {rematchResult && (
                <div className={`rounded-lg p-4 flex items-start gap-3 border mb-4 ${
                  rematchResult.type === 'success' 
                    ? 'bg-green-500/10 border-green-500/20' 
                    : 'bg-destructive/10 border-destructive/20'
                }`}>
                  {rematchResult.type === 'success' 
                    ? <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" /> 
                    : <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                  }
                  <p className={`text-sm ${rematchResult.type === 'success' ? 'text-green-500' : 'text-destructive'}`}>
                    {rematchResult.message}
                  </p>
                </div>
              )}
              <div className="flex items-start gap-4">
                <Button 
                  onClick={handleRematch} 
                  disabled={isRematching} 
                  variant="outline" 
                >
                  <Users className={`w-4 h-4 mr-2 ${isRematching ? 'animate-spin' : ''}`} />
                  {isRematching ? 'Matching...' : 'Rematch Chats'}
                </Button>
                <div>
                  <p className="text-sm font-medium">Link Chats to Contacts</p>
                  <p className="text-xs text-muted-foreground">Match iMessage/WhatsApp chats to Dex contacts by phone number</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Beeper Sync State */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-orange-500" />
              <CardTitle>Beeper Sync State</CardTitle>
            </div>
            <CardDescription>Cursor boundaries and sync diagnostics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cursorResetResult && (
              <div className={`rounded-lg p-4 flex items-start gap-3 border ${
                cursorResetResult.type === 'success' 
                  ? 'bg-green-500/10 border-green-500/20' 
                  : 'bg-destructive/10 border-destructive/20'
              }`}>
                {cursorResetResult.type === 'success' 
                  ? <CheckCircle className="w-5 h-5 text-green-500" /> 
                  : <AlertCircle className="w-5 h-5 text-destructive" />
                }
                <p className={`text-sm ${cursorResetResult.type === 'success' ? 'text-green-500' : 'text-destructive'}`}>
                  {cursorResetResult.message}
                </p>
              </div>
            )}
            
            {/* Sync Stats */}
            {syncDiagnostics && (
              <div className="bg-muted rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Chats</p>
                    <p className="text-2xl font-bold">{syncDiagnostics.stats.totalChats}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Messages</p>
                    <p className="text-2xl font-bold">{syncDiagnostics.stats.totalMessages}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Chats with Cursors</p>
                    <p className="text-2xl font-bold">{syncDiagnostics.stats.chatsWithCursors}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Complete History</p>
                    <p className="text-2xl font-bold">{syncDiagnostics.stats.chatsWithCompleteHistory}</p>
                  </div>
                </div>
                
                {syncDiagnostics.chatListSync && (
                  <div className="border-t pt-3 mt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Chat List Cursors</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
                      <div className="bg-background rounded px-2 py-1">
                        <span className="text-muted-foreground">newest: </span>
                        <span>{syncDiagnostics.chatListSync.newestCursor || 'none'}</span>
                      </div>
                      <div className="bg-background rounded px-2 py-1">
                        <span className="text-muted-foreground">oldest: </span>
                        <span>{syncDiagnostics.chatListSync.oldestCursor || 'none'}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Last synced: {formatTimestamp(syncDiagnostics.chatListSync.lastSyncedAt)} ({syncDiagnostics.chatListSync.syncSource})
                    </p>
                  </div>
                )}
                
                {syncDiagnostics.stats.newestMessageTime && (
                  <div className="border-t pt-3 mt-3 text-xs text-muted-foreground">
                    <p>Message range: {new Date(syncDiagnostics.stats.oldestMessageTime!).toLocaleDateString()} → {new Date(syncDiagnostics.stats.newestMessageTime).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex items-start gap-4">
              <Button 
                onClick={handleResetCursors} 
                disabled={isResettingCursors} 
                variant="outline" 
              >
                <Compass className={`w-4 h-4 mr-2 ${isResettingCursors ? 'animate-spin' : ''}`} />
                {isResettingCursors ? 'Resetting...' : 'Reset Cursors'}
              </Button>
              <div>
                <p className="text-sm font-medium">Reset Sync Cursors</p>
                <p className="text-xs text-muted-foreground">Clears cursor boundaries, forcing full re-fetch on next sync. Keeps cached data.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Historical Sync */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-500" />
              <CardTitle>Historical Sync</CardTitle>
            </div>
            <CardDescription>Load older chats and messages going back in time</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {historicalSyncResult && (
              <div className={`rounded-lg p-4 flex items-start gap-3 border ${
                historicalSyncResult.type === 'success' 
                  ? 'bg-green-500/10 border-green-500/20' 
                  : 'bg-destructive/10 border-destructive/20'
              }`}>
                {historicalSyncResult.type === 'success' 
                  ? <CheckCircle className="w-5 h-5 text-green-500" /> 
                  : <AlertCircle className="w-5 h-5 text-destructive" />
                }
                <p className={`text-sm ${historicalSyncResult.type === 'success' ? 'text-green-500' : 'text-destructive'}`}>
                  {historicalSyncResult.message}
                </p>
              </div>
            )}
            
            {/* Live Status */}
            {historicalSyncStatus && (historicalSyncStatus.isRunning || historicalSyncStatus.chatsProcessed > 0) && (
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  {historicalSyncStatus.isRunning && (
                    <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin" />
                  )}
                  <span className="text-sm font-medium">
                    {historicalSyncStatus.isRunning ? 'Syncing...' : 'Last sync'}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Chats Processed</p>
                    <p className="font-semibold">{historicalSyncStatus.chatsProcessed}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Messages Loaded</p>
                    <p className="font-semibold">{historicalSyncStatus.messagesLoaded}</p>
                  </div>
                  {historicalSyncStatus.currentChat && (
                    <div>
                      <p className="text-muted-foreground text-xs">Current Chat</p>
                      <p className="font-semibold truncate">{historicalSyncStatus.currentChat}</p>
                    </div>
                  )}
                </div>
                {historicalSyncStatus.error && (
                  <p className="text-xs text-destructive mt-2">{historicalSyncStatus.error}</p>
                )}
              </div>
            )}
            
            {/* Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Messages per request</Label>
                <Input
                  type="number"
                  min={50}
                  max={500}
                  value={messagesPerChat}
                  onChange={(e) => setMessagesPerChat(Number(e.target.value))}
                  className="w-full"
                  disabled={isHistoricalSyncing}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Options</Label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={loadOlderChatsFirst}
                    onChange={(e) => setLoadOlderChatsFirst(e.target.checked)}
                    disabled={isHistoricalSyncing}
                    className="rounded"
                  />
                  <span className="text-sm">Load older chats</span>
                </label>
              </div>
            </div>
            
            {/* Controls */}
            <div className="flex items-start gap-4">
              {!isHistoricalSyncing ? (
                <Button 
                  onClick={handleStartHistoricalSync} 
                  variant="outline"
                  className="border-indigo-500/50 hover:bg-indigo-500/10"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Sync
                </Button>
              ) : (
                <Button 
                  onClick={handleStopHistoricalSync} 
                  variant="outline"
                  className="border-red-500/50 hover:bg-red-500/10"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </Button>
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">Batch Historical Sync</p>
                <p className="text-xs text-muted-foreground">
                  Loads older chats and messages in batches. Runs continuously until stopped or complete.
                </p>
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
            <Link 
              to="/settings/sample-outputs"
              className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border hover:border-orange-500/50 hover:bg-accent transition-all group"
            >
              <FileText className="h-5 w-5 text-orange-500 group-hover:text-orange-400" />
              <div>
                <p className="font-medium group-hover:text-accent-foreground">Sample Outputs</p>
                <p className="text-xs text-muted-foreground">Copy messages for AI tone training</p>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
