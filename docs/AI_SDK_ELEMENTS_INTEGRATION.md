# AI SDK Elements Integration Plan

## Overview

[AI SDK Elements](https://ai-sdk.dev/elements/overview) is a component library built on shadcn/ui designed for building AI-native applications. It provides pre-built, accessible React components for conversations, messages, and interactive AI interfaces.

## What is AI SDK Elements?

AI Elements is a free, open-source component library from the creators of Next.js and Vercel AI SDK that gives you:

- **Pre-built conversation components** - Message display, conversation wrappers, avatars
- **Interactive elements** - Prompt inputs, suggestions, actions
- **Advanced features** - Code blocks, reasoning displays, sources, citations
- **Seamless integration** - Works perfectly with Vercel AI SDK and TanStack Query
- **Built on shadcn/ui** - Uses the same component architecture we already have

## Key Components for Our Dashboard

### Core Conversation Components

1. **`<Conversation />`** - Wraps messages with auto-scrolling and scroll-to-bottom button
2. **`<Message />`** - Displays individual messages with avatars and styling
3. **`<PromptInput />`** - Input field for user messages with model selection
4. **`<Response />`** - Renders markdown AI responses beautifully
5. **`<Loader />`** - Loading indicator for AI responses
6. **`<Actions />`** - Message actions (retry, like, copy, share)
7. **`<Suggestion />`** - Quick suggestion chips for common queries

### Advanced Components

- **`<Sources />`** - Display sources used in AI response
- **`<CodeBlock />`** - Syntax-highlighted code blocks
- **`<Reasoning />`** - Display AI's chain-of-thought
- **`<Task />`** - Show AI task progress
- **`<Tool />`** - Display tool/function call results

## Prerequisites

✅ **Already have:**
- Node.js 18+
- TanStack Start (React-based)
- shadcn/ui components
- Convex backend

❌ **Need to install:**
- Vercel AI SDK (`ai` package)
- AI Elements components
- Optional: AI Gateway API key for easy model access

## Installation Steps

### 1. Install Vercel AI SDK

```bash
npm install ai
```

### 2. Install AI Elements CLI

The AI Elements CLI automatically installs components into your existing shadcn/ui setup:

```bash
# Install the conversation component (includes dependencies)
npx ai-elements@latest add conversation

# Install the message component
npx ai-elements@latest add message

# Install prompt input
npx ai-elements@latest add prompt-input

# Install response component
npx ai-elements@latest add response

# Install actions component
npx ai-elements@latest add actions

# Install suggestion component
npx ai-elements@latest add suggestion

# Install loader component
npx ai-elements@latest add loader
```

Components will be added to: `src/components/ai-elements/`

### 3. Optional: Set up AI Gateway

Instead of managing API keys for multiple providers, use Vercel's AI Gateway (includes $5/month free):

1. Get API key: https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%2Fapi-keys
2. Add to `.env.local`:
   ```
   AI_GATEWAY_API_KEY=your_key_here
   ```

## Integration Architecture

### Option A: Standalone AI Chat Feature

Create a new route for AI conversations separate from Beeper messages:

```
/ai-chat      - New AI conversation interface
/messages     - Existing Beeper messages
```

### Option B: Enhanced Beeper Messages

Integrate AI suggestions and responses into the existing messages page:

```
/messages     - Beeper messages + AI reply suggestions
```

### Option C: Universal Chat Assistant

Add a floating AI assistant available across all pages:

```
Floating button → Opens AI chat overlay
Available on all routes
```

## Recommended Implementation: Option A

Start with a standalone AI chat feature to test the components, then expand.

## Implementation Plan

### Phase 1: Basic AI Chat Route

1. **Create Backend Route** (`app/api/chat/route.ts`):
   ```typescript
   import { streamText } from 'ai';
   import { openai } from '@ai-sdk/openai';
   
   export async function POST(req: Request) {
     const { messages } = await req.json();
     
     const result = streamText({
       model: openai('gpt-4-turbo'),
       messages,
     });
     
     return result.toDataStreamResponse();
   }
   ```

2. **Create Frontend Route** (`src/routes/ai-chat.tsx`):
   ```typescript
   import { useChat } from 'ai/react';
   import { Conversation, ConversationContent } from '@/components/ai-elements/conversation';
   import { Message, MessageContent, MessageAvatar } from '@/components/ai-elements/message';
   import { PromptInput } from '@/components/ai-elements/prompt-input';
   
   export default function AIChatPage() {
     const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
       api: '/api/chat',
     });
     
     return (
       <div className="h-full flex flex-col">
         <Conversation>
           <ConversationContent>
             {messages.map((message) => (
               <Message key={message.id} from={message.role}>
                 <MessageContent variant="flat">
                   {message.content}
                 </MessageContent>
                 <MessageAvatar
                   src={message.role === 'user' ? '/user-avatar.png' : '/ai-avatar.png'}
                   name={message.role}
                 />
               </Message>
             ))}
           </ConversationContent>
         </Conversation>
         
         <PromptInput
           value={input}
           onChange={handleInputChange}
           onSubmit={handleSubmit}
           disabled={isLoading}
         />
       </div>
     );
   }
   ```

### Phase 2: Convex Integration

Instead of using a REST API route, integrate directly with Convex:

1. **Create Convex Action** (`convex/aiChat.ts`):
   ```typescript
   import { action } from "./_generated/server";
   import { v } from "convex/values";
   import { streamText } from 'ai';
   import { openai } from '@ai-sdk/openai';
   
   export const chat = action({
     args: {
       messages: v.array(v.object({
         role: v.string(),
         content: v.string(),
       })),
     },
     handler: async (ctx, args) => {
       const result = await streamText({
         model: openai('gpt-4-turbo'),
         messages: args.messages,
       });
       
       return result.text;
     },
   });
   ```

2. **Store Chat History** in Convex:
   ```typescript
   // Schema for AI chat history
   aiChats: defineTable({
     userId: v.optional(v.id("users")),
     messages: v.array(v.object({
       role: v.string(),
       content: v.string(),
       createdAt: v.number(),
     })),
     createdAt: v.number(),
     updatedAt: v.number(),
   }),
   ```

### Phase 3: Enhanced Features

1. **Reply Suggestions for Beeper Messages**
   - Add AI-powered reply suggestions to messages page
   - Use the `<Suggestion />` component
   - Store suggestions in Convex `aiSuggestions` table

2. **Message Summarization**
   - Add "Summarize" button to long conversations
   - Use AI to generate summaries
   - Display with `<Response />` component

3. **Smart Search**
   - AI-powered semantic search across messages
   - Use embeddings stored in Convex

4. **Draft Assistance**
   - AI helps compose professional messages
   - Real-time suggestions as user types

## Benefits for Your Dashboard

1. **Professional UI** - Shadcn-quality components designed for AI
2. **Zero Config** - Components work out of the box
3. **Flexible** - Can be used standalone or integrated into existing pages
4. **Type Safe** - Full TypeScript support
5. **Accessible** - WCAG compliant
6. **Modern UX** - Matches ChatGPT, Claude, and other modern AI interfaces

## Component Variants

### Message Variants

- **Contained** (default): Colored backgrounds, distinct bubbles
- **Flat**: Minimalist design like ChatGPT/Gemini

### Use Cases by Component

| Component | Use Case |
|-----------|----------|
| `Conversation` | Full chat interface wrapper |
| `Message` | Individual messages in any list |
| `PromptInput` | Any text input that needs model selection |
| `Response` | Rendering markdown AI responses |
| `Actions` | Message toolbars (copy, retry, share) |
| `Suggestion` | Quick prompts/suggestions |
| `CodeBlock` | Syntax-highlighted code |
| `Sources` | Display reference sources |
| `Loader` | AI thinking indicator |

## Next Steps

1. **Install AI SDK**: `npm install ai`
2. **Install Components**: `npx ai-elements@latest add conversation message prompt-input`
3. **Create Test Route**: `/ai-chat` to experiment
4. **Set up Backend**: Add AI provider (OpenAI, Anthropic, etc.)
5. **Integrate with Convex**: Store chat history
6. **Add to Navigation**: Link from dashboard header
7. **Enhance Beeper Messages**: Add reply suggestions

## Resources

- [AI SDK Documentation](https://ai-sdk.dev/)
- [AI Elements Overview](https://ai-sdk.dev/elements/overview)
- [AI Elements Setup](https://ai-sdk.dev/elements/overview/setup)
- [Conversation Component](https://ai-sdk.dev/elements/components/conversation)
- [Message Component](https://ai-sdk.dev/elements/components/message)
- [Chatbot Example](https://ai-sdk.dev/elements/examples/chatbot)
- [GitHub Repository](https://github.com/vercel/ai-elements)

## Example: Simple Integration

Here's a minimal example to get started:

```typescript
// src/routes/ai-chat.tsx
import { createFileRoute } from '@tanstack/react-router'
import { useChat } from 'ai/react'
import { 
  Conversation, 
  ConversationContent,
  ConversationScrollButton 
} from '@/components/ai-elements/conversation'
import { 
  Message, 
  MessageContent, 
  MessageAvatar 
} from '@/components/ai-elements/message'
import { PromptInput } from '@/components/ai-elements/prompt-input'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

export const Route = createFileRoute('/ai-chat')({
  component: AIChatPage,
})

function AIChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
  })

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        <Conversation className="flex-1">
          <ConversationContent>
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>Start a conversation with AI</p>
              </div>
            ) : (
              messages.map((message) => (
                <Message key={message.id} from={message.role}>
                  <MessageContent variant="flat">
                    {message.content}
                  </MessageContent>
                  <MessageAvatar
                    src={message.role === 'user' ? '/user.png' : '/ai.png'}
                    name={message.role === 'user' ? 'You' : 'AI'}
                  />
                </Message>
              ))
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-t p-4">
          <PromptInput
            value={input}
            onChange={(e) => handleInputChange(e)}
            onSubmit={handleSubmit}
            disabled={isLoading}
            placeholder="Type your message..."
          />
        </div>
      </div>
    </DashboardLayout>
  )
}
```

This gives you a production-ready AI chat interface with minimal code!

