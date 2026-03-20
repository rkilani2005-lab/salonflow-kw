import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, PanelLeftClose, PanelLeft, List, LayoutGrid } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';

interface CalendarHeaderProps {
  date: Date;
  view: 'day' | 'week' | 'month';
  sidebarCollapsed: boolean;
  listMode: boolean;
  onDateChange: (date: Date) => void;
  onViewChange: (view: 'day' | 'week' | 'month') => void;
  onToggleSidebar: () => void;
  onToggleListMode: () => void;
}

export function CalendarHeader({
  date, view, sidebarCollapsed, listMode,
  onDateChange, onViewChange, onToggleSidebar, onToggleListMode,
}: CalendarHeaderProps) {
  const handlePrevious = () => {
    if (view === 'day')   onDateChange(subDays(date, 1));
    else if (view === 'week') onDateChange(subDays(date, 7));
    else onDateChange(subDays(date, 30));
  };

  const handleNext = () => {
    if (view === 'day')   onDateChange(addDays(date, 1));
    else if (view === 'week') onDateChange(addDays(date, 7));
    else onDateChange(addDays(date, 30));
  };

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b bg-card gap-2">
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="h-8 w-8">
          {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>

        <Button variant="outline" size="sm" className="h-8 text-xs font-semibold" onClick={() => onDateChange(new Date())}>
          Today
        </Button>

        <div className="flex items-center">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <h2 className="text-sm font-semibold ml-1 hidden sm:block">
          {format(date, 'EEEE, MMMM d, yyyy')}
        </h2>
        <h2 className="text-sm font-semibold ml-1 sm:hidden">
          {format(date, 'EEE, MMM d')}
        </h2>
      </div>

      <div className="flex items-center gap-1.5">
        {/* List / Grid toggle */}
        <Button
          variant={listMode ? 'default' : 'outline'}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onToggleListMode}
          title={listMode ? 'Switch to grid view' : 'Switch to list view'}
        >
          {listMode ? <LayoutGrid className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
        </Button>

        {/* View toggle — only in grid mode */}
        {!listMode && (
          <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
            {(['day', 'week', 'month'] as const).map(v => (
              <Button
                key={v}
                variant={view === v ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs capitalize"
                onClick={() => onViewChange(v)}
              >
                {v}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
