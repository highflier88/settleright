'use client';

import { useState, useEffect } from 'react';

import { format } from 'date-fns';
import { StickyNote, Plus, Trash2, Save, Edit, Clock, AlertCircle } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

interface NotesPanelProps {
  caseId: string;
}

const NOTE_CATEGORIES = [
  { value: 'evidence', label: 'Evidence', color: 'bg-blue-500' },
  { value: 'credibility', label: 'Credibility', color: 'bg-amber-500' },
  { value: 'legal', label: 'Legal Issue', color: 'bg-purple-500' },
  { value: 'damages', label: 'Damages', color: 'bg-green-500' },
  { value: 'question', label: 'Question', color: 'bg-red-500' },
  { value: 'general', label: 'General', color: 'bg-gray-500' },
];

function getCategoryColor(category: string): string {
  const cat = NOTE_CATEGORIES.find((c) => c.value === category);
  return cat?.color || 'bg-gray-500';
}

function getCategoryLabel(category: string): string {
  const cat = NOTE_CATEGORIES.find((c) => c.value === category);
  return cat?.label || category;
}

function generateId(): string {
  return `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function NotesPanel({ caseId }: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');

  // Load notes from localStorage
  useEffect(() => {
    const storageKey = `arbitrator-notes-${caseId}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        setNotes(JSON.parse(stored) as Note[]);
      } catch {
        // Invalid JSON, start fresh
      }
    }
  }, [caseId]);

  // Save notes to localStorage
  const saveNotes = (updatedNotes: Note[]) => {
    const storageKey = `arbitrator-notes-${caseId}`;
    localStorage.setItem(storageKey, JSON.stringify(updatedNotes));
    setNotes(updatedNotes);
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setCategory('general');
    setIsAdding(false);
    setEditingNote(null);
  };

  const handleSaveNote = () => {
    if (!title.trim() || !content.trim()) return;

    const now = new Date().toISOString();

    if (editingNote) {
      // Update existing note
      const updatedNotes = notes.map((note) =>
        note.id === editingNote.id ? { ...note, title, content, category, updatedAt: now } : note
      );
      saveNotes(updatedNotes);
    } else {
      // Add new note
      const newNote: Note = {
        id: generateId(),
        title,
        content,
        category,
        createdAt: now,
        updatedAt: now,
      };
      saveNotes([newNote, ...notes]);
    }

    resetForm();
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setTitle(note.title);
    setContent(note.content);
    setCategory(note.category);
    setIsAdding(true);
  };

  const handleDeleteNote = (noteId: string) => {
    const updatedNotes = notes.filter((note) => note.id !== noteId);
    saveNotes(updatedNotes);
  };

  const filteredNotes =
    filterCategory === 'all' ? notes : notes.filter((note) => note.category === filterCategory);

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <StickyNote className="h-5 w-5" />
                Review Notes
              </CardTitle>
              <CardDescription>Private notes for this case review</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {NOTE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isAdding && (
                <Button onClick={() => setIsAdding(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Note
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Add/Edit Note Form */}
      {isAdding && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{editingNote ? 'Edit Note' : 'New Note'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="note-title">Title</Label>
                <Input
                  id="note-title"
                  placeholder="Note title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note-category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note-content">Content</Label>
              <Textarea
                id="note-content"
                placeholder="Write your note here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button onClick={handleSaveNote} disabled={!title.trim() || !content.trim()}>
                <Save className="mr-2 h-4 w-4" />
                {editingNote ? 'Update Note' : 'Save Note'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes List */}
      <Card>
        <CardContent className="pt-4">
          {filteredNotes.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
              <StickyNote className="mb-4 h-12 w-12 opacity-50" />
              <p>{notes.length === 0 ? 'No notes yet' : 'No notes in this category'}</p>
              <p className="mt-2 text-sm">
                Click &quot;Add Note&quot; to create your first note for this case
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-3">
                {filteredNotes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-lg border p-4 transition-shadow hover:shadow-md"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-2 w-2 rounded-full ${getCategoryColor(note.category)}`}
                        />
                        <h3 className="font-medium">{note.title}</h3>
                        <Badge variant="outline" className="text-xs">
                          {getCategoryLabel(note.category)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEditNote(note)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Note?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. The note will be permanently deleted.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteNote(note.id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <p className="mb-2 whitespace-pre-wrap text-sm">{note.content}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Created: {format(new Date(note.createdAt), 'MMM d, yyyy h:mm a')}
                      </div>
                      {note.updatedAt !== note.createdAt && (
                        <div className="flex items-center gap-1">
                          <Edit className="h-3 w-3" />
                          Updated: {format(new Date(note.updatedAt), 'MMM d, yyyy h:mm a')}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Info Banner */}
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
        <CardContent className="flex items-start gap-3 pt-4">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
          <div className="text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Notes are stored locally
            </p>
            <p className="mt-1 text-amber-700 dark:text-amber-300">
              These notes are stored in your browser and are only visible to you. They will persist
              across sessions but will be lost if you clear your browser data.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
