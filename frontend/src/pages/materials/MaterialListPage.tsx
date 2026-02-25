import { useState } from 'react';
import { Search, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/shared/FormField';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { useApiList, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

interface Material {
  id: string; material_name: string; category: string; unit_of_measure: string;
  current_stock: number; reorder_level: number | null; cost_per_unit: string | null;
  preferred_supplier: string | null; storage_location: string | null;
}

const columns: Column<Material>[] = [
  { key: 'material_name', header: 'Material', render: (row) => <span className="font-medium">{row.material_name}</span> },
  { key: 'category', header: 'Category', render: (row) => <span className="text-sm capitalize">{row.category.replace(/_/g, ' ')}</span> },
  {
    key: 'current_stock', header: 'Stock', render: (row) => {
      const isLow = row.reorder_level != null && row.current_stock <= row.reorder_level;
      return <span className={`text-sm font-medium ${isLow ? 'text-red-600' : ''}`}>{row.current_stock} {row.unit_of_measure}{isLow ? ' !' : ''}</span>;
    },
  },
  { key: 'reorder_level', header: 'Reorder At', render: (row) => <span className="text-sm">{row.reorder_level ?? '-'}</span> },
  { key: 'cost_per_unit', header: 'Unit Cost', render: (row) => <span className="text-sm">{row.cost_per_unit ? `$${parseFloat(row.cost_per_unit).toFixed(2)}` : '-'}</span> },
  { key: 'preferred_supplier', header: 'Supplier', render: (row) => <span className="text-sm">{row.preferred_supplier ?? '-'}</span> },
];

export default function MaterialListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [lowStock, setLowStock] = useState(false);
  const [showTransaction, setShowTransaction] = useState(false);
  const [txData, setTxData] = useState({ material_id: '', transaction_type: 'purchase', quantity: '', unit_cost: '', notes: '' });

  const params: Record<string, unknown> = { page, limit: 25 };
  if (search) params.search = search;
  if (category !== 'all') params.category = category;
  if (lowStock) params.low_stock = true;

  const { data, isLoading } = useApiList<Material>(['materials'], '/v1/materials', params);
  const txMut = useApiMutation('post', `/v1/materials/${txData.material_id}/transactions`, [['materials']]);

  const recordTransaction = () => {
    txMut.mutate({ transaction_type: txData.transaction_type, quantity: parseFloat(txData.quantity), unit_cost: txData.unit_cost ? parseFloat(txData.unit_cost) : null, notes: txData.notes || null } as never, {
      onSuccess: () => { toast.success('Transaction recorded'); setShowTransaction(false); },
      onError: (err) => toast.error(err.response?.data?.message ?? 'Failed'),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Materials" description="Inventory and stock management" actions={
        <Button variant="outline" onClick={() => { setLowStock(!lowStock); setPage(1); }} className={lowStock ? 'bg-red-50' : ''}>
          <AlertTriangle className="mr-2 h-4 w-4" />{lowStock ? 'Show All' : 'Low Stock'}
        </Button>
      } />
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search materials..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-10" /></div>
        <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="salt">Salt</SelectItem><SelectItem value="sand">Sand</SelectItem><SelectItem value="mulch">Mulch</SelectItem><SelectItem value="soil">Soil</SelectItem><SelectItem value="stone">Stone</SelectItem><SelectItem value="fertilizer">Fertilizer</SelectItem><SelectItem value="seed">Seed</SelectItem><SelectItem value="fuel">Fuel</SelectItem><SelectItem value="pavers">Pavers</SelectItem></SelectContent></Select>
      </div>
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No materials found." onRowClick={(row) => { setTxData({ ...txData, material_id: row.id as string }); setShowTransaction(true); }} pagination={data?.pagination ? { page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total, onPageChange: setPage } : undefined} />

      <Dialog open={showTransaction} onOpenChange={setShowTransaction}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Record Transaction</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <FormField label="Type">
              <Select value={txData.transaction_type} onValueChange={(v) => setTxData({ ...txData, transaction_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="purchase">Purchase</SelectItem><SelectItem value="usage">Usage</SelectItem><SelectItem value="adjustment">Adjustment</SelectItem><SelectItem value="return">Return</SelectItem></SelectContent>
              </Select>
            </FormField>
            <FormField label="Quantity"><Input type="number" step="0.01" value={txData.quantity} onChange={(e) => setTxData({ ...txData, quantity: e.target.value })} /></FormField>
            <FormField label="Unit Cost"><Input type="number" step="0.01" value={txData.unit_cost} onChange={(e) => setTxData({ ...txData, unit_cost: e.target.value })} /></FormField>
            <FormField label="Notes"><Input value={txData.notes} onChange={(e) => setTxData({ ...txData, notes: e.target.value })} /></FormField>
            <div className="flex justify-end gap-3"><Button variant="outline" onClick={() => setShowTransaction(false)}>Cancel</Button><Button onClick={recordTransaction} disabled={txMut.isPending}>{txMut.isPending ? 'Recording...' : 'Record'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
