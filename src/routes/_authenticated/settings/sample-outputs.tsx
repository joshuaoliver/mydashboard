import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Copy,
  Check,
  MessageSquare,
  FileText,
  Download,
} from 'lucide-react'
import { useState, useMemo } from 'react'

export const Route = createFileRoute('/_authenticated/settings/sample-outputs')({
  component: SampleOutputsPage,
})

function SampleOutputsPage() {
  const { data, isLoading } = useQuery(convexQuery(api.beeperQueries.getUserSentMessages, { limit: 200 }))
  const [copied, setCopied] = useState(false)
  const [copiedTable, setCopiedTable] = useState(false)

  // Generate a plain text version of messages (one per line)
  const plainTextMessages = useMemo(() => {
    if (!data?.messages) return ''
    return data.messages
      .map((m) => m.text)
      .filter((text) => text && text.trim().length > 0)
      .join('\n\n---\n\n')
  }, [data?.messages])

  // Generate a markdown table version
  const tableMessages = useMemo(() => {
    if (!data?.messages) return ''
    const header = '| # | Message | Platform | Sent To |\n|---|---------|----------|---------|'
    const rows = data.messages
      .filter((m) => m.text && m.text.trim().length > 0)
      .map((m, i) => {
        // Escape pipe characters and truncate long messages for table display
        const escapedText = m.text.replace(/\|/g, '\\|').replace(/\n/g, ' ')
        return `| ${i + 1} | ${escapedText} | ${m.network} | ${m.chatName} |`
      })
    return `${header}\n${rows.join('\n')}`
  }, [data?.messages])

  // Generate a simple numbered list (easier for LLMs to parse)
  const numberedList = useMemo(() => {
    if (!data?.messages) return ''
    return data.messages
      .filter((m) => m.text && m.text.trim().length > 0)
      .map((m, i) => `${i + 1}. ${m.text}`)
      .join('\n\n')
  }, [data?.messages])

  const handleCopyPlain = async () => {
    await navigator.clipboard.writeText(numberedList)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyTable = async () => {
    await navigator.clipboard.writeText(tableMessages)
    setCopiedTable(true)
    setTimeout(() => setCopiedTable(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([numberedList], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `my-messages-${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const messageCount = data?.messages?.filter((m) => m.text && m.text.trim().length > 0).length ?? 0

  return (
    <div className="p-6">
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Sample Outputs</h1>
          <p className="text-muted-foreground mt-1">
            Your last {messageCount} sent messages, ready to copy for AI tone training
          </p>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              <CardTitle className="text-sm">Quick Copy</CardTitle>
            </div>
            <CardDescription>
              Copy all your messages in a format ready for LLM context
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={handleCopyPlain}
                variant="outline"
                className="gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy as Numbered List
                  </>
                )}
              </Button>
              <Button 
                onClick={handleCopyTable}
                variant="outline"
                className="gap-2"
              >
                {copiedTable ? (
                  <>
                    <Check className="h-4 w-4 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy as Markdown Table
                  </>
                )}
              </Button>
              <Button 
                onClick={handleDownload}
                variant="outline"
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download .txt
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Tip: Use the numbered list format for chat-based LLMs, or the markdown table for documentation.
            </p>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold">{messageCount}</p>
              <p className="text-sm text-muted-foreground">Messages</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold">
                {data?.messages ? [...new Set(data.messages.map(m => m.network))].length : 0}
              </p>
              <p className="text-sm text-muted-foreground">Platforms</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold">
                {data?.messages ? [...new Set(data.messages.map(m => m.chatName))].length : 0}
              </p>
              <p className="text-sm text-muted-foreground">Conversations</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold">
                {data?.messages 
                  ? Math.round(data.messages.reduce((acc, m) => acc + (m.text?.length ?? 0), 0) / Math.max(messageCount, 1))
                  : 0}
              </p>
              <p className="text-sm text-muted-foreground">Avg. Length</p>
            </CardContent>
          </Card>
        </div>

        {/* Message Preview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-purple-500" />
                <CardTitle className="text-sm">Message Preview</CardTitle>
              </div>
              <Badge variant="secondary">{messageCount} messages</Badge>
            </div>
            <CardDescription>
              Preview of your recent messages (newest first)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading messages...
              </div>
            ) : !data?.messages || data.messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No sent messages found</p>
                <p className="text-sm">Send some messages and they'll appear here</p>
              </div>
            ) : (
              <div className="max-h-[600px] overflow-y-auto space-y-3">
                {data.messages
                  .filter((m) => m.text && m.text.trim().length > 0)
                  .map((message, index) => (
                    <div 
                      key={message.id} 
                      className="p-3 rounded-lg bg-muted/50 border hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {message.text}
                          </p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <Badge variant="outline" className="text-xs">
                            {message.network}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {message.chatName}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                        <span>#{index + 1}</span>
                        <span>
                          {new Date(message.timestamp).toLocaleDateString()} {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
