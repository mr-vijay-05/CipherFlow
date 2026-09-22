import React from 'react';
import { NoteEditor } from '../components/notes/NoteEditor';

export const NewNotePage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          Create Encrypted Note
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Notes are protected locally before storage.
        </p>
      </div>

      <NoteEditor isNew={true} />
    </div>
  );
};
