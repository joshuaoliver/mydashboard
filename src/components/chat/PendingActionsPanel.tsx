import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  X,
  MessageSquare,
  ListTodo,
  Bell,
  FileText,
  Calendar,
  MoreHorizontal,
  Clock,
} from "lucide-react";
import { cn, formatDistanceToNow } from "~/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

// Type assertion for API references not yet in generated types
// Run `npx convex dev` to regenerate types after adding new files
const agentChatApi = (api as any).agentChat;

interface PendingAction {
  _id: string;
  threadId?: string;
  type: string;
  title: string;
  description: string;
  status: "pending" | "approved" | "rejected" | "executed";
  data?: Record<string, unknown>;
  createdAt: number;
}

interface PendingActionsPanelProps {
  threadId: string | null;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  message_contact: <MessageSquare className="h-4 w-4" />,
  create_todo: <ListTodo className="h-4 w-4" />,
  create_reminder: <Bell className="h-4 w-4" />,
  add_to_note: <FileText className="h-4 w-4" />,
  schedule_task: <Calendar className="h-4 w-4" />,
  other: <MoreHorizontal className="h-4 w-4" />,
};

const ACTION_LABELS: Record<string, string> = {
  message_contact: "Message",
  create_todo: "Todo",
  create_reminder: "Reminder",
  add_to_note: "Note",
  schedule_task: "Schedule",
  other: "Action",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  approved: "bg-green-500/10 text-green-600 border-green-500/20",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20",
  executed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
};

export function PendingActionsPanel({ threadId }: PendingActionsPanelProps) {
  const actions = useQuery(
    agentChatApi.listPendingActionsForThread,
    threadId ? { threadId } : "skip"
  );

  const approveAction = useMutation(agentChatApi.approvePendingAction);
  const rejectAction = useMutation(agentChatApi.rejectPendingAction);

  const handleApprove = async (actionId: Id<"agentPendingActions">) => {
    try {
      await approveAction({ actionId });
    } catch (error) {
      console.error("Failed to approve action:", error);
    }
  };

  const handleReject = async (actionId: Id<"agentPendingActions">) => {
    try {
      await rejectAction({ actionId });
    } catch (error) {
      console.error("Failed to reject action:", error);
    }
  };

  if (!threadId) {
    return (
      <div className="flex flex-col h-full border-l">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg">Pending Actions</h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Select a conversation to see pending actions
        </div>
      </div>
    );
  }

  const pendingActions = actions?.filter((a: PendingAction) => a.status === "pending") || [];
  const completedActions =
    actions?.filter((a: PendingAction) => a.status !== "pending").slice(0, 10) || [];

  return (
    <div className="flex flex-col h-full border-l">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Pending Actions</h2>
          {pendingActions.length > 0 && (
            <Badge variant="secondary" className="font-mono">
              {pendingActions.length}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Review and approve actions before they execute
        </p>
      </div>

      {/* Actions List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Pending Actions */}
          {pendingActions.length === 0 && completedActions.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No pending actions
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Actions created by the AI will appear here for your approval
              </p>
            </div>
          ) : (
            <>
              {/* Pending Section */}
              {pendingActions.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Awaiting Approval
                  </h3>
                  {pendingActions.map((action: PendingAction) => (
                    <ActionCard
                      key={action._id}
                      action={action as any}
                      onApprove={() => handleApprove(action._id as any)}
                      onReject={() => handleReject(action._id as any)}
                    />
                  ))}
                </div>
              )}

              {/* Completed Section */}
              {completedActions.length > 0 && (
                <div className="space-y-3 mt-6">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Recent Actions
                  </h3>
                  {completedActions.map((action: PendingAction) => (
                    <ActionCard key={action._id} action={action as any} readonly />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface ActionCardProps {
  action: {
    _id: Id<"agentPendingActions">;
    actionType: string;
    title: string;
    description?: string;
    status: string;
    createdAt: number;
    actionData?: any;
  };
  onApprove?: () => void;
  onReject?: () => void;
  readonly?: boolean;
}

function ActionCard({ action, onApprove, onReject, readonly }: ActionCardProps) {
  const isPending = action.status === "pending";

  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2",
        isPending ? "bg-card" : "bg-muted/30"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "p-1.5 rounded",
              isPending ? "bg-primary/10 text-primary" : "bg-muted"
            )}
          >
            {ACTION_ICONS[action.actionType] || ACTION_ICONS.other}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{action.title}</p>
            <p className="text-xs text-muted-foreground">
              {ACTION_LABELS[action.actionType]} •{" "}
              {formatDistanceToNow(action.createdAt)}
            </p>
          </div>
        </div>
        {!isPending && (
          <Badge
            variant="outline"
            className={cn("text-xs capitalize", STATUS_STYLES[action.status])}
          >
            {action.status}
          </Badge>
        )}
      </div>

      {/* Description */}
      {action.description && (
        <p className="text-sm text-muted-foreground pl-9">{action.description}</p>
      )}

      {/* Action Data Preview */}
      {action.actionData && isPending && (
        <div className="pl-9">
          <details className="text-xs">
            <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
              View details
            </summary>
            <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
              {JSON.stringify(action.actionData, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {/* Action Buttons */}
      {isPending && !readonly && (
        <div className="flex items-center gap-2 pl-9 pt-1">
          <Button
            size="sm"
            variant="default"
            onClick={onApprove}
            className="h-7 text-xs"
          >
            <Check className="h-3 w-3 mr-1" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onReject}
            className="h-7 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}
