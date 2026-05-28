// src/components/PlanGate.tsx
// Wrap a feature in <PlanGate feature="ai_agent">...</PlanGate>.
import { ReactNode } from 'react';
import { useEntitlements } from '@/hooks/useEntitlements';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PlanGate({ feature, children, fallback }: Props) {
  const ent = useEntitlements();
  if (ent.loading) return null;
  if (ent.has(feature)) return <>{children}</>;
  if (fallback) return <>{fallback}</>;
  return (
    <Card className="border-dashed">
      <CardContent className="p-8 text-center space-y-3">
        <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
        <div className="text-sm text-muted-foreground">
          This feature is not included in your current plan ({ent.plan_name || ent.plan_code}).
        </div>
        <Button asChild size="sm"><Link to="/subscription">Upgrade plan</Link></Button>
      </CardContent>
    </Card>
  );
}
