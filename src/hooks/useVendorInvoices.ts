import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type InvoiceStatus = Database['public']['Enums']['vendor_invoice_status'];
type PaymentMethod = Database['public']['Enums']['vendor_payment_method'];

export interface VendorInvoice {
  id: string;
  tenant_id: string;
  supplier_id: string;
  purchase_order_id: string | null;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  currency: string;
  status: InvoiceStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  supplier?: {
    id: string;
    name: string;
    name_ar: string | null;
  };
  purchase_order?: {
    id: string;
    po_number: string;
  } | null;
}

export interface VendorPayment {
  id: string;
  tenant_id: string;
  vendor_invoice_id: string;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  reference_number: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  partially_paid: { label: 'Partially Paid', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  disputed: { label: 'Disputed', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
};

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'knet', label: 'KNET' },
];

export const useVendorInvoices = (statusFilter?: string) => {
  const { tenant } = useAuth();

  return useQuery({
    queryKey: ['vendor_invoices', tenant?.id, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('vendor_invoices')
        .select('*, supplier:suppliers(id, name, name_ar), purchase_order:purchase_orders(id, po_number)')
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter as InvoiceStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as VendorInvoice[];
    },
    enabled: !!tenant?.id,
  });
};

export const useVendorPayments = (invoiceId: string | null) => {
  return useQuery({
    queryKey: ['vendor_payments', invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_payments')
        .select('*')
        .eq('vendor_invoice_id', invoiceId!)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return data as VendorPayment[];
    },
    enabled: !!invoiceId,
  });
};

export const useCreateVendorInvoice = () => {
  const queryClient = useQueryClient();
  const { tenant } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      supplier_id: string;
      purchase_order_id?: string;
      invoice_number: string;
      invoice_date: string;
      due_date: string;
      total_amount: number;
      notes?: string;
    }) => {
      const { data: invoice, error } = await supabase
        .from('vendor_invoices')
        .insert({
          tenant_id: tenant?.id!,
          supplier_id: data.supplier_id,
          purchase_order_id: data.purchase_order_id || null,
          invoice_number: data.invoice_number,
          invoice_date: data.invoice_date,
          due_date: data.due_date,
          total_amount: data.total_amount,
          notes: data.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor_invoices'] });
      toast({ title: 'Invoice created successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to create invoice', description: error.message, variant: 'destructive' });
    },
  });
};

export const useRecordPayment = () => {
  const queryClient = useQueryClient();
  const { tenant, user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      vendor_invoice_id: string;
      amount: number;
      payment_method: PaymentMethod;
      payment_date: string;
      reference_number?: string;
      notes?: string;
      invoice_total: number;
      invoice_paid: number;
    }) => {
      // Insert payment
      const { error: paymentError } = await supabase
        .from('vendor_payments')
        .insert({
          tenant_id: tenant?.id!,
          vendor_invoice_id: data.vendor_invoice_id,
          amount: data.amount,
          payment_method: data.payment_method,
          payment_date: data.payment_date,
          reference_number: data.reference_number || null,
          notes: data.notes || null,
          created_by: user?.id || null,
        });

      if (paymentError) throw paymentError;

      // Update invoice paid_amount and status
      const newPaidAmount = data.invoice_paid + data.amount;
      const newStatus: InvoiceStatus = newPaidAmount >= data.invoice_total ? 'paid' : 'partially_paid';

      const { error: updateError } = await supabase
        .from('vendor_invoices')
        .update({ paid_amount: newPaidAmount, status: newStatus })
        .eq('id', data.vendor_invoice_id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor_invoices'] });
      queryClient.invalidateQueries({ queryKey: ['vendor_payments'] });
      toast({ title: 'Payment recorded successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to record payment', description: error.message, variant: 'destructive' });
    },
  });
};
