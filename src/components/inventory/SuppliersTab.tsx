import { useState } from 'react';
import { useSuppliers, type Supplier } from '@/hooks/useSuppliers';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Truck } from 'lucide-react';
import { AddSupplierDialog } from './AddSupplierDialog';
import { useDebounce } from '@/hooks/useDebounce';
import { EmptyState, LoadingState } from '@/components/ui/state-primitives';

export const SuppliersTab = () => {
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);
  const { data: suppliers, isLoading } = useSuppliers(debouncedSearch);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search suppliers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Supplier
        </Button>
      </div>

      {isLoading ? (
        <LoadingState variant="table" rows={5} />
      ) : !suppliers?.length ? (
        <EmptyState
          icon={Truck}
          title={search ? 'No suppliers match your search' : 'No suppliers yet'}
          description={
            search
              ? 'Try a different search term.'
              : 'Add your suppliers to start tracking purchase orders and invoices.'
          }
          action={
            search
              ? { label: 'Clear search', onClick: () => setSearch('') }
              : { label: 'Add Supplier', onClick: () => setAddOpen(true) }
          }
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Payment Terms</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{supplier.name}</span>
                      {supplier.name_ar && (
                        <span className="block text-xs text-muted-foreground" dir="rtl">{supplier.name_ar}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{supplier.contact_person || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{supplier.phone || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{supplier.email || '—'}</TableCell>
                  <TableCell><Badge variant="outline">{supplier.payment_terms}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={supplier.is_active ? 'default' : 'secondary'}>
                      {supplier.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AddSupplierDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
};
