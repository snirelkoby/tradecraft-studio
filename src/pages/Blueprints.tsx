import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

const TIERS = ['AAA', 'AA', 'A', 'B', 'C', 'D'];

interface Blueprint {
  id?: string;
  tier: string;
  logic: string;
  risk_rules: string;
  checklist: string;
  max_allocation: number;
}

export default function Blueprints() {
  const { user } = useAuth();
  const [blueprints, setBlueprints] = useState<Record<string, Blueprint>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadBlueprints();
  }, [user]);

  const loadBlueprints = async () => {
    const { data } = await supabase.from('blueprints').select('*');
    const map: Record<string, Blueprint> = {};
    (data ?? []).forEach(b => {
      map[b.tier] = {
        id: b.id,
        tier: b.tier,
        logic: b.logic ?? '',
        risk_rules: b.risk_rules ?? '',
        checklist: b.checklist ?? '',
        max_allocation: b.max_allocation ?? 1,
      };
    });
    setBlueprints(map);
    setLoading(false);
  };

  const saveTier = async (tier: string) => {
    const bp = blueprints[tier];
    if (!bp || !user) return;

    if (bp.id) {
      const { error } = await supabase.from('blueprints').update({
        logic: bp.logic,
        risk_rules: bp.risk_rules,
        checklist: bp.checklist,
        max_allocation: bp.max_allocation,
      }).eq('id', bp.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from('blueprints').insert({
        user_id: user.id,
        tier,
        logic: bp.logic,
        risk_rules: bp.risk_rules,
        checklist: bp.checklist,
        max_allocation: bp.max_allocation,
      });
      if (error) return toast.error(error.message);
    }
    toast.success(`Blueprint ${tier} saved`);
    loadBlueprints();
  };

  const updateField = (tier: string, field: keyof Blueprint, value: any) => {
    setBlueprints(prev => ({
      ...prev,
      [tier]: {
        ...prev[tier] ?? { tier, logic: '', risk_rules: '', checklist: '', max_allocation: 1 },
        [field]: value,
      },
    }));
  };

  if (loading) return <div className="text-muted-foreground text-center py-12">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Strategic Blueprints</h1>
        <p className="text-muted-foreground text-sm">Define your trading strategies and rules</p>
      </div>

      <Tabs defaultValue="AAA">
        <TabsList className="bg-secondary border border-border">
          {TIERS.map(t => (
            <TabsTrigger key={t} value={t} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono font-bold">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>
        {TIERS.map(tier => {
          const bp = blueprints[tier] ?? { tier, logic: '', risk_rules: '', checklist: '', max_allocation: 1 };
          return (
            <TabsContent key={tier} value={tier} className="mt-4">
              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <h3 className="font-bold text-lg">Level {tier} Specification</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground uppercase mb-1 block">Operational Logic (Entry/Exit)</label>
                    <Textarea
                      value={bp.logic}
                      onChange={(e) => updateField(tier, 'logic', e.target.value)}
                      className="bg-secondary min-h-[200px]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground uppercase mb-1 block">Risk Parameters (SL Management)</label>
                    <Textarea
                      value={bp.risk_rules}
                      onChange={(e) => updateField(tier, 'risk_rules', e.target.value)}
                      className="bg-secondary min-h-[200px]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase mb-1 block">Technical Checklist</label>
                  <Textarea
                    value={bp.checklist}
                    onChange={(e) => updateField(tier, 'checklist', e.target.value)}
                    className="bg-secondary"
                  />
                </div>
                <div className="max-w-xs">
                  <label className="text-xs text-muted-foreground uppercase mb-1 block">Max Portfolio Allocation (%)</label>
                  <Input
                    type="number"
                    value={bp.max_allocation}
                    onChange={(e) => updateField(tier, 'max_allocation', parseFloat(e.target.value) || 0)}
                    className="bg-secondary"
                  />
                </div>
                <Button onClick={() => saveTier(tier)} className="font-bold">
                  COMMIT {tier} CHANGES
                </Button>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
