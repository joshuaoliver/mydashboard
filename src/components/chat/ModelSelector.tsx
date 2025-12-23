import { useQuery } from "convex/react";
import { api } from "~/convex/_generated/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bot } from "lucide-react";
import { cn } from "~/lib/utils";
import { useMemo } from "react";

interface ModelSelectorProps {
  value?: string;
  onChange: (modelId: string) => void;
  className?: string;
  disabled?: boolean;
}

type Model = { id: string; name: string; provider: string; description: string };

export function ModelSelector({
  value,
  onChange,
  className,
  disabled,
}: ModelSelectorProps) {
  const models = useQuery(api.aiSettings.getAvailableModels);

  // Group models by provider
  const grouped = useMemo(() => {
    if (!models) return {} as Record<string, Model[]>;
    return models.reduce<Record<string, Model[]>>(
      (acc, model) => {
        if (!acc[model.provider]) acc[model.provider] = [];
        acc[model.provider].push(model);
        return acc;
      },
      {}
    );
  }, [models]);

  // Get the currently selected model's display name
  const selectedModel = models?.find((m: Model) => m.id === value);

  // Provider icons/colors for visual distinction
  const providerStyles: Record<string, string> = {
    Google: "text-blue-500",
    Anthropic: "text-orange-500",
    OpenAI: "text-green-500",
    DeepSeek: "text-purple-500",
    xAI: "text-gray-500",
    Meta: "text-blue-600",
    Mistral: "text-yellow-500",
  };

  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled || !models}
    >
      <SelectTrigger
        size="sm"
        className={cn("w-[180px] h-8 text-xs gap-1.5", className)}
      >
        <Bot className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <SelectValue placeholder="Select model">
          {selectedModel ? (
            <span className="truncate">{selectedModel.name}</span>
          ) : (
            <span className="text-muted-foreground">Select model</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="start" className="max-h-[300px]">
        {Object.entries(grouped).map(([provider, providerModels]) => (
          <div key={provider}>
            {/* Provider header */}
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1.5 sticky top-0 bg-popover">
              <span className={cn("text-xs", providerStyles[provider])}>●</span>
              {provider}
            </div>
            {/* Models in this provider */}
            {providerModels.map((model) => (
              <SelectItem
                key={model.id}
                value={model.id}
                className="pl-4"
              >
                <div className="flex flex-col py-0.5">
                  <span className="text-sm">{model.name}</span>
                  <span className="text-xs text-muted-foreground line-clamp-1">
                    {model.description}
                  </span>
                </div>
              </SelectItem>
            ))}
          </div>
        ))}
      </SelectContent>
    </Select>
  );
}
