import { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from './MessageBubble';
import { useWhatsAppSimulator } from '@/hooks/useWhatsAppSimulator';
import { cn } from '@/lib/utils';

export function ChatSimulator() {
  const [activeTab, setActiveTab] = useState<'customer' | 'admin'>('customer');
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const customerSimulator = useWhatsAppSimulator('customer');
  const adminSimulator = useWhatsAppSimulator('admin');

  const currentSimulator = activeTab === 'customer' ? customerSimulator : adminSimulator;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentSimulator.messages]);

  const handleSend = () => {
    if (input.trim() && !currentSimulator.isLoading) {
      currentSimulator.sendMessage(input);
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleRecording = () => {
    // TODO: Implement voice recording with Web Audio API
    setIsRecording(!isRecording);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'customer' | 'admin')} className="flex flex-col h-full">
        <div className="p-4 border-b border-zinc-800">
          <TabsList className="grid w-full grid-cols-2 bg-zinc-800">
            <TabsTrigger
              value="customer"
              className="data-[state=active]:bg-amber-500 data-[state=active]:text-black"
            >
              📱 Customer
            </TabsTrigger>
            <TabsTrigger
              value="admin"
              className="data-[state=active]:bg-amber-500 data-[state=active]:text-black"
            >
              👔 Admin
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="customer" className="flex-1 flex flex-col m-0 overflow-hidden">
          <SimulatorContent
            simulator={customerSimulator}
            input={input}
            setInput={setInput}
            isRecording={isRecording}
            toggleRecording={toggleRecording}
            handleSend={handleSend}
            handleKeyDown={handleKeyDown}
            scrollRef={scrollRef}
            placeholder="Type a message or tap 🎤 for voice..."
            emptyMessage="Send a message to test the customer booking flow"
          />
        </TabsContent>

        <TabsContent value="admin" className="flex-1 flex flex-col m-0 overflow-hidden">
          <SimulatorContent
            simulator={adminSimulator}
            input={input}
            setInput={setInput}
            isRecording={isRecording}
            toggleRecording={toggleRecording}
            handleSend={handleSend}
            handleKeyDown={handleKeyDown}
            scrollRef={scrollRef}
            placeholder="Ask ZAINA about revenue, clients, etc..."
            emptyMessage="Try asking: 'What was the revenue today?'"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface SimulatorContentProps {
  simulator: ReturnType<typeof useWhatsAppSimulator>;
  input: string;
  setInput: (value: string) => void;
  isRecording: boolean;
  toggleRecording: () => void;
  handleSend: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  scrollRef: React.RefObject<HTMLDivElement>;
  placeholder: string;
  emptyMessage: string;
}

function SimulatorContent({
  simulator,
  input,
  setInput,
  isRecording,
  toggleRecording,
  handleSend,
  handleKeyDown,
  scrollRef,
  placeholder,
  emptyMessage,
}: SimulatorContentProps) {
  return (
    <>
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {simulator.messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
            {emptyMessage}
          </div>
        ) : (
          <div className="space-y-2">
            {simulator.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {simulator.isLoading && (
              <div className="flex justify-start">
                <div className="bg-zinc-800 rounded-2xl px-4 py-3 border border-zinc-700">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce delay-100" />
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t border-zinc-800">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={simulator.clearMessages}
            className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            title="Clear chat"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={simulator.isLoading}
            className="flex-1 bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-amber-500"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleRecording}
            className={cn(
              'hover:bg-zinc-800',
              isRecording ? 'text-red-500 animate-pulse' : 'text-zinc-400'
            )}
            title="Voice message"
          >
            {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button
            onClick={handleSend}
            disabled={!input.trim() || simulator.isLoading}
            className="bg-amber-500 hover:bg-amber-600 text-black"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
