import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Helper to extract hashtags from text
function extractHashtags(text: string): string[] {
  const hashtagRegex = /#(\w+)/g;
  const matches = text.match(hashtagRegex);
  return matches ? matches.map(tag => tag.toLowerCase()) : [];
}

// Get all todos for a specific document
export const listByDocument = query({
  args: { documentId: v.id("todoDocuments") },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("todoItems")
      .withIndex("by_document_order", (q) => q.eq("documentId", args.documentId))
      .collect();
    return items;
  },
});

// Get all incomplete todos across all documents
export const listAllPending = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db
      .query("todoItems")
      .withIndex("by_completed", (q) => q.eq("isCompleted", false))
      .collect();

    // Get document titles for context
    const documentIds = [...new Set(items.map((item) => item.documentId))];
    const documents = await Promise.all(
      documentIds.map((id) => ctx.db.get(id))
    );
    const documentMap = new Map(
      documents
        .filter((d) => d !== null)
        .map((d) => [d._id, d.title])
    );

    return items.map((item) => ({
      ...item,
      documentTitle: documentMap.get(item.documentId) ?? "Unknown",
    }));
  },
});

// Get recently completed todos (last 7 days)
export const listRecentlyCompleted = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const items = await ctx.db
      .query("todoItems")
      .withIndex("by_completed", (q) => q.eq("isCompleted", true))
      .filter((q) =>
        q.and(
          q.neq(q.field("completedAt"), undefined),
          q.gte(q.field("completedAt"), sevenDaysAgo)
        )
      )
      .take(limit);

    // Get document titles for context
    const documentIds = [...new Set(items.map((item) => item.documentId))];
    const documents = await Promise.all(
      documentIds.map((id) => ctx.db.get(id))
    );
    const documentMap = new Map(
      documents
        .filter((d) => d !== null)
        .map((d) => [d._id, d.title])
    );

    return items.map((item) => ({
      ...item,
      documentTitle: documentMap.get(item.documentId) ?? "Unknown",
    }));
  },
});

// Get summary stats for dashboard
export const getSummaryStats = query({
  args: {},
  handler: async (ctx) => {
    const allItems = await ctx.db.query("todoItems").collect();

    const total = allItems.length;
    const completed = allItems.filter((item) => item.isCompleted).length;
    const pending = total - completed;

    // Get completion stats for today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTimestamp = todayStart.getTime();

    const completedToday = allItems.filter(
      (item) => item.completedAt && item.completedAt >= todayTimestamp
    ).length;

    return {
      total,
      completed,
      pending,
      completedToday,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  },
});

// Get completed todos history (permanent records)
export const listCompletedHistory = query({
  args: {
    limit: v.optional(v.number()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    let items;
    if (args.projectId) {
      items = await ctx.db
        .query("completedTodos")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .order("desc")
        .take(limit);
    } else {
      items = await ctx.db
        .query("completedTodos")
        .withIndex("by_completed")
        .order("desc")
        .take(limit);
    }

    return items;
  },
});

// Get completed todos stats by date range
export const getCompletedStats = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const endDate = args.endDate ?? now;
    const startDate = args.startDate ?? (now - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days

    const items = await ctx.db
      .query("completedTodos")
      .withIndex("by_completed")
      .filter((q) =>
        q.and(
          q.gte(q.field("completedAt"), startDate),
          q.lte(q.field("completedAt"), endDate)
        )
      )
      .collect();

    // Group by date
    const byDate = new Map<string, number>();
    items.forEach((item) => {
      const date = new Date(item.completedAt).toISOString().split("T")[0];
      byDate.set(date, (byDate.get(date) || 0) + 1);
    });

    // Group by project
    const byProject = new Map<string, { count: number; name: string }>();
    items.forEach((item) => {
      const projectKey = item.projectId ?? "none";
      const projectName = item.projectName ?? "No project";
      const existing = byProject.get(projectKey);
      if (existing) {
        existing.count++;
      } else {
        byProject.set(projectKey, { count: 1, name: projectName });
      }
    });

    return {
      total: items.length,
      byDate: Array.from(byDate.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      byProject: Array.from(byProject.entries())
        .map(([projectId, { count, name }]) => ({ projectId, projectName: name, count }))
        .sort((a, b) => b.count - a.count),
    };
  },
});

// Get all todos with enriched data (project names, hashtags, document info)
export const listAllTodos = query({
  args: {
    projectId: v.optional(v.union(v.id("projects"), v.literal("none"))),
    showCompleted: v.optional(v.boolean()),
    hashtag: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let items;
    
    // Filter by project if specified
    if (args.projectId === "none") {
      // Get todos without a project
      items = await ctx.db
        .query("todoItems")
        .filter((q) => q.eq(q.field("projectId"), undefined))
        .collect();
    } else if (args.projectId) {
      // At this point, projectId is definitely an Id<"projects"> (not "none" or undefined)
      const projectId = args.projectId;
      items = await ctx.db
        .query("todoItems")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect();
    } else {
      items = await ctx.db.query("todoItems").collect();
    }

    // Filter by completion status
    if (args.showCompleted === false) {
      items = items.filter((item) => !item.isCompleted);
    } else if (args.showCompleted === true) {
      items = items.filter((item) => item.isCompleted);
    }

    // Filter by hashtag if specified
    if (args.hashtag) {
      const searchTag = args.hashtag.toLowerCase();
      items = items.filter((item) => {
        const hashtags = extractHashtags(item.text);
        return hashtags.includes(searchTag) || hashtags.includes(`#${searchTag}`);
      });
    }

    // Get document info
    const documentIds = [...new Set(items.map((item) => item.documentId))];
    const documents = await Promise.all(
      documentIds.map((id) => ctx.db.get(id))
    );
    const documentMap = new Map(
      documents
        .filter((d) => d !== null)
        .map((d) => [d._id, { title: d.title, projectId: d.projectId }])
    );

    // Get project info
    const projectIds = [...new Set(items.map((item) => item.projectId).filter(Boolean))];
    const projects = await Promise.all(
      projectIds.map((id) => ctx.db.get(id!))
    );
    const projectMap = new Map(
      projects
        .filter((p) => p !== null)
        .map((p) => [p._id, p.name])
    );

    // Enrich items with additional data
    const enrichedItems = items.map((item) => {
      const docInfo = documentMap.get(item.documentId);
      return {
        ...item,
        documentTitle: docInfo?.title ?? "Unknown",
        projectName: item.projectId ? (projectMap.get(item.projectId) ?? null) : null,
        hashtags: extractHashtags(item.text),
      };
    });

    // Sort by: incomplete first, then by createdAt descending
    enrichedItems.sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) {
        return a.isCompleted ? 1 : -1;
      }
      return b.createdAt - a.createdAt;
    });

    return enrichedItems;
  },
});

// Get all unique hashtags across all todos
export const listAllHashtags = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("todoItems").collect();
    
    const hashtagCounts = new Map<string, number>();
    items.forEach((item) => {
      const hashtags = extractHashtags(item.text);
      hashtags.forEach((tag) => {
        hashtagCounts.set(tag, (hashtagCounts.get(tag) || 0) + 1);
      });
    });

    // Convert to array and sort by count
    return Array.from(hashtagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  },
});

// Toggle todo completion status
export const toggleTodoCompletion = mutation({
  args: {
    id: v.id("todoItems"),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new Error("Todo item not found");
    }

    const now = Date.now();
    const newIsCompleted = !item.isCompleted;

    // Update the todo item
    await ctx.db.patch(args.id, {
      isCompleted: newIsCompleted,
      updatedAt: now,
      completedAt: newIsCompleted ? now : undefined,
    });

    // Update the parent document's denormalized counts
    const document = await ctx.db.get(item.documentId);
    if (document) {
      const newCompletedCount = newIsCompleted 
        ? document.completedCount + 1 
        : document.completedCount - 1;
      
      await ctx.db.patch(item.documentId, {
        completedCount: Math.max(0, newCompletedCount),
        updatedAt: now,
      });

      // Also update the document content to reflect the change
      // Parse the content and update the taskItem's checked state
      try {
        const content = JSON.parse(document.content);
        updateTaskItemInContent(content, item.nodeId, newIsCompleted);
        await ctx.db.patch(item.documentId, {
          content: JSON.stringify(content),
        });
      } catch {
        // If we can't parse/update the content, just continue
        // The counts are still updated correctly
      }
    }

    // Create permanent record when completing a todo
    if (newIsCompleted) {
      // Get project name if there's a project
      let projectName: string | undefined;
      if (item.projectId) {
        const project = await ctx.db.get(item.projectId);
        projectName = project?.name;
      }

      await ctx.db.insert("completedTodos", {
        originalTodoId: args.id,
        originalDocumentId: item.documentId,
        originalNodeId: item.nodeId,
        text: item.text,
        projectId: item.projectId,
        projectName,
        documentTitle: document?.title,
        todoCreatedAt: item.createdAt,
        completedAt: now,
      });
    }

    return { isCompleted: newIsCompleted };
  },
});

// Update todo text and sync back to document
export const updateTodoText = mutation({
  args: {
    id: v.id("todoItems"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new Error("Todo item not found");
    }

    // Don't update if text hasn't changed
    if (item.text === args.text) {
      return { success: true };
    }

    const now = Date.now();

    // Update the todo item
    await ctx.db.patch(args.id, {
      text: args.text,
      updatedAt: now,
    });

    // Sync the change back to the document
    const document = await ctx.db.get(item.documentId);
    if (document) {
      try {
        const content = JSON.parse(document.content);
        const updated = updateTaskItemTextInContent(content, item.nodeId, args.text);
        if (updated) {
          await ctx.db.patch(item.documentId, {
            content: JSON.stringify(content),
            updatedAt: now,
          });
        } else {
          console.warn(`[updateTodoText] Failed to find taskItem ${item.nodeId} in document content`);
        }
      } catch {
        // If we can't parse/update the content, just continue
        // The todo item is still updated
      }
    }

    return { success: true };
  },
});

// Type for Tiptap node structure
interface TiptapNodeMutable {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNodeMutable[];
  text?: string;
}

// Helper to recursively update a taskItem's checked state in Tiptap content
function updateTaskItemInContent(
  node: TiptapNodeMutable,
  nodeId: string,
  checked: boolean
): boolean {
  if (node.type === "taskItem" && node.attrs?.id === nodeId) {
    node.attrs.checked = checked;
    return true;
  }
  
  if (node.content && Array.isArray(node.content)) {
    for (const child of node.content) {
      if (typeof child === 'object' && child !== null) {
        if (updateTaskItemInContent(child as TiptapNodeMutable, nodeId, checked)) {
          return true;
        }
      }
    }
  }
  
  return false;
}

// Helper to recursively update a taskItem's text content in Tiptap content
function updateTaskItemTextInContent(
  node: TiptapNodeMutable,
  nodeId: string,
  newText: string
): boolean {
  if (node.type === "taskItem" && node.attrs?.id === nodeId) {
    // Find the paragraph inside the taskItem and update its text
    if (node.content) {
      for (const child of node.content) {
        if (child.type === "paragraph") {
          // Replace the paragraph's content with a single text node
          child.content = [{ type: "text", text: newText }];
          return true;
        }
        // Recursively search nested content within the taskItem
        if (child.content && updateTaskItemTextInContent(child, nodeId, newText)) {
          return true;
        }
      }
    }
    // Only return false - we found the taskItem but couldn't update the text
    // This allows the caller to know the update failed
    return false;
  }
  
  if (node.content && Array.isArray(node.content)) {
    for (const child of node.content) {
      if (typeof child === 'object' && child !== null) {
        if (updateTaskItemTextInContent(child, nodeId, newText)) {
          return true;
        }
      }
    }
  }
  
  return false;
}

// Create a quick todo from a conversation
// Finds or creates the "Quick Tasks" document and adds the todo
export const createQuickTodo = mutation({
  args: {
    text: v.string(),
    // Contact attribution - stored in DB for tracking
    chatId: v.optional(v.string()),
    contactId: v.optional(v.id("contacts")),
    contactName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Find or create the "Quick Tasks" document
    let quickTasksDoc = await ctx.db
      .query("todoDocuments")
      .filter((q) => q.eq(q.field("title"), "Quick Tasks"))
      .first();

    if (!quickTasksDoc) {
      // Create the Quick Tasks document
      const emptyContent = JSON.stringify({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [],
          },
        ],
      });

      const docId = await ctx.db.insert("todoDocuments", {
        title: "Quick Tasks",
        content: emptyContent,
        todoCount: 0,
        completedCount: 0,
        createdAt: now,
        updatedAt: now,
      });

      quickTasksDoc = await ctx.db.get(docId);
    }

    if (!quickTasksDoc) {
      throw new Error("Failed to create Quick Tasks document");
    }

    // Get the max order for existing items in this document
    const existingItems = await ctx.db
      .query("todoItems")
      .withIndex("by_document", (q) => q.eq("documentId", quickTasksDoc!._id))
      .collect();

    const maxOrder = existingItems.reduce(
      (max, item) => Math.max(max, item.order),
      -1
    );

    // Create the todo item
    const todoId = await ctx.db.insert("todoItems", {
      documentId: quickTasksDoc._id,
      text: args.text,
      isCompleted: false,
      order: maxOrder + 1,
      nodeId: `quick-${now}`,
      createdAt: now,
      updatedAt: now,
      // Source tracking from conversation
      sourceChatId: args.chatId,
      sourceContactId: args.contactId,
      sourceContactName: args.contactName,
    });

    // Update the document's todo count
    await ctx.db.patch(quickTasksDoc._id, {
      todoCount: quickTasksDoc.todoCount + 1,
      updatedAt: now,
    });

    return { todoId, documentId: quickTasksDoc._id };
  },
});
