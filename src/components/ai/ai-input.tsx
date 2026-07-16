'use client';

import { useTranslations } from 'next-intl';
import { SendHorizonal } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { FormEvent, ChangeEvent } from 'react';

interface AIInputProps {
  input: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  models: string[];
  selectedModel?: string;
  onModelChange: (model: string) => void;
}

export function AIInput({ input, onChange, onSubmit, isLoading, models, selectedModel, onModelChange }: AIInputProps) {
  const t = useTranslations('ai');

  return (
    <form onSubmit={onSubmit} className="border-t border-border bg-card p-3">
      <div className="rounded-2xl border border-border bg-muted/30 transition-colors focus-within:border-ring focus-within:bg-background">
        {/* Textarea */}
        <textarea
          value={input}
          onChange={onChange}
          placeholder={t('placeholder')}
          rows={2}
          className="w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              const form = e.currentTarget.closest('form');
              if (form) form.requestSubmit();
            }
          }}
        />

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between px-3 pb-2.5">
          {/* Model selector */}
          <div>
            <Select value={selectedModel} onValueChange={onModelChange}>
              <SelectTrigger className="h-7 max-w-[180px] gap-1 rounded-full border-border bg-background px-2.5 text-[11px] font-medium text-foreground shadow-none">
                <span className="mr-0.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent>
                {models.map((id) => (
                  <SelectItem key={id} value={id} className="text-xs">
                    {id}
                  </SelectItem>
                ))}
                {models.length === 0 && selectedModel && (
                  <SelectItem value={selectedModel} className="text-xs">
                    {selectedModel}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Send button */}
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 [&:not(:disabled)]:bg-brand [&:not(:disabled)]:text-brand-foreground [&:not(:disabled)]:hover:bg-brand-hover"
          >
            <SendHorizonal className="h-4 w-4" />
          </button>
        </div>
      </div>
    </form>
  );
}
