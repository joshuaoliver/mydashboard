# AI Chat Quick Start Guide

## Get Started in 15 Minutes

This guide will help you add a professional AI chat interface to your dashboard using AI SDK Elements.

## Step 1: Install Dependencies

```bash
# Install Vercel AI SDK
npm install ai

# Install AI provider (choose one)
npm install @ai-sdk/openai  # OpenAI (GPT-4, GPT-3.5)
npm install @ai-sdk/anthropic  # Anthropic (Claude)
npm install @ai-sdk/google  # Google (Gemini)
```

## Step 2: Set Up Environment Variables

Add to your `.env.local`:

```bash
# Option A: Use AI Gateway (includes $5/month free)
AI_GATEWAY_API_KEY=your_gateway_key_here

# Option B: Direct provider API key
OPENAI_API_KEY=your_openai_key_here
# or
ANTHROPIC_API_KEY=your_anthropic_key_here
```

Get AI Gateway key: https://vercel.com/ai/api-keys

## Step 3: Install AI Elements Components

```bash
# Install the core conversation components
npx ai-elements@latest add conversation
npx ai-elements@latest add message
npx ai-elements@latest add prompt-input
npx ai-elements@latest add response
npx ai-elements@latest add loader
```

Components will be added to `src/components/ai-elements/`

## Step 4: Create Backend Route

Since you're using TanStack Start, we need to adapt the typical Next.js pattern. Create a Convex action instead:

**File: `convex/aiChat.ts`**

```typescript
import { action } from "./_generated/server";
import { v } from "convex/values";

export const chat = action({
  args: {
    messages: v.array(
      v.object({
        role: v.string(),
        content: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { streamText } = await import("ai");
    const { openai } = await import("@ai-sdk/openai");

    const result = await streamText({
      model: openai("gpt-4-turbo"),
      messages: args.messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
    });

    // For now, return the full text
    // In production, you'd want to implement streaming
    return await result.text;
  },
});

// Store chat history
export const saveChatMessage = action({
  args: {
    role: v.string(),
    content: v.string(),
    chatId: v.optional(v.id("aiChats")),
  },
  handler: async (ctx, args) => {
    const { role, content, chatId } = args;
    const now = Date.now();

    if (chatId) {
      // Add to existing chat
      const chat = await ctx.runQuery(internal.aiChat.getChat, { chatId });
      if (chat) {
        await ctx.runMutation(internal.aiChat.addMessage, {
          chatId,
          message: { role, content, createdAt: now },
        });
      }
    } else {
      // Create new chat
      return await ctx.runMutation(internal.aiChat.createChat, {
        message: { role, content, createdAt: now },
      });
    }
  },
});
```

## Step 5: Update Convex Schema

Add to `convex/schema.ts`:

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ... existing tables ...
  
  aiChats: defineTable({
    userId: v.optional(v.id("users")),
    title: v.optional(v.string()),
    messages: v.array(
      v.object({
        role: v.string(),
        content: v.string(),
        createdAt: v.number(),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),
});
```

## Step 6: Create Frontend Route

**File: `src/routes/ai-chat.tsx`**

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/layout/page-header'
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import {
  Message,
  MessageContent,
  MessageAvatar,
} from '@/components/ai-elements/message'
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from '@/components/ai-elements/prompt-input'
import { Loader } from '@/components/ai-elements/loader'

export const Route = createFileRoute('/ai-chat')({
  component: AIChatPage,
})

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
}

function AIChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  const chatAction = useMutation(api.aiChat.chat)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await chatAction({
        messages: [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        })),
      })

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col p-6">
        <PageHeader
          title="AI Chat"
          description="Have a conversation with AI"
        />

        <div className="flex-1 flex flex-col min-h-0">
          <Conversation className="flex-1">
            <ConversationContent>
              {messages.length === 0 ? (
                <ConversationEmptyState
                  title="Start a conversation"
                  description="Ask me anything and I'll do my best to help!"
                />
              ) : (
                <>
                  {messages.map((message) => (
                    <Message key={message.id} from={message.role}>
                      <MessageContent variant="flat">
                        {message.content}
                      </MessageContent>
                      <MessageAvatar
                        src={
                          message.role === 'user'
                            ? 'https://github.com/shadcn.png'
                            : 'https://github.com/openai.png'
                        }
                        name={message.role === 'user' ? 'You' : 'AI'}
                      />
                    </Message>
                  ))}
                  {isLoading && (
                    <Message from="assistant">
                      <MessageContent variant="flat">
                        <Loader />
                      </MessageContent>
                      <MessageAvatar
                        src="https://github.com/openai.png"
                        name="AI"
                      />
                    </Message>
                  )}
                </>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="border-t pt-4 mt-4">
            <PromptInput onSubmit={handleSubmit}>
              <PromptInputTextarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                disabled={isLoading}
              />
              <PromptInputSubmit disabled={isLoading || !input.trim()} />
            </PromptInput>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
```

## Step 7: Add to Navigation

Update `src/components/layout/dashboard-layout.tsx` to add AI Chat to the navigation:

```typescript
// Add to imports
import { Bot } from "lucide-react"

// Add to navigation menu items
<NavigationMenuItem>
  <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
    <Link to="/ai-chat" className="flex items-center gap-2 text-slate-200 hover:text-white hover:bg-slate-800">
      <Bot className="h-4 w-4" />
      AI Chat
    </Link>
  </NavigationMenuLink>
</NavigationMenuItem>
```

## Step 8: Test It!

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Navigate to `/ai-chat`

3. Start chatting!

## Next Steps

### Add Streaming Support

For real-time streaming responses (like ChatGPT), you'll need to:

1. Implement a streaming endpoint in Convex or use an API route
2. Use the `useChat` hook from `ai/react`
3. Update the frontend to handle streaming

### Add Chat History

Store conversations in Convex and list them in a sidebar:

```typescript
// List chats
export const listChats = query({
  handler: async (ctx) => {
    return await ctx.db.query("aiChats").order("desc").take(50);
  },
});

// Get chat messages
export const getChat = query({
  args: { chatId: v.id("aiChats") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.chatId);
  },
});
```

### Add Model Selection

Use the `<PromptInputModelSelect />` component to let users choose between models:

```typescript
<PromptInputModelSelect value={model} onValueChange={setModel}>
  <PromptInputModelSelectTrigger />
  <PromptInputModelSelectContent>
    <PromptInputModelSelectItem value="gpt-4">GPT-4</PromptInputModelSelectItem>
    <PromptInputModelSelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</PromptInputModelSelectItem>
    <PromptInputModelSelectItem value="claude-3">Claude 3</PromptInputModelSelectItem>
  </PromptInputModelSelectContent>
</PromptInputModelSelect>
```

### Add Reply Suggestions to Beeper Messages

Integrate AI suggestions into your existing messages page:

```typescript
// In messages.tsx, add suggestion component
import { Suggestion } from '@/components/ai-elements/suggestion'

// Show AI-generated reply suggestions
<div className="flex gap-2 flex-wrap">
  <Suggestion onClick={() => sendReply("Thanks for reaching out!")}>
    Thanks for reaching out!
  </Suggestion>
  <Suggestion onClick={() => sendReply("I'll get back to you soon")}>
    I'll get back to you soon
  </Suggestion>
  <Suggestion onClick={() => sendReply("Can you provide more details?")}>
    Can you provide more details?
  </Suggestion>
</div>
```

## Troubleshooting

### "Module not found: 'ai'"

Make sure you installed the AI SDK:
```bash
npm install ai
```

### "Cannot find module '@ai-sdk/openai'"

Install the provider package:
```bash
npm install @ai-sdk/openai
```

### Components not found

Make sure you ran the installation command:
```bash
npx ai-elements@latest add conversation message prompt-input
```

### API Key errors

Check that your environment variables are set correctly in `.env.local` and restart your dev server.

## Resources

- [AI SDK Documentation](https://ai-sdk.dev/)
- [AI Elements Components](https://ai-sdk.dev/elements/components)
- [Convex Documentation](https://docs.convex.dev/)
- [Example Apps](https://ai-sdk.dev/elements/examples)

## What You Built

You now have:
- ✅ Professional AI chat interface
- ✅ Message history display
- ✅ Loading states
- ✅ Auto-scrolling conversation
- ✅ Responsive design
- ✅ Type-safe implementation

Next, explore adding streaming, chat history, and integrating AI suggestions into your Beeper messages!

