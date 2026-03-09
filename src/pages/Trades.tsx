import { useState, useMemo } from 'react';
import { useTrades, useDeleteTrade, useBulkDeleteTrades, useDeleteAllTrades } from '@/hooks/useTrades';
import { useSelectedAccount } from '@/hooks/useSelectedAccount';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, TrendingUp, TrendingDown, Eye, AlertTriangle } from 'lucide-react';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { TradeForm } from '@/components/trades/TradeForm';
import { TradeDetail } from '@/components/trades/TradeDetail';
import { CsvImport } from '@/components/trades/CsvImport';
import { TagPerformance } from '@/components/trades/TagPerformance';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Database } from '@/integrations/supabase/types';

type Trade = Database['public']['Tables']['trades']['Row'];

export default function Trades() {
  const { data: trades, isLoading } = useTrades();
  const { selectedAccount } = useSelectedAccount();
  const deleteTrade = useDeleteTrade();
  const bulkDelete = useBulkDeleteTrades();
  const deleteAll = useDeleteAllTrades();
  const [formOpen, setFormOpen] = useState(false);
  const canAddTrade = selectedAccount !== 'all';
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filters
  const [filterSymbol, setFilterSymbol] = useState('');
  const [filterDirection, setFilterDirection] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterStrategy, setFilterStrategy] = useState('all');
  const [filterAssetType, setFilterAssetType] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterTag, setFilterTag] = useState('all');

  const strategies = useMemo(() => [...new Set((trades ?? []).map(t => t.strategy).filter(Boolean))], [trades]);
  const assetTypes = useMemo(() => [...new Set((trades ?? []).map(t => t.asset_type).filter(Boolean))], [trades]);
  const allTags = useMemo(() => [...new Set((trades ?? []).flatMap(t => t.tags ?? []))], [trades]);

  const filtered = useMemo(() => {
    if (!trades) return [];
    return trades.filter(t => {
      if (filterSymbol && !t.symbol.toLowerCase().includes(filterSymbol.toLowerCase())) return false;
      if (filterDirection !== 'all' && t.direction !== filterDirection) return false;
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (filterStrategy !== 'all' && t.strategy !== filterStrategy) return false;
      if (filterAssetType !== 'all' && t.asset_type !== filterAssetType) return false;
      if (filterTag !== 'all' && !(t.tags ?? []).includes(filterTag)) return false;
      if (filterDateFrom && isBefore(parseISO(t.entry_date), parseISO(filterDateFrom))) return false;
      if (filterDateTo && isAfter(parseISO(t.entry_date), parseISO(filterDateTo + 'T23:59:59'))) return false;
      return true;
    });
  }, [trades, filterSymbol, filterDirection, filterStatus, filterStrategy, filterAssetType, filterTag, filterDateFrom, filterDateTo]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(t => t.id)));
    }
  };

  const handleBulkDelete = () => {
    bulkDelete.mutate(Array.from(selectedIds), { onSuccess: () => setSelectedIds(new Set()) });
  };

  const handleDeleteAll = () => {
    deleteAll.mutate(undefined, { onSuccess: () => setSelectedIds(new Set()) });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trade Journal</h1>
          <p className="text-muted-foreground text-sm">Log and manage your trades</p>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />Delete {selectedIds.size} Selected
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border-border">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {selectedIds.size} trades?</AlertDialogTitle>
                  <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="border-destructive/50 text-destructive hover:bg-destructive/10">
                <AlertTriangle className="h-4 w-4 mr-2" />Delete All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete ALL trades?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently delete every trade in your account. This cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive text-destructive-foreground">Delete Everything</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <CsvImport selectedAccount={selectedAccount} />
          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <DialogTrigger asChild>
              <Button disabled={!canAddTrade} title={!canAddTrade ? 'Select a specific account first' : undefined}>
                <Plus className="h-4 w-4 mr-2" />New Trade
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
              <DialogHeader>
                <DialogTitle>Record New Trade</DialogTitle>
              </DialogHeader>
              <TradeForm onSuccess={() => setFormOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <Input placeholder="Symbol..." value={filterSymbol} onChange={e => setFilterSymbol(e.target.value)} className="bg-secondary text-xs" />
          <Select value={filterDirection} onValueChange={setFilterDirection}>
            <SelectTrigger className="bg-secondary text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Directions</SelectItem>
              <SelectItem value="long">Long</SelectItem>
              <SelectItem value="short">Short</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="bg-secondary text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterAssetType} onValueChange={setFilterAssetType}>
            <SelectTrigger className="bg-secondary text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {assetTypes.map(t => <SelectItem key={t!} value={t!}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStrategy} onValueChange={setFilterStrategy}>
            <SelectTrigger className="bg-secondary text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Strategies</SelectItem>
              {strategies.map(s => <SelectItem key={s!} value={s!}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterTag} onValueChange={setFilterTag}>
            <SelectTrigger className="bg-secondary text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {allTags.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="bg-secondary text-xs" placeholder="From" />
          <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="bg-secondary text-xs" placeholder="To" />
        </div>
      </div>

      <Tabs defaultValue="trades">
        <TabsList className="bg-secondary border border-border">
          <TabsTrigger value="trades" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Trades</TabsTrigger>
          <TabsTrigger value="tag-performance" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Tag Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="trades">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <p className="text-center py-12 text-muted-foreground">Loading...</p>
        ) : !filtered.length ? (
          <p className="text-center py-12 text-muted-foreground">No trades found.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-10">
                    <Checkbox checked={selectedIds.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead className="text-muted-foreground">Date</TableHead>
                  <TableHead className="text-muted-foreground">Symbol</TableHead>
                  <TableHead className="text-muted-foreground">Type</TableHead>
                  <TableHead className="text-muted-foreground">Dir</TableHead>
                  <TableHead className="text-muted-foreground">Entry</TableHead>
                  <TableHead className="text-muted-foreground">Exit</TableHead>
                  <TableHead className="text-muted-foreground">P&L</TableHead>
                  <TableHead className="text-muted-foreground">Tags</TableHead>
                  <TableHead className="text-muted-foreground">Strategy</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(t => (
                  <TableRow key={t.id} className="border-border cursor-pointer hover:bg-accent/50">
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selectedIds.has(t.id)} onCheckedChange={() => toggleSelect(t.id)} />
                    </TableCell>
                    <TableCell className="font-mono text-xs" onClick={() => { setSelectedTrade(t); setDetailOpen(true); }}>{format(parseISO(t.entry_date), 'MMM dd')}</TableCell>
                    <TableCell className="font-bold" onClick={() => { setSelectedTrade(t); setDetailOpen(true); }}>{t.symbol}</TableCell>
                    <TableCell className="text-xs text-muted-foreground" onClick={() => { setSelectedTrade(t); setDetailOpen(true); }}>{t.asset_type || '—'}</TableCell>
                    <TableCell onClick={() => { setSelectedTrade(t); setDetailOpen(true); }}>
                      <span className="flex items-center gap-1">
                        {t.direction === 'long' ? <TrendingUp className="h-3 w-3 text-[hsl(var(--chart-green))]" /> : <TrendingDown className="h-3 w-3 text-[hsl(var(--chart-red))]" />}
                        <span className="text-xs uppercase">{t.direction}</span>
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs" onClick={() => { setSelectedTrade(t); setDetailOpen(true); }}>{t.entry_price}</TableCell>
                    <TableCell className="font-mono text-xs" onClick={() => { setSelectedTrade(t); setDetailOpen(true); }}>{t.exit_price ?? '—'}</TableCell>
                    <TableCell onClick={() => { setSelectedTrade(t); setDetailOpen(true); }}>
                      {t.pnl !== null ? (
                        <span className={`font-mono font-bold text-sm ${t.pnl >= 0 ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]'}`}>
                          {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell onClick={() => { setSelectedTrade(t); setDetailOpen(true); }}>
                      <div className="flex gap-1 flex-wrap">
                        {(t.tags ?? []).map(tag => (
                          <Badge key={tag} variant="secondary" className="text-[10px] bg-primary/10 text-primary">{tag}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell onClick={() => { setSelectedTrade(t); setDetailOpen(true); }}>{t.strategy && <Badge variant="secondary" className="text-xs">{t.strategy}</Badge>}</TableCell>
                    <TableCell onClick={() => { setSelectedTrade(t); setDetailOpen(true); }}><Badge variant={t.status === 'open' ? 'default' : 'secondary'} className="text-xs">{t.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedTrade(t); setDetailOpen(true); }}>
                          <Eye className="h-3 w-3 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm('Delete this trade?')) deleteTrade.mutate(t.id); }}>
                          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
        </TabsContent>

        <TabsContent value="tag-performance">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Performance by Tag</h3>
            <TagPerformance trades={trades ?? []} />
          </div>
        </TabsContent>
      </Tabs>

      <TradeDetail trade={selectedTrade} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
