import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Types for Tiptap JSON content
interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
}

interface ExtractedTodo {
  text: string;
  isCompleted: boolean;
  order: number;
  nodeId: string;
}

// Helper to extract text content from a Tiptap node
function getTextContent(node: TiptapNode): string {
  if (node.text) {
    return node.text;
  }
  if (node.content) {
    return node.content.map(getTextContent).join("");
  }
  return "";
}

// Helper to generate a unique ID for nodes without one
function generateNodeId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// Extract all todo items from Tiptap JSON content
function extractTodos(json: TiptapNode): ExtractedTodo[] {
  const todos: ExtractedTodo[] = [];
  let order = 0;

  function traverse(node: TiptapNode) {
    if (node.type === "taskItem") {
      todos.push({
        text: getTextContent(node),
        isCompleted: (node.attrs?.checked as boolean) ?? false,
        order: order++,
        nodeId: (node.attrs?.id as string) ?? generateNodeId(),
      });
    }
    if (node.content) {
      node.content.forEach(traverse);
    }
  }

  traverse(json);
  return todos;
}

// List all documents with their todo counts
export const listDocuments = query({
  args: {},
  handler: async (ctx) => {
    const documents = await ctx.db
      .query("todoDocuments")
      .withIndex("by_updated")
      .order("desc")
      .collect();
    return documents;
  },
});

// Get a single document by ID
export const getDocument = query({
  args: { id: v.id("todoDocuments") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create a new document
export const createDocument = mutation({
  args: {
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const emptyContent = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [],
        },
      ],
    });

    const id = await ctx.db.insert("todoDocuments", {
      title: args.title,
      content: emptyContent,
      todoCount: 0,
      completedCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

// Update document title only
export const updateDocumentTitle = mutation({
  args: {
    id: v.id("todoDocuments"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});

// Update document project assignment
export const updateDocumentProject = mutation({
  args: {
    id: v.id("todoDocuments"),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Update the document
    await ctx.db.patch(args.id, {
      projectId: args.projectId,
      updatedAt: now,
    });

    // Update all associated todo items to have the same projectId
    const todoItems = await ctx.db
      .query("todoItems")
      .withIndex("by_document", (q) => q.eq("documentId", args.id))
      .collect();

    for (const item of todoItems) {
      await ctx.db.patch(item._id, {
        projectId: args.projectId,
        updatedAt: now,
      });
    }
  },
});

// Delete a document and all its todo items
export const deleteDocument = mutation({
  args: { id: v.id("todoDocuments") },
  handler: async (ctx, args) => {
    // Delete all associated todo items
    const todoItems = await ctx.db
      .query("todoItems")
      .withIndex("by_document", (q) => q.eq("documentId", args.id))
      .collect();

    for (const item of todoItems) {
      await ctx.db.delete(item._id);
    }

    // Delete the document
    await ctx.db.delete(args.id);
  },
});

// Save document content and sync todo items
export const saveDocumentContent = mutation({
  args: {
    id: v.id("todoDocuments"),
    content: v.string(), // Tiptap JSON stringified
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get the document to check its projectId
    const document = await ctx.db.get(args.id);
    if (!document) {
      throw new Error("Document not found");
    }

    // Parse the content to extract todos
    let parsedContent: TiptapNode;
    try {
      parsedContent = JSON.parse(args.content);
    } catch {
      throw new Error("Invalid JSON content");
    }

    const extractedTodos = extractTodos(parsedContent);

    // Get existing todo items for this document
    const existingItems = await ctx.db
      .query("todoItems")
      .withIndex("by_document", (q) => q.eq("documentId", args.id))
      .collect();

    // Create a map of existing items by nodeId for quick lookup
    const existingByNodeId = new Map(
      existingItems.map((item) => [item.nodeId, item])
    );

    // Track which nodeIds are still present
    const presentNodeIds = new Set<string>();

    // Process extracted todos
    for (const todo of extractedTodos) {
      presentNodeIds.add(todo.nodeId);
      const existing = existingByNodeId.get(todo.nodeId);

      if (existing) {
        // Check if anything changed
        const textChanged = existing.text !== todo.text;
        const completedChanged = existing.isCompleted !== todo.isCompleted;
        const orderChanged = existing.order !== todo.order;

        if (textChanged || completedChanged || orderChanged) {
          const updates: {
            text?: string;
            isCompleted?: boolean;
            order?: number;
            updatedAt: number;
            completedAt?: number;
          } = {
            updatedAt: now,
          };

          if (textChanged) {
            updates.text = todo.text;
          }

          if (orderChanged) {
            updates.order = todo.order;
          }

          if (completedChanged) {
            updates.isCompleted = todo.isCompleted;
            // Track when item was completed/uncompleted
            if (todo.isCompleted && !existing.isCompleted) {
              updates.completedAt = now;
            } else if (!todo.isCompleted && existing.isCompleted) {
              updates.completedAt = undefined;
            }
          }

          await ctx.db.patch(existing._id, updates);
        }
      } else {
        // Create new todo item - inherit projectId from document
        await ctx.db.insert("todoItems", {
          documentId: args.id,
          projectId: document.projectId,
          text: todo.text,
          isCompleted: todo.isCompleted,
          order: todo.order,
          nodeId: todo.nodeId,
          createdAt: now,
          updatedAt: now,
          completedAt: todo.isCompleted ? now : undefined,
        });
      }
    }

    // Delete todo items that are no longer in the document
    for (const existing of existingItems) {
      if (!presentNodeIds.has(existing.nodeId)) {
        await ctx.db.delete(existing._id);
      }
    }

    // Update document with content and denormalized counts
    const todoCount = extractedTodos.length;
    const completedCount = extractedTodos.filter((t) => t.isCompleted).length;

    await ctx.db.patch(args.id, {
      content: args.content,
      todoCount,
      completedCount,
      updatedAt: now,
    });

    return { todoCount, completedCount };
  },
});
