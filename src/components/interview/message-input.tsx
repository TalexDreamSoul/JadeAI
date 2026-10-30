'use client';

import { useTranslations } from 'next-intl';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface MessageInputProps {
  input: string;
  isLoading: boolean;
  disabled?: boolean;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export function MessageInput({ input, isLoading, disabled = false, onChange, onSubmit }: MessageInputProps) {
  const t = useTranslations('interview.room');
  const isDisabled = isLoading || disabled;

  return (
    <form onSubmit={onSubmit} className="flex items-end gap-2">
      <div className="relative flex-1">
        <Textarea
          value={input}
          onChange={onChange}
          placeholder={disabled ? t('pausedInputPlaceholder') : t('inputPlaceholder')}
          disabled={isDisabled}
          className="min-h-[44px] resize-none rounded-xl pr-12"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <Button
          type="submit"
          disabled={!input.trim() || isDisabled}
          size="icon"
          className="absolute bottom-1.5 right-1.5 h-8 w-8 rounded-lg bg-brand hover:bg-brand-hover"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
