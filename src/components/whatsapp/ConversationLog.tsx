import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Check, MessageSquare, Mic, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WhatsAppConversation, WhatsAppMessage } from '@/types/whatsapp';

export function ConversationLog() {
  const { data: conversations, isLoading } = useQuery({
    queryKey: ['whatsapp-conversations'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.tenant_id) return [];

      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('id, tenant_id, client_id, client_name, client_phone, last_message_at, status, unread_count')
        .eq('tenant_id', profile.tenant_id)
        .order('last_message_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as WhatsAppConversation[];
    },
  });

  const flaggedConversations = conversations?.filter(c => c.needs_human_intervention) || [];
  const recentConversations = conversations?.filter(c => !c.needs_human_intervention) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Flagged Conversations */}
      {flaggedConversations.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <h3 className="text-red-400 font-semibold">Needs Human Intervention</h3>
            <Badge variant="destructive" className="ml-auto">
              {flaggedConversations.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {flaggedConversations.map((conv) => (
              <ConversationCard key={conv.id} conversation={conv} flagged />
            ))}
          </div>
        </div>
      )}

      {/* Recent Conversations */}
      <div>
        <h3 className="text-zinc-300 font-semibold mb-4 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-zinc-500" />
          Recent Conversations
        </h3>
        <ScrollArea className="h-[400px]">
          {recentConversations.length === 0 ? (
            <div className="text-center text-zinc-500 py-8">
              No conversations yet. Messages will appear here once customers start chatting.
            </div>
          ) : (
            <div className="space-y-2 pr-4">
              {recentConversations.map((conv) => (
                <ConversationCard key={conv.id} conversation={conv} />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

interface ConversationCardProps {
  conversation: WhatsAppConversation;
  flagged?: boolean;
}

function ConversationCard({ conversation, flagged }: ConversationCardProps) {
  const isAdmin = conversation.conversation_type === 'admin';

  return (
    <div
      className={cn(
        'bg-zinc-800 rounded-lg p-4 border transition-colors hover:bg-zinc-750',
        flagged ? 'border-red-500/50' : 'border-zinc-700'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center',
              isAdmin ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-700 text-zinc-400'
            )}
          >
            {isAdmin ? '👔' : '📱'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-200 font-medium font-mono text-sm">
                {conversation.phone_number}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  'text-xs',
                  isAdmin
                    ? 'border-amber-500/50 text-amber-400'
                    : 'border-zinc-600 text-zinc-400'
                )}
              >
                {isAdmin ? 'Admin' : 'Customer'}
              </Badge>
            </div>
            {flagged && conversation.intervention_reason && (
              <p className="text-red-400 text-xs mt-1">
                {conversation.intervention_reason}
              </p>
            )}
            <p className="text-zinc-500 text-xs mt-1">
              Last message:{' '}
              {new Date(conversation.last_message_at).toLocaleString()}
            </p>
          </div>
        </div>
        {flagged && (
          <Button
            size="sm"
            variant="outline"
            className="border-green-500/50 text-green-400 hover:bg-green-500/10"
          >
            <Check className="h-4 w-4 mr-1" />
            Resolve
          </Button>
        )}
      </div>
    </div>
  );
}
