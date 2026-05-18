'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface RenameTitleDialogProps {
  open: boolean;
  title: string;
  onOpenChange: (open: boolean) => void;
  onSave: (title: string) => void;
}

export function RenameTitleDialog({ open, title, onOpenChange, onSave }: RenameTitleDialogProps) {
  const t = useTranslations('common');
  const [value, setValue] = useState(title);
  const [lastOpen, setLastOpen] = useState(open);
  const [lastTitle, setLastTitle] = useState(title);

  if ((open && !lastOpen) || title !== lastTitle) {
    setValue(title);
    setLastTitle(title);
  }
  if (open !== lastOpen) {
    setLastOpen(open);
  }

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const next = value.trim();
    if (!next) return;
    onSave(next);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('rename')}</DialogTitle>
          </DialogHeader>
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer">
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={!value.trim()} className="cursor-pointer bg-brand hover:bg-brand-hover">
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
