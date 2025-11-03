import { createFileRoute, Link } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useMutation } from 'convex/react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import { useState } from 'react'
import { Trash2, Database, AlertCircle, CheckCircle, Settings as SettingsIcon, Users, RefreshCw } from 'lucide-react'

export const Route = createFileRoute('/settings/')({
  component: SettingsPage,
})

function SettingsPage() {
  const [isClearing, setIsClearing] = useState(false)
  const [clearResult, setClearResult] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const clearMessages = useMutation(api.cleanupMessages.clearAllMessages)
  const clearChats = useMutation(api.cleanupMessages.clearAllChats)
  const triggerDexSync = useMutation(api.dexAdmin.triggerManualSync)
  const { data: dexStats } = useSuspenseQuery(convexQuery(api.dexQueries.getSyncStats, {}))

  const handleClearMessages = async () => {
    if (!confirm('Are you sure you want to delete all cached messages? They will resync automatically.')) {
      return
    }

    setIsClearing(true)
    setClearResult(null)

    try {
      const result = await clearMessages()
      setClearResult({
        type: 'success',
        message: `✅ Deleted ${result.deleted} messages. ${result.message}`,
      })
    } catch (error) {
      setClearResult({
        type: 'error',
        message: `Failed to clear messages: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    } finally {
      setIsClearing(false)
    }
  }

  const handleClearChats = async () => {
    if (!confirm('Are you sure you want to delete all cached chats AND messages? Everything will resync automatically.')) {
      return
    }

    setIsClearing(true)
    setClearResult(null)

    try {
      const result = await clearChats()
      setClearResult({
        type: 'success',
        message: `✅ Deleted ${result.deleted} chats. ${result.message}`,
      })
    } catch (error) {
      setClearResult({
        type: 'error',
        message: `Failed to clear chats: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    } finally {
      setIsClearing(false)
    }
  }

  const handleDexSync = async () => {
    setIsSyncing(true)
    setSyncResult(null)

    try {
      await triggerDexSync()
      setSyncResult({
        type: 'success',
        message: '✅ Dex contact sync started! Check the Convex logs for details.',
      })
    } catch (error) {
      setSyncResult({
        type: 'error',
        message: `Failed to trigger sync: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    } finally {
      setIsSyncing(false)
    }
  }

  const formatTimestamp = (timestamp: number | null) => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minutes ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} hours ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} days ago`
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <PageHeader
          title="Settings"
          description="Manage your dashboard configuration and data"
        />

        <div className="space-y-6 max-w-4xl mt-6">
        {/* Dex Contacts Sync */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              <CardTitle>Dex Contacts Sync</CardTitle>
            </div>
            <CardDescription>
              Automatic synchronization with your Dex CRM contacts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Result Banner */}
            {syncResult && (
              <div
                className={`rounded-lg p-4 flex items-start gap-3 ${
                  syncResult.type === 'success'
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                {syncResult.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p
                    className={`text-sm ${
                      syncResult.type === 'success' ? 'text-green-900' : 'text-red-900'
                    }`}
                  >
                    {syncResult.message}
                  </p>
                </div>
              </div>
            )}

            {/* Sync Status */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Total Contacts</p>
                  <p className="text-2xl font-bold text-gray-900">{dexStats.totalContacts}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Last Synced</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatTimestamp(dexStats.lastSyncTime)}
                  </p>
                </div>
              </div>
              {dexStats.contactsModifiedSinceSync > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-sm text-amber-700">
                    ⚠️ {dexStats.contactsModifiedSinceSync} contact(s) modified locally since last sync
                  </p>
                </div>
              )}
            </div>

            {/* Info Box */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-purple-900">
                  <p className="font-medium mb-1">About Dex Sync</p>
                  <ul className="list-disc list-inside space-y-1 text-purple-800">
                    <li>Contacts sync automatically every 2 hours from Dex</li>
                    <li>Includes: name, emails, phones, Instagram, birthday, last seen</li>
                    <li>Local edits to descriptions sync back to Dex immediately</li>
                    <li>5-minute grace period prevents overwriting recent local changes</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Manual Sync Button */}
            <div className="flex items-start gap-4">
              <Button
                onClick={handleDexSync}
                disabled={isSyncing}
                variant="outline"
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
              <div className="flex-1">
                <p className="text-sm text-gray-700 font-medium">Manual Sync</p>
                <p className="text-xs text-gray-600">
                  Trigger an immediate sync from Dex. Normally runs every 2 hours automatically.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Beeper Cache Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              <CardTitle>Beeper Cache Management</CardTitle>
            </div>
            <CardDescription>
              Manage cached messages and chats from the Beeper integration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Result Banner */}
            {clearResult && (
              <div
                className={`rounded-lg p-4 flex items-start gap-3 ${
                  clearResult.type === 'success'
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                {clearResult.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p
                    className={`text-sm ${
                      clearResult.type === 'success' ? 'text-green-900' : 'text-red-900'
                    }`}
                  >
                    {clearResult.message}
                  </p>
                </div>
              </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-medium mb-1">About Beeper Cache</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-800">
                    <li>Messages are cached locally in Convex for fast loading</li>
                    <li>Clearing the cache will force a complete resync from Beeper</li>
                    <li>Useful if you're seeing duplicate or incorrect messages</li>
                    <li>Data will automatically resync on next page load</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <div className="flex items-start gap-4">
                <Button
                  onClick={handleClearMessages}
                  disabled={isClearing}
                  variant="outline"
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Cached Messages
                </Button>
                <div className="flex-1">
                  <p className="text-sm text-gray-700 font-medium">Clear Messages Only</p>
                  <p className="text-xs text-gray-600">
                    Deletes all cached messages. Chats remain intact.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Button
                  onClick={handleClearChats}
                  disabled={isClearing}
                  variant="outline"
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All Chat Data
                </Button>
                <div className="flex-1">
                  <p className="text-sm text-gray-700 font-medium">Full Cache Reset</p>
                  <p className="text-xs text-gray-600">
                    Deletes all chats and messages. Complete fresh start.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Other Settings Sections */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-purple-600" />
              <CardTitle>Other Settings</CardTitle>
            </div>
            <CardDescription>
              Additional configuration options
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button variant="outline" asChild>
                <Link to="/settings/prompts">Manage AI Prompts</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
