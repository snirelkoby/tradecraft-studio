import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Trash2, Copy } from 'lucide-react';

const TIERS = ['AAA', 'AA', 'A', 'B', 'C', 'D'];

interface Blueprint {
  id?: string;
  tier: string;
  name: string;
  logic: string;
  risk_rules: string;
  checklist: string;
  max_allocation: number;
}

export default function Blueprints() {
  const { user } = useAuth();
  const [blueprints, setBlueprints] = useState<Record<string, Blueprint[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadBlueprints();
  }, [user]);

  const loadBlueprints = async () => {
    const { data } = await supabase.from('blueprints').select('*').order('created_at', { ascending: true });
    const map: Record<string, Blueprint[]> = {};
    TIERS.forEach(t => { map[t] = []; });
    (data ?? []).forEach(b => {
      const tier = b.tier;
      if (!map[tier]) map[tier] = [];
      map[tier].push({
        id: b.id,
        tier: b.tier,
        name: b.name ?? '',
        logic: b.logic ?? '',
        risk_rules: b.risk_rules ?? '',
        checklist: b.checklist ?? '',
        max_allocation: b.max_allocation ?? 1,
      });
    });
    setBlueprints(map);
    setLoading(false);
  };

  const addSetup = (tier: string) => {
    setBlueprints(prev => ({
      ...prev,
      [tier]: [...(prev[tier] || []), { tier, name: '', logic: '', risk_rules: '', checklist: '', max_allocation: 1 }],
    }));
  };

  const duplicateSetup = (tier: string, idx: number) => {
    const src = blueprints[tier]?.[idx];
    if (!src) return;
    setBlueprints(prev => ({
      ...prev,
      [tier]: [...(prev[tier] || []), { ...src, id: undefined, name: src.name + ' (Copy)' }],
    }));
  };

  const removeSetup = async (tier: string, idx: number) => {
    const bp = blueprints[tier]?.[idx];
    if (!bp) return;
    if (bp.id) {
      await supabase.from('blueprints').delete().eq('id', bp.id);
    }
    setBlueprints(prev => ({
      ...prev,
      [tier]: prev[tier].filter((_, i) => i !== idx),
    }));
    toast.success('Setup removed');
  };

  const saveSetup = async (tier: string, idx: number) => {
    const bp = blueprints[tier]?.[idx];
    if (!bp || !user) return;

    if (bp.id) {
      const { error } = await supabase.from('blueprints').update({
        name: bp.name,
        logic: bp.logic,
        risk_rules: bp.risk_rules,
        checklist: bp.checklist,
        max_allocation: bp.max_allocation,
      } as any).eq('id', bp.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from('blueprints').insert({
        user_id: user.id,
        tier,
        name: bp.name,
        logic: bp.logic,
        risk_rules: bp.risk_rules,
        checklist: bp.checklist,
        max_allocation: bp.max_allocation,
      } as any);
      if (error) return toast.error(error.message);
    }
    toast.success(`Setup ${bp.name || tier} saved`);
    loadBlueprints();
  };

  const updateField = (tier: string, idx: number, field: keyof Blueprint, value: any) => {
    setBlueprints(prev => ({
      ...prev,
      [tier]: prev[tier].map((bp, i) => i === idx ? { ...bp, [field]: value } : bp),
    }));
  };

  if (loading) return <div className="text-muted-foreground text-center py-12">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Strategic Blueprints</h1>
        <p className="text-muted-foreground text-sm">הגדר אסטרטגיות מסחר — ניתן ליצור מספר Setups בכל רמה</p>
      </div>

      <Tabs defaultValue="AAA">
        <TabsList className="bg-secondary border border-border">
          {TIERS.map(t => (
            <TabsTrigger key={t} value={t} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono font-bold">
              {t} {blueprints[t]?.length > 0 && <span className="ml-1 text-[10px] opacity-70">({blueprints[t].length})</span>}
            </TabsTrigger>
          ))}
        </TabsList>
        {TIERS.map(tier => {
          const setups = blueprints[tier] || [];
          return (
            <TabsContent key={tier} value={tier} className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">Level {tier} — {setups.length} Setups</h3>
                <Button size="sm" onClick={() => addSetup(tier)}>
                  <Plus className="h-4 w-4 mr-1" /> New Setup
                </Button>
              </div>

              {setups.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-8 text-center">
                  <p className="text-muted-foreground text-sm mb-3">אין Setups ברמה זו</p>
                  <Button variant="outline" onClick={() => addSetup(tier)}>
                    <Plus className="h-4 w-4 mr-1" /> צור Setup חדש
                  </Button>
                </div>
              ) : (
                setups.map((bp, idx) => (
                  <div key={bp.id || `new-${idx}`} className="rounded-xl border border-border bg-card p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-1 rounded">#{idx + 1}</span>
                      <div className="flex-1">
                        <Input
                          value={bp.name}
                          onChange={(e) => updateField(tier, idx, 'name', e.target.value)}
                          placeholder={`Strategy name (e.g., "Breakout Momentum")`}
                          className="bg-secondary text-lg font-semibold"
                        />
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => duplicateSetup(tier, idx)} title="Duplicate">
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => removeSetup(tier, idx)} title="Delete">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-muted-foreground uppercase mb-1 block">Operational Logic (Entry/Exit)</label>
                        <Textarea
                          value={bp.logic}
                          onChange={(e) => updateField(tier, idx, 'logic', e.target.value)}
                          className="bg-secondary min-h-[200px]"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground uppercase mb-1 block">Risk Parameters (SL Management)</label>
                        <Textarea
                          value={bp.risk_rules}
                          onChange={(e) => updateField(tier, idx, 'risk_rules', e.target.value)}
                          className="bg-secondary min-h-[200px]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground uppercase mb-1 block">Technical Checklist</label>
                      <Textarea
                        value={bp.checklist}
                        onChange={(e) => updateField(tier, idx, 'checklist', e.target.value)}
                        className="bg-secondary"
                      />
                    </div>
                    <div className="flex items-end gap-4">
                      <div className="max-w-xs flex-1">
                        <label className="text-xs text-muted-foreground uppercase mb-1 block">Max Portfolio Allocation (%)</label>
                        <Input
                          type="number"
                          value={bp.max_allocation}
                          onChange={(e) => updateField(tier, idx, 'max_allocation', parseFloat(e.target.value) || 0)}
                          className="bg-secondary"
                        />
                      </div>
                      <Button onClick={() => saveSetup(tier, idx)} className="font-bold">
                        COMMIT CHANGES
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
