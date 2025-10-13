# DOM Structure Audit - Messages Page

## Complete DOM Hierarchy

```
html
└── body
    └── <Outlet /> (TanStack Router)
        └── <DashboardLayout>
            ├── <header> (flex-shrink-0) ✓
            │   └── Navigation
            └── <main> (flex-1, overflow-hidden) ✓
                └── <FullWidthContent> (h-full, flex, overflow-hidden) ✓
                    ├── <Sidebar> (h-full, flex flex-col) ✓
                    │   ├── header (flex-shrink-0) ✓
                    │   └── <ScrollArea> (flex-1) ✓
                    │       └── Chat list items
                    │
                    └── Main content (flex-1, flex, overflow-hidden) ✓
                        ├── Chat messages div (flex-1, flex flex-col) ⚠️ NEEDS overflow-hidden
                        │   ├── <ChatDetail> 
                        │   │   └── div (h-full) ⚠️ WRONG - should be flex-1
                        │   │       └── <ScrollArea> (flex-1) ✓
                        │   │           └── Messages
                        │   └── Input area (flex-shrink-0) ✓
                        │
                        └── Right sidebar (w-[500px], flex flex-col) ⚠️ NEEDS overflow-hidden
                            ├── Chat info (flex-shrink-0) ✓
                            └── <ScrollArea> (flex-1) ✓
                                └── AI suggestions
```

## Issues Found

### Issue 1: Chat Messages Container
**Location:** `src/routes/messages.tsx` line 303
**Current:** `flex-1 bg-white border-r border-gray-200 flex flex-col`
**Problem:** Missing `overflow-hidden`
**Fix:** Add `overflow-hidden`

### Issue 2: ChatDetail Wrapper
**Location:** `src/components/messages/ChatDetail.tsx` line 52
**Current:** `flex flex-col h-full`
**Problem:** `h-full` doesn't work in flex-col parent, causes it to expand beyond viewport
**Fix:** Change to `flex-1` instead of `h-full`

### Issue 3: Right Sidebar
**Location:** `src/routes/messages.tsx` line 343
**Current:** `w-[500px] bg-white flex flex-col`
**Problem:** Missing `overflow-hidden`
**Fix:** Add `overflow-hidden`

## Why This Matters

Without proper overflow constraints:
- Children expand to their full content height (2000px+)
- ScrollAreas don't activate because parent isn't constrained
- Everything flows off the page instead of scrolling

With proper constraints:
- Each flex-1 fills available space
- ScrollAreas activate when content exceeds container
- Everything stays within viewport

