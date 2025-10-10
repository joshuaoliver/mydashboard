# Standard Page Structure

## Overview

All dashboard pages should follow this standard structure for consistent UX and proper scrolling behavior using [Shadcn ScrollArea](https://ui.shadcn.com/docs/components/scroll-area).

## Page Structure

```tsx
<div className="h-screen flex flex-col bg-gray-50">
  {/* Header - Fixed height */}
  <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
    {/* Page title, actions, etc. */}
  </div>

  {/* Content area - 100vh minus header */}
  <div className="flex-1 flex min-h-0">
    {/* Scrollable sections using ScrollArea */}
  </div>
</div>
```

## Key Principles

### 1. **Height = 100vh**
```tsx
<div className="h-screen flex flex-col">
```
- Page takes full viewport height
- Uses flexbox column layout

### 2. **Fixed Header**
```tsx
<div className="flex-shrink-0">
```
- Header doesn't scroll
- Contains page title, actions, status info
- `flex-shrink-0` prevents it from shrinking

### 3. **Content = Remaining Space**
```tsx
<div className="flex-1 flex min-h-0">
```
- Takes all remaining height after header
- `flex-1` makes it grow to fill space
- `min-h-0` critical for nested flex containers to scroll properly

### 4. **Use ScrollArea for Scrollable Sections**
```tsx
import { ScrollArea } from '@/components/ui/scroll-area'

<ScrollArea className="flex-1">
  {/* Scrollable content */}
</ScrollArea>
```
- Provides custom, cross-browser scrolling
- Consistent scrollbar styling
- Better touch support

## Messages Page Example

### Structure
```
┌─────────────────────────────────────────────────────────────┐
│ Header (Fixed)                                              │ ← flex-shrink-0
├────────────┬────────────────────────────┬───────────────────┤
│ Chat List  │ Messages Area              │ AI Suggestions    │
│ (320px)    │ (flex-1)                   │ (500px)           │
│ ScrollArea │ ScrollArea                 │ ScrollArea        │ ← flex-1, min-h-0
│            │                            │                   │
│            │                            │                   │
└────────────┴────────────────────────────┴───────────────────┘
     100vh minus header height
```

### Implementation

```tsx
function Messages() {
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Fixed Header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <h1>Messages</h1>
        <Button onClick={handleRefresh}>Refresh</Button>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar - Chat List */}
        <div className="w-80 bg-white border-r flex flex-col flex-shrink-0">
          <div className="px-4 py-3 border-b flex-shrink-0">
            <h2>Pending Replies</h2>
          </div>
          <ScrollArea className="flex-1">
            {chats.map(chat => <ChatItem key={chat.id} {...chat} />)}
          </ScrollArea>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex min-h-0">
          {/* Messages */}
          <div className="flex-1 flex flex-col bg-white min-w-0">
            <ChatDetail messages={messages} />
          </div>

          {/* AI Suggestions */}
          <ScrollArea className="w-[500px] flex-shrink-0 bg-white">
            <ReplySuggestions suggestions={suggestions} />
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
```

## Common Patterns

### Single Column with Sidebar

```tsx
<div className="h-screen flex flex-col">
  {/* Header */}
  <div className="flex-shrink-0 px-6 py-4 border-b">
    <h1>Page Title</h1>
  </div>

  {/* Content */}
  <div className="flex-1 flex min-h-0">
    {/* Sidebar */}
    <div className="w-64 border-r flex flex-col flex-shrink-0">
      <ScrollArea className="flex-1">
        {/* Sidebar content */}
      </ScrollArea>
    </div>

    {/* Main */}
    <ScrollArea className="flex-1">
      {/* Main content */}
    </ScrollArea>
  </div>
</div>
```

### Three Column Layout

```tsx
<div className="h-screen flex flex-col">
  {/* Header */}
  <div className="flex-shrink-0 ...">...</div>

  {/* Content */}
  <div className="flex-1 flex min-h-0">
    {/* Left - Fixed width */}
    <div className="w-80 flex-shrink-0">
      <ScrollArea className="h-full">...</ScrollArea>
    </div>

    {/* Center - Flex grows */}
    <div className="flex-1 min-w-0">
      <ScrollArea className="h-full">...</ScrollArea>
    </div>

    {/* Right - Fixed width */}
    <div className="w-[500px] flex-shrink-0">
      <ScrollArea className="h-full">...</ScrollArea>
    </div>
  </div>
</div>
```

## Critical CSS Classes

### Height Management
- `h-screen` - Full viewport height (100vh)
- `flex-1` - Grow to fill available space
- `min-h-0` - **CRITICAL** for nested flex scroll containers
- `flex-shrink-0` - Don't shrink this element

### Layout
- `flex flex-col` - Vertical flexbox layout
- `flex` - Horizontal flexbox layout
- `min-w-0` - Allow element to shrink below content width (prevents overflow)

### Scrolling
- Use `<ScrollArea>` from Shadcn, not `overflow-y-auto`
- Always wrap scrollable content, not the container

## Why `min-h-0`?

**Problem**: Without `min-h-0`, flex items won't shrink below their content size, breaking scroll.

```tsx
// ❌ WRONG - Won't scroll
<div className="flex-1 flex">
  <ScrollArea className="flex-1">...</ScrollArea>
</div>

// ✅ CORRECT - Scrolls properly
<div className="flex-1 flex min-h-0">
  <ScrollArea className="flex-1">...</ScrollArea>
</div>
```

**The Fix**: `min-h-0` tells the flex item it can shrink below its content height, enabling scroll.

## ScrollArea Benefits

1. **Custom Styling**: Consistent scrollbar appearance across browsers
2. **Touch Support**: Better mobile/trackpad experience
3. **Performance**: Optimized for React rendering
4. **Accessibility**: Proper ARIA attributes

## Common Mistakes

### ❌ Using overflow-y-auto
```tsx
// Don't do this
<div className="flex-1 overflow-y-auto">
  {content}
</div>
```

### ✅ Use ScrollArea
```tsx
// Do this instead
<ScrollArea className="flex-1">
  {content}
</ScrollArea>
```

### ❌ Forgetting min-h-0
```tsx
// Won't scroll properly
<div className="flex-1 flex">
  <ScrollArea className="flex-1">...</ScrollArea>
</div>
```

### ✅ Include min-h-0
```tsx
// Scrolls correctly
<div className="flex-1 flex min-h-0">
  <ScrollArea className="flex-1">...</ScrollArea>
</div>
```

### ❌ Using h-full instead of flex-1
```tsx
// Doesn't adapt to container
<div className="h-full">...</div>
```

### ✅ Use flex-1
```tsx
// Grows to fill space
<div className="flex-1">...</div>
```

## Testing Checklist

When implementing a new page:

- [ ] Header is fixed (doesn't scroll)
- [ ] Content area takes remaining height
- [ ] Each scrollable section uses `<ScrollArea>`
- [ ] Nested flex containers have `min-h-0`
- [ ] Fixed-width sidebars have `flex-shrink-0`
- [ ] Page doesn't have double scrollbars
- [ ] Scrolling is smooth on all browsers
- [ ] Mobile/touch scrolling works properly

## Browser Compatibility

This structure works across all modern browsers:
- ✅ Chrome/Edge (Blink)
- ✅ Firefox
- ✅ Safari (WebKit)
- ✅ Mobile browsers

## References

- [Shadcn ScrollArea Documentation](https://ui.shadcn.com/docs/components/scroll-area)
- [CSS Flexbox Guide](https://css-tricks.com/snippets/css/a-guide-to-flexbox/)
- [Understanding min-height in Flexbox](https://stackoverflow.com/questions/36247140/why-dont-flex-items-shrink-past-content-size)

## Summary

**Standard Pattern**:
```tsx
<div className="h-screen flex flex-col">           // Full height
  <div className="flex-shrink-0">Header</div>     // Fixed header
  <div className="flex-1 flex min-h-0">           // Content fills rest
    <ScrollArea className="flex-1">              // Scrollable areas
      Content
    </ScrollArea>
  </div>
</div>
```

**Key Classes**:
- `h-screen` - Full viewport
- `flex-shrink-0` - Fixed elements
- `flex-1` - Grow to fill
- `min-h-0` - Enable scroll in nested flex
- `<ScrollArea>` - Custom scrolling

Follow this pattern for all dashboard pages! 🎯

