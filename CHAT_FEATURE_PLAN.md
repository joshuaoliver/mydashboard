# Chat Feature Enhancement Plan

## Research Summary

### Current State
- Voice transcription: Using `experimental_transcribe` from AI SDK with OpenAI Whisper - **correct approach**
- Model selection: Already have `AVAILABLE_MODELS` in `convex/aiSettings.ts` with 21+ models
- Message streaming: Placeholder only - needs full Convex Agent integration
- Attachments: Convex Agent supports file/image handling via `storeFile` + `getFile`
- Memory: Supermemory offers easy AI SDK integration via `@supermemory/tools`

---

## Phase 1: Message Streaming Display (Priority)

### Backend Changes

**File: `convex/chat.ts`**

Add streaming query with proper `listUIMessages` + `syncStreams`:

```typescript
import { paginationOptsValidator } from "convex/server";
import { listUIMessages, syncStreams, vStreamArgs } from "@convex-dev/agent";

export const listThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  handler: async (ctx, args) => {
    const paginated = await listUIMessages(ctx, components.agent, {
      threadId: args.threadId,
      paginationOpts: args.paginationOpts,
    });
    const streams = await syncStreams(ctx, components.agent, {
      threadId: args.threadId,
      streamArgs: args.streamArgs,
    });
    return { ...paginated, streams };
  },
});
```

### Frontend Changes

**File: `src/components/chat/ChatConversation.tsx`**

Replace placeholder with real streaming:

```typescript
import { useUIMessages, useSmoothText } from "@convex-dev/agent/react";

function ChatConversation({ threadId }) {
  const { results: messages, status, loadMore } = useUIMessages(
    api.chat.listThreadMessages,
    threadId ? { threadId } : "skip",
    { initialNumItems: 50, stream: true }
  );

  return (
    <div>
      {messages?.map((message) => (
        <StreamingMessage key={message.key} message={message} />
      ))}
    </div>
  );
}

function StreamingMessage({ message }) {
  const [visibleText] = useSmoothText(message.text, {
    startStreaming: message.status === "streaming",
  });

  return (
    <Message from={message.role}>
      <MessageContent>{visibleText}</MessageContent>
      {message.status === "streaming" && <Loader />}
    </Message>
  );
}
```

---

## Phase 2: Model Selection UI

### Schema Addition

**File: `convex/schema.ts`** - Add to agentThreads:

```typescript
agentThreads: defineTable({
  // ... existing fields
  modelId: v.optional(v.string()),  // User-selected model for this thread
})
```

### Frontend Component

**File: `src/components/chat/ModelSelector.tsx`**

```typescript
import { useQuery } from "convex/react";
import { api } from "~/convex/_generated/api";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Bot } from "lucide-react";

interface ModelSelectorProps {
  value?: string;
  onChange: (modelId: string) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const models = useQuery(api.aiSettings.getAvailableModels);

  // Group models by provider
  const grouped = models?.reduce((acc, model) => {
    if (!acc[model.provider]) acc[model.provider] = [];
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, typeof models>);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px] h-8 text-xs">
        <Bot className="h-3 w-3 mr-2" />
        <span>{models?.find(m => m.id === value)?.name || "Select model"}</span>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(grouped || {}).map(([provider, providerModels]) => (
          <div key={provider}>
            <div className="px-2 py-1 text-xs text-muted-foreground font-medium">
              {provider}
            </div>
            {providerModels.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                <div className="flex flex-col">
                  <span>{model.name}</span>
                  <span className="text-xs text-muted-foreground">{model.description}</span>
                </div>
              </SelectItem>
            ))}
          </div>
        ))}
      </SelectContent>
    </Select>
  );
}
```

### Integration in PromptInput

Add model selector to the chat input area (left side of textarea).

---

## Phase 3: Thread Title Auto-Generation

### Backend Action

**File: `convex/chat.ts`**

```typescript
export const generateThreadTitle = internalAction({
  args: { threadId: v.string(), firstMessage: v.string() },
  handler: async (ctx, args) => {
    // Use a cheap/fast model for title generation
    const { text } = await generateText({
      model: openai("gpt-4o-mini"), // Low-cost model
      prompt: `Generate a very short (3-5 word) title for this conversation. Just respond with the title, nothing else.\n\nFirst message: "${args.firstMessage}"`,
      maxTokens: 20,
    });

    await ctx.runMutation(internal.chat.updateThreadTitleInternal, {
      threadId: args.threadId,
      title: text.trim(),
    });
  },
});
```

### Trigger on First Message

In `startConversation` mutation, schedule title generation after the first response.

---

## Phase 4: Attachment Support

### File Upload Flow

1. **Upload to Convex storage** via `generateUploadUrl`
2. **Store file reference** with `storeFile` from Convex Agent
3. **Include in message** as `imagePart` or `filePart`
4. **AI processes** the file content

### Backend

**File: `convex/chat.ts`**

```typescript
import { storeFile, getFile } from "@convex-dev/agent";

export const sendMessageWithAttachment = mutation({
  args: {
    threadId: v.string(),
    prompt: v.string(),
    storageId: v.optional(v.id("_storage")),
    mimeType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let fileId: string | undefined;

    if (args.storageId) {
      // Store file in agent's file tracking system
      fileId = await storeFile(ctx, components.agent, {
        storageId: args.storageId,
        mimeType: args.mimeType,
      });
    }

    // Schedule response generation with file context
    await ctx.scheduler.runAfter(0, internal.chat.generateWithFile, {
      threadId: args.threadId,
      prompt: args.prompt,
      fileId,
    });
  },
});
```

### Frontend

Add file upload button to PromptInput with drag-and-drop support.

---

## Phase 5: Supermemory Integration (Future)

### Installation

```bash
bun add @supermemory/tools
```

### Integration Options

**Option A: Memory Tools (Recommended)**

Add Supermemory tools to the agent's tool set:

```typescript
import { supermemoryTools } from "@supermemory/tools/ai-sdk";

export const chatAgent = new Agent(components.agent, {
  // ... existing config
  tools: {
    ...supermemoryTools(process.env.SUPERMEMORY_API_KEY!, {
      containerTags: ["user-{userId}"], // Per-user memory isolation
    }),
    // ... existing tools
  },
});
```

**Option B: Infinite Chat (For unlimited context)**

Use Supermemory as a proxy to extend context window:

```typescript
const infiniteChat = createOpenAI({
  baseUrl: 'https://api.supermemory.ai/v3/https://api.openai.com/v1',
  apiKey: process.env.OPENAI_API_KEY,
  headers: {
    'x-supermemory-api-key': process.env.SUPERMEMORY_API_KEY,
    'x-sm-conversation-id': threadId,
  },
});
```

### Considerations

- **Free tier available** at console.supermemory.ai
- **Container tags** allow per-user memory isolation
- **AI decides** when to store/retrieve memories based on system prompt
- **Sub-400ms latency** for memory operations

---

## Implementation Order

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 1 | Message Streaming Display | Medium | High - Core UX |
| 2 | Model Selection UI | Low | Medium - User control |
| 3 | Thread Title Generation | Low | Medium - Organization |
| 4 | Attachment Support | Medium | Medium - Rich content |
| 5 | Supermemory Integration | Medium | High - Context memory |

---

## Files to Modify

### Backend
- `convex/chat.ts` - Add streaming query, title generation, attachments
- `convex/agentChat.ts` - Add Supermemory tools (Phase 5)
- `convex/schema.ts` - Add modelId to threads

### Frontend
- `src/components/chat/ChatConversation.tsx` - Real streaming
- `src/components/chat/ModelSelector.tsx` - New component
- `src/components/chat/AttachmentButton.tsx` - New component
- `src/components/ai-elements/prompt-input.tsx` - Add model selector slot

---

## Environment Variables Needed

```env
# Already have
OPENAI_API_KEY=...

# For Supermemory (Phase 5)
SUPERMEMORY_API_KEY=...
```

---

## Notes

- **Transcription**: Already using correct AI SDK approach (`experimental_transcribe`)
- **Model selection**: Leverage existing `aiSettings.ts` infrastructure
- **No reminder system needed**: Per user request
- **No quick action templates**: Per user request
- **Mobile optimizations deferred**: Per user request
