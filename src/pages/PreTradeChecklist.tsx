import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, GripVertical, CheckCircle2, XCircle } from 'lucide-react';

interface ChecklistItem {
  id?: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  blueprint_id: string | null;
}

interface Blueprint {
  id: string;
  name: string;
  tier: string;
}

export default function PreTradeChecklist() {
  const { user } = useAuth();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [checkState, setCheckState] = useState<Record<string, boolean>>({});
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string>('all');

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    const [itemsRes, bpRes] = await Promise.all([
      supabase.from('checklist_items').select('*').order('sort_order', { ascending: true }),
      supabase.from('blueprints').select('id, name, tier').order('tier', { ascending: true }),
    ]);
    setItems((itemsRes.data ?? []).map(d => ({
      id: d.id,
      label: d.label,
      sort_order: d.sort_order,
      is_active: d.is_active,
      blueprint_id: (d as any).blueprint_id ?? null,
    })));
    setBlueprints((bpRes.data ?? []).map(b => ({ id: b.id, name: b.name ?? '', tier: b.tier })));
    setCheckState({});
    setLoading(false);
  };

  const filteredItems = selectedBlueprintId === 'all'
    ? items
    : selectedBlueprintId === 'general'
      ? items.filter(i => !i.blueprint_id)
      : items.filter(i => i.blueprint_id === selectedBlueprintId);

  const addItem = async () => {
    if (!newLabel.trim() || !user) return;
    const bpId = selectedBlueprintId === 'all' || selectedBlueprintId === 'general' ? null : selectedBlueprintId;
    const { error } = await supabase.from('checklist_items').insert({
      user_id: user.id,
      label: newLabel.trim(),
      sort_order: filteredItems.length,
      blueprint_id: bpId,
    } as any);
    if (error) return toast.error(error.message);
    setNewLabel('');
    loadData();
    toast.success('Item added');
  };

  const removeItem = async (id: string) => {
    await supabase.from('checklist_items').delete().eq('id', id);
    loadData();
    toast.success('Item removed');
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from('checklist_items').update({ is_active: !active } as any).eq('id', id);
    loadData();
  };

  const toggleCheck = (id: string) => {
    setCheckState(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const activeItems = filteredItems.filter(i => i.is_active);
  const allChecked = activeItems.length > 0 && activeItems.every(i => checkState[i.id!]);
  const checkedCount = activeItems.filter(i => checkState[i.id!]).length;

  const getBlueprintLabel = (bp: Blueprint) => `${bp.tier} — ${bp.name || 'Unnamed'}`;

  if (loading) return <div className="text-muted-foreground text-center py-12">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pre-Trade Checklist</h1>
        <p className="text-muted-foreground text-sm">צ'קליסט חובה לפני כל כניסה לעסקה — לכל Blueprint בנפרד</p>
      </div>

      {/* Blueprint selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Blueprint:</label>
        <Select value={selectedBlueprintId} onValueChange={(v) => { setSelectedBlueprintId(v); setCheckState({}); }}>
          <SelectTrigger className="w-[280px] bg-secondary">
            <SelectValue placeholder="Select Blueprint" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Checklists</SelectItem>
            <SelectItem value="general">General (No Blueprint)</SelectItem>
            {blueprints.map(bp => (
              <SelectItem key={bp.id} value={bp.id}>{getBlueprintLabel(bp)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Live checklist */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">Quick Check</h3>
          <div className="flex items-center gap-2">
            {allChecked ? (
              <span className="flex items-center gap-1 text-sm font-bold text-chart-green"><CheckCircle2 className="h-5 w-5" /> GO — All Clear</span>
            ) : (
              <span className="flex items-center gap-1 text-sm font-bold text-chart-red"><XCircle className="h-5 w-5" /> {checkedCount}/{activeItems.length} Complete</span>
            )}
          </div>
        </div>

        {activeItems.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-6">
            {selectedBlueprintId === 'all' ? 'הוסף פריטים לצ\'קליסט למטה' : 'אין פריטים ל-Blueprint זה — הוסף למטה'}
          </p>
        ) : (
          <div className="space-y-2">
            {activeItems.map(item => (
              <label
                key={item.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  checkState[item.id!]
                    ? 'border-chart-green/30 bg-chart-green/5'
                    : 'border-border bg-secondary/50'
                }`}
              >
                <Checkbox
                  checked={!!checkState[item.id!]}
                  onCheckedChange={() => toggleCheck(item.id!)}
                />
                <span className={`text-sm ${checkState[item.id!] ? 'line-through text-muted-foreground' : ''}`}>
                  {item.label}
                </span>
              </label>
            ))}
          </div>
        )}

        {activeItems.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setCheckState({})}>Reset Checklist</Button>
        )}
      </div>

      {/* Manage items */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h3 className="font-bold text-lg">Manage Checklist Items</h3>

        <div className="flex gap-2">
          <Input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder='e.g., "Checked HTF trend direction"'
            className="bg-secondary"
            onKeyDown={e => e.key === 'Enter' && addItem()}
          />
          <Button onClick={addItem}><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </div>

        <div className="space-y-2">
          {filteredItems.map(item => (
            <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <span className={`flex-1 text-sm ${!item.is_active ? 'line-through text-muted-foreground' : ''}`}>{item.label}</span>
              {item.blueprint_id && (
                <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                  {blueprints.find(b => b.id === item.blueprint_id)?.tier ?? ''}
                </span>
              )}
              <Button variant="ghost" size="sm" onClick={() => toggleActive(item.id!, item.is_active)}>
                {item.is_active ? 'Disable' : 'Enable'}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => removeItem(item.id!)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
