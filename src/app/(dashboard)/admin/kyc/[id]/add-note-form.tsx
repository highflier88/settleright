'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface AddNoteFormProps {
  verificationId: string;
}

export function AddNoteForm({ verificationId }: AddNoteFormProps) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!note.trim()) {
      toast.error('Please enter a note');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/admin/kyc/${verificationId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: { message?: string } };
        throw new Error(data.error?.message ?? 'Failed to add note');
      }

      toast.success('Note added successfully');
      setNote('');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Textarea
        placeholder="Add a note about this verification..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
      />
      <Button type="submit" disabled={isLoading || !note.trim()}>
        {isLoading ? 'Adding...' : 'Add Note'}
      </Button>
    </form>
  );
}
