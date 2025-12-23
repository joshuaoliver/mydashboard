import { useState, useRef, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PromptInputButton } from "@/components/ai-elements/prompt-input";
import { Paperclip, X, FileIcon, ImageIcon, Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";

interface AttachmentButtonProps {
  threadId: string | null;
  onAttachmentReady?: (attachment: AttachmentInfo) => void;
  onAttachmentRemove?: () => void;
  disabled?: boolean;
}

export interface AttachmentInfo {
  storageId: string;
  mimeType: string;
  fileName: string;
  previewUrl?: string;
}

export function AttachmentButton({
  threadId,
  onAttachmentReady,
  onAttachmentRemove,
  disabled,
}: AttachmentButtonProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [attachment, setAttachment] = useState<AttachmentInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.chat.generateAttachmentUploadUrl);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !threadId) return;

      setIsUploading(true);

      try {
        // Get upload URL
        const uploadUrl = await generateUploadUrl();

        // Upload file
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        const { storageId } = await response.json();

        // Create preview URL for images
        let previewUrl: string | undefined;
        if (file.type.startsWith("image/")) {
          previewUrl = URL.createObjectURL(file);
        }

        const attachmentInfo: AttachmentInfo = {
          storageId,
          mimeType: file.type,
          fileName: file.name,
          previewUrl,
        };

        setAttachment(attachmentInfo);
        onAttachmentReady?.(attachmentInfo);
      } catch (error) {
        console.error("Failed to upload attachment:", error);
      } finally {
        setIsUploading(false);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [threadId, generateUploadUrl, onAttachmentReady]
  );

  const handleRemove = useCallback(() => {
    if (attachment?.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
    setAttachment(null);
    onAttachmentRemove?.();
  }, [attachment, onAttachmentRemove]);

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  if (!threadId) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf,.doc,.docx,.txt,.md"
        onChange={handleFileSelect}
      />

      {/* Attachment preview */}
      {attachment && (
        <div className="flex items-center gap-2 px-2 py-1 bg-muted rounded-md text-sm">
          {attachment.mimeType.startsWith("image/") ? (
            attachment.previewUrl ? (
              <img
                src={attachment.previewUrl}
                alt={attachment.fileName}
                className="h-6 w-6 rounded object-cover"
              />
            ) : (
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            )
          ) : (
            <FileIcon className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="max-w-[100px] truncate text-xs">
            {attachment.fileName}
          </span>
          <button
            onClick={handleRemove}
            className="p-0.5 hover:bg-muted-foreground/20 rounded"
            title="Remove attachment"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Attach button */}
      <PromptInputButton
        onClick={openFileDialog}
        disabled={disabled || isUploading || !!attachment}
        className={cn(isUploading && "opacity-50")}
        title="Attach file"
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Paperclip className="h-4 w-4" />
        )}
      </PromptInputButton>
    </div>
  );
}
