import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, ClipboardCheck, Eye } from 'lucide-react';
import { useStockTakeSessions, StockTakeStatus } from '@/hooks/useStockTake';
import { useAuth } from '@/contexts/AuthContext';
import { CreateSessionDialog } from './CreateSessionDialog';
import { StockTakeSessionView } from './StockTakeSessionView';
import { BlindCountView } from './BlindCountView';
import { format } from 'date-fns';
import { EmptyState, LoadingState } from '@/components/ui/state-primitives';

const statusColors: Record<StockTakeStatus, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  reviewing: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
};

export const StockTakeTab = () => {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [countingSessionId, setCountingSessionId] = useState<string | null>(null);
  const { data: sessions, isLoading } = useStockTakeSessions();
  const { hasRole } = useAuth();

  const isManager = hasRole('owner') || hasRole('manager');

  if (countingSessionId) {
    return <BlindCountView sessionId={countingSessionId} onBack={() => setCountingSessionId(null)} />;
  }

  if (selectedSessionId) {
    return <StockTakeSessionView sessionId={selectedSessionId} onBack={() => setSelectedSessionId(null)} />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Stock Take Sessions</CardTitle>
          {isManager && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" /> New Session
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState variant="table" rows={4} />
          ) : !sessions || sessions.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              size="compact"
              title="No stock take sessions yet"
              description={isManager ? 'Create a session to count stock and reconcile variance.' : 'Your manager will create a session when one is needed.'}
              action={isManager ? { label: 'New Session', onClick: () => setShowCreate(true) } : undefined}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Variance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map(session => (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">{session.session_name}</TableCell>
                    <TableCell className="capitalize">{session.scope.replace('_', ' ')}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[session.status]}>
                        {session.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(session.created_at), 'dd MMM yyyy')}</TableCell>
                    <TableCell>
                      {session.status === 'completed'
                        ? `${session.total_variance_value.toFixed(2)} KWD`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {isManager && (
                        <Button size="sm" variant="outline" onClick={() => setSelectedSessionId(session.id)}>
                          <Eye className="h-3.5 w-3.5 mr-1" /> Review
                        </Button>
                      )}
                      {session.status !== 'completed' && (
                        <Button size="sm" variant="secondary" onClick={() => setCountingSessionId(session.id)}>
                          <ClipboardCheck className="h-3.5 w-3.5 mr-1" /> Count
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <CreateSessionDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
};
