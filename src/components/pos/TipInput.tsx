import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface TipInputProps {
  subtotal: number;
  tipAmount: number;
  onTipChange: (amount: number) => void;
}

const QUICK_TIPS = [
  { label: '5%', value: 0.05 },
  { label: '10%', value: 0.10 },
  { label: '15%', value: 0.15 },
];

export function TipInput({ subtotal, tipAmount, onTipChange }: TipInputProps) {
  const [mode, setMode] = useState<'fixed' | 'percentage'>('fixed');
  const [customValue, setCustomValue] = useState('');

  const handleQuickTip = (pct: number) => {
    setMode('percentage');
    const tip = Math.round(subtotal * pct * 1000) / 1000;
    onTipChange(tip);
    setCustomValue('');
  };

  const handleCustomChange = (value: string) => {
    setCustomValue(value);
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
      if (mode === 'percentage') {
        onTipChange(Math.round(subtotal * (num / 100) * 1000) / 1000);
      } else {
        onTipChange(num);
      }
    } else if (value === '') {
      onTipChange(0);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">Tip</Label>
      <div className="flex items-center gap-2">
        {QUICK_TIPS.map((tip) => (
          <Button
            key={tip.label}
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              'min-w-[48px] h-10',
              tipAmount > 0 && Math.abs(tipAmount - subtotal * tip.value) < 0.01 && 'border-primary bg-primary/10 text-primary'
            )}
            onClick={() => handleQuickTip(tip.value)}
          >
            {tip.label}
          </Button>
        ))}
        <div className="flex-1 flex items-center gap-1">
          <Input
            type="number"
            placeholder="Custom"
            value={customValue}
            onChange={(e) => handleCustomChange(e.target.value)}
            className="h-10"
            min="0"
            step="0.001"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn('text-xs', mode === 'fixed' ? 'text-primary' : 'text-muted-foreground')}
            onClick={() => {
              setMode(mode === 'fixed' ? 'percentage' : 'fixed');
              setCustomValue('');
              onTipChange(0);
            }}
          >
            {mode === 'fixed' ? 'KWD' : '%'}
          </Button>
        </div>
      </div>
      {tipAmount > 0 && (
        <p className="text-xs text-muted-foreground">Tip: {tipAmount.toFixed(3)} KWD</p>
      )}
    </div>
  );
}
