import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useConvexMutation, useConvexAction } from '@convex-dev/react-query'
import { api } from '../../../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  LayoutList,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/_authenticated/settings/linear')({
  component: LinearSettingsPage,
})

function LinearSettingsPage() {
  const { data: workspaces } = useQuery(
    convexQuery(api.linearActions.listWorkspaces, {})
  )
  const { data: stats } = useQuery(convexQuery(api.linearSync.getStats, {}))

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  // Get the webhook URL
  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin.replace('.convex.cloud', '.convex.site')}/linear-webhook`
      : ''

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="p-6">
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <LayoutList className="w-8 h-8 text-purple-500" />
          <div>
            <h1 className="text-2xl font-bold">Linear Integration</h1>
            <p className="text-muted-foreground mt-1">
              Connect Linear workspaces to track your issues
            </p>
          </div>
        </div>

        {/* Stats Overview */}
        {stats && stats.totalIssues > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Issues</span>
                  <p className="text-lg font-semibold">{stats.totalIssues}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Urgent</span>
                  <p className="text-lg font-semibold text-red-500">{stats.byPriority.urgent}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">High Priority</span>
                  <p className="text-lg font-semibold text-orange-500">{stats.byPriority.high}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">In Progress</span>
                  <p className="text-lg font-semibold text-blue-500">{stats.byStatusType.started}</p>
                </div>
              </div>
              {stats.lastSyncedAt && (
                <p className="text-xs text-muted-foreground mt-4">
                  Last synced: {new Date(stats.lastSyncedAt).toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Webhook Setup */}
        <Card>
          <CardHeader>
            <CardTitle>Webhook Setup (Optional)</CardTitle>
            <CardDescription>
              Set up a webhook in Linear for real-time updates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              To receive instant updates when issues change, add a webhook in your Linear workspace
              settings. The dashboard will still sync every 15 minutes without a webhook.
            </p>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Webhook URL</Label>
              <div className="flex items-center gap-2 p-2 bg-muted rounded">
                <code className="text-xs flex-1 break-all">{webhookUrl}</code>
                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(webhookUrl)}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <a
              href="https://linear.app/settings/api/webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-purple-500 hover:text-purple-400"
            >
              Open Linear Webhook Settings <ExternalLink className="w-3 h-3" />
            </a>
          </CardContent>
        </Card>

        {/* Workspaces */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Workspaces</h2>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Workspace
              </Button>
            </DialogTrigger>
            <AddWorkspaceDialog onClose={() => setIsAddDialogOpen(false)} />
          </Dialog>
        </div>

        {(workspaces?.length ?? 0) === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <LayoutList className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No Linear workspaces connected</p>
              <p className="text-sm text-muted-foreground mb-4">
                Add a workspace using your Linear API key
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Workspace
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {(workspaces ?? []).map((workspace) => (
              <WorkspaceCard key={workspace._id} workspace={workspace} />
            ))}
          </div>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>How to Get Your API Key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              1. Go to{' '}
              <a
                href="https://linear.app/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-500 hover:text-purple-400 inline-flex items-center gap-1"
              >
                Linear API Settings <ExternalLink className="w-3 h-3" />
              </a>
            </p>
            <p>2. Click "Create new API key"</p>
            <p>3. Give it a name like "My Dashboard" and set the scope to "Read-only"</p>
            <p>4. Copy the key and paste it above</p>
            <p className="text-xs mt-2">
              Note: Each workspace requires a separate API key. The key owner determines which
              user's issues are synced.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function WorkspaceCard({
  workspace,
}: {
  workspace: {
    _id: Id<'linearWorkspaces'>
    workspaceId: string
    workspaceName: string
    userName?: string
    isActive: boolean
    lastSyncedAt?: number
    createdAt: number
  }
}) {
  const deleteWorkspace = useConvexMutation(api.linearActions.deleteWorkspace)
  const toggleActive = useConvexMutation(api.linearActions.toggleWorkspaceActive)
  const testConnection = useConvexAction(api.linearActions.testConnection)

  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  const handleDelete = () => {
    if (confirm(`Delete workspace "${workspace.workspaceName}"? This will also remove all synced issues.`)) {
      deleteWorkspace({ id: workspace._id }).catch((e) =>
        alert(e.message || 'Failed to delete')
      )
    }
  }

  const handleToggleActive = () => {
    toggleActive({ id: workspace._id }).catch((e) =>
      alert(e.message || 'Failed to toggle')
    )
  }

  const handleTest = async () => {
    setIsTesting(true)
    setTestResult(null)
    try {
      const result = await testConnection({ workspaceId: workspace._id })
      if (result.success) {
        setTestResult({
          success: true,
          message: `Connected as ${result.userName}. Found ${result.teamCount} team(s).`,
        })
      } else {
        setTestResult({
          success: false,
          message: result.error || 'Connection failed',
        })
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e.message || 'Connection test failed',
      })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <Card className={!workspace.isActive ? 'opacity-60' : ''}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <LayoutList className="w-5 h-5 text-purple-500" />
          <div>
            <CardTitle className="text-lg font-semibold">{workspace.workspaceName}</CardTitle>
            {workspace.userName && (
              <CardDescription className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {workspace.userName}
              </CardDescription>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {workspace.isActive ? (
            <Badge variant="outline" className="text-green-500 border-green-500">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Active
            </Badge>
          ) : (
            <Badge variant="secondary">
              <XCircle className="w-3 h-3 mr-1" />
              Inactive
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {workspace.lastSyncedAt
              ? `Last synced: ${new Date(workspace.lastSyncedAt).toLocaleString()}`
              : 'Never synced'}
          </span>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Active</span>
            <Switch checked={workspace.isActive} onCheckedChange={handleToggleActive} />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={isTesting}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isTesting ? 'animate-spin' : ''}`} />
              Test
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {testResult && (
          <div
            className={`p-3 rounded-lg text-sm border ${
              testResult.success ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-destructive/10 text-destructive border-destructive/20'
            }`}
          >
            {testResult.message}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AddWorkspaceDialog({ onClose }: { onClose: () => void }) {
  const [apiKey, setApiKey] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const addWorkspace = useConvexAction(api.linearActions.addWorkspace)

  const handleSubmit = async () => {
    if (!apiKey.trim()) {
      alert('Please enter an API key')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await addWorkspace({ apiKey: apiKey.trim() })
      alert(`Successfully added "${result.workspaceName}" with ${result.teamCount} team(s)!`)
      onClose()
    } catch (e: any) {
      alert('Failed to add workspace: ' + (e.message || 'Unknown error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add Linear Workspace</DialogTitle>
        <DialogDescription>
          Enter a Linear API key to connect a workspace
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label>API Key</Label>
          <Input
            id="apiKey"
            placeholder="lin_api_xxxxxx..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            type="password"
          />
          <p className="text-xs text-muted-foreground">
            The workspace and user will be auto-detected from the API key
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting || !apiKey.trim()}>
          {isSubmitting ? 'Adding...' : 'Add Workspace'}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
