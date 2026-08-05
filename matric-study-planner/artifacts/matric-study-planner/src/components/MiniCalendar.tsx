import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Calendar } from 'lucide-react';
import { format, parseISO, isFuture, isToday } from 'date-fns';
import { useAppContext } from '@/context/AppContext';
import type { StudyEvent } from '@/context/AppContext';

const TYPE_STYLES: Record<StudyEvent['type'], { bg: string; text: string; label: string }> = {
  test:     { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Test' },
  revision: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Revision' },
  free:     { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Free Day' },
  custom:   { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Custom' },
};

export function MiniCalendar() {
  const { events, addEvent, removeEvent, currentMode } = useAppContext();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState<StudyEvent['type']>('custom');

  const upcoming = events
    .filter((e) => isFuture(parseISO(e.date)) || isToday(parseISO(e.date)))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10);

  const isFocus = currentMode === 'focus';

  useEffect(() => {
    if (isFocus) setShowForm(false);
  }, [isFocus]);

  const handleAdd = () => {
    if (!title.trim() || !date) return;
    addEvent({ title: title.trim(), date, type });
    setTitle('');
    setDate('');
    setType('custom');
    setShowForm(false);
  };

  return (
    <div className="space-y-3" data-testid="mini-calendar">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground tracking-tight">Upcoming Events</h2>
        {!isFocus && (
          <button
            onClick={() => setShowForm((v) => !v)}
            data-testid="button-add-event"
            className="flex min-h-[44px] items-center gap-1 rounded-2xl px-2 text-primary text-sm font-semibold"
          >
            <Plus size={16} />
            Add
          </button>
        )}
      </div>

      <AnimatePresence>
        {showForm && !isFocus && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="overflow-hidden"
          >
            <div className="bg-card rounded-2xl border border-card-border p-4 space-y-3">
              <input
                type="text"
                placeholder="Event name (e.g. Physics test, Birthday)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                data-testid="input-event-title"
                className="w-full bg-background border border-input rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  data-testid="input-event-date"
                  className="flex-1 bg-background border border-input rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as StudyEvent['type'])}
                  data-testid="select-event-type"
                  className="bg-background border border-input rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="test">Test</option>
                  <option value="revision">Revision</option>
                  <option value="free">Free Day</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2 rounded-xl border border-input text-sm font-medium text-muted-foreground"
                >
                  Cancel
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleAdd}
                  data-testid="button-save-event"
                  className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
                >
                  Save Event
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {upcoming.length === 0 ? (
        <div className="bg-card rounded-2xl border border-card-border border-dashed p-5 flex items-center gap-3 text-muted-foreground">
          <Calendar size={20} />
          <p className="text-sm">
            {isFocus ? 'No upcoming events.' : 'No upcoming events. Add one to get started!'}
          </p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {upcoming.map((evt) => {
            const style = TYPE_STYLES[evt.type];
            const d = parseISO(evt.date);
            const todayEvt = isToday(d);
            return (
              <motion.div
                key={evt.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                className="shrink-0 w-28 bg-card rounded-2xl border border-card-border p-3 relative"
                data-testid={`event-card-${evt.id}`}
              >
                {!isFocus && (
                  <button
                    onClick={() => removeEvent(evt.id)}
                    className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground/50 hover:bg-secondary hover:text-muted-foreground"
                    data-testid={`button-remove-event-${evt.id}`}
                    aria-label={`Remove ${evt.title}`}
                  >
                    <X size={12} />
                  </button>
                )}
                <div className="text-2xl font-black text-foreground leading-none mb-0.5">
                  {format(d, 'd')}
                </div>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {format(d, 'MMM')}
                </div>
                <p className="text-xs font-semibold text-foreground truncate mb-1.5 leading-snug">
                  {evt.title}
                </p>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md ${style.bg} ${style.text}`}
                >
                  {todayEvt ? 'Today!' : style.label}
                </span>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
