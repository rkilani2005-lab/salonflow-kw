import { cn } from '@/lib/utils';
import { Mic } from 'lucide-react';
import type { SimulatorMessage } from '@/types/whatsapp';

interface MessageBubbleProps {
  message: SimulatorMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isArabic = message.language === 'ar';
  const isVoice = message.type === 'voice';

  return (
    <div
      className={cn(
        'flex w-full mb-4',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3 shadow-lg',
          isUser
            ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-black'
            : 'bg-zinc-800 text-zinc-100 border border-zinc-700',
          isArabic && 'text-right'
        )}
        dir={isArabic ? 'rtl' : 'ltr'}
      >
        {isVoice && (
          <div className="flex items-center gap-2 mb-2 text-xs opacity-70">
            <Mic className="h-3 w-3" />
            <span>Voice Message</span>
          </div>
        )}
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content}
        </p>
        <div
          className={cn(
            'text-xs mt-2 opacity-50',
            isUser ? 'text-right' : 'text-left'
          )}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
}
