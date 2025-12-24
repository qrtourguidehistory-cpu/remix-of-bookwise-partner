import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface DailySalesSummary {
  id: string;
  business_id: string;
  summary_date: string;
  total_sales: number;
  total_transactions: number;
  cash_total: number;
  card_total: number;
  online_total: number;
  tips_total: number;
  refunds_total: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDailySalesSummaryInput {
  summary_date: string;
  total_sales?: number;
  total_transactions?: number;
  cash_total?: number;
  card_total?: number;
  online_total?: number;
  tips_total?: number;
  refunds_total?: number;
  notes?: string;
}

/**
 * Hook for managing daily sales summaries.
 * Note: This hook generates summaries from the sales table on-the-fly
 * since the daily_sales_summaries table doesn't exist yet.
 */
export function useDailySalesSummaries() {
  const { profile } = useAuth();
  const [summaries, setSummaries] = useState<DailySalesSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummaries = async (startDate?: string, endDate?: string) => {
    if (!profile?.business_id) {
      setSummaries([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Generate summaries from sales table since daily_sales_summaries table doesn't exist
      let query = supabase
        .from('sales')
        .select('sale_date, price_usd, tip_amount, payment_method')
        .eq('business_id', profile.business_id)
        .order('sale_date', { ascending: false });

      if (startDate) {
        query = query.gte('sale_date', startDate);
      }

      if (endDate) {
        query = query.lte('sale_date', endDate);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Group sales by date and calculate summaries
      const summaryMap = new Map<string, DailySalesSummary>();
      
      (data || []).forEach((sale) => {
        const date = sale.sale_date;
        if (!summaryMap.has(date)) {
          summaryMap.set(date, {
            id: date, // Use date as ID since no real table
            business_id: profile.business_id!,
            summary_date: date,
            total_sales: 0,
            total_transactions: 0,
            cash_total: 0,
            card_total: 0,
            online_total: 0,
            tips_total: 0,
            refunds_total: 0,
            notes: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
        
        const summary = summaryMap.get(date)!;
        const amount = Number(sale.price_usd) || 0;
        const tip = Number(sale.tip_amount) || 0;
        
        summary.total_sales += amount;
        summary.total_transactions += 1;
        summary.tips_total += tip;
        
        switch (sale.payment_method) {
          case 'cash':
            summary.cash_total += amount;
            break;
          case 'card':
            summary.card_total += amount;
            break;
          case 'online':
            summary.online_total += amount;
            break;
        }
      });

      setSummaries(Array.from(summaryMap.values()));
    } catch (err: any) {
      setError(err.message || 'Error fetching summaries');
      toast.error('Error al cargar resúmenes');
    } finally {
      setLoading(false);
    }
  };

  const getSummaryByDate = async (date: string): Promise<DailySalesSummary | null> => {
    if (!profile?.business_id) return null;

    try {
      // Generate summary from sales for the specific date
      const { data: sales, error: fetchError } = await supabase
        .from('sales')
        .select('price_usd, tip_amount, payment_method')
        .eq('business_id', profile.business_id)
        .eq('sale_date', date);

      if (fetchError) throw fetchError;

      if (!sales || sales.length === 0) return null;

      const summary: DailySalesSummary = {
        id: date,
        business_id: profile.business_id,
        summary_date: date,
        total_sales: 0,
        total_transactions: sales.length,
        cash_total: 0,
        card_total: 0,
        online_total: 0,
        tips_total: 0,
        refunds_total: 0,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      sales.forEach((sale) => {
        const amount = Number(sale.price_usd) || 0;
        const tip = Number(sale.tip_amount) || 0;
        
        summary.total_sales += amount;
        summary.tips_total += tip;
        
        switch (sale.payment_method) {
          case 'cash':
            summary.cash_total += amount;
            break;
          case 'card':
            summary.card_total += amount;
            break;
          case 'online':
            summary.online_total += amount;
            break;
        }
      });

      return summary;
    } catch (err: any) {
      console.error('Error fetching summary by date:', err);
      return null;
    }
  };

  // These functions are stubs since we don't have a real table
  const createSummary = async (input: CreateDailySalesSummaryInput): Promise<DailySalesSummary | null> => {
    toast.info('Las estadísticas se generan automáticamente de las ventas');
    return null;
  };

  const updateSummary = async (
    id: string,
    input: Partial<CreateDailySalesSummaryInput>
  ): Promise<DailySalesSummary | null> => {
    toast.info('Las estadísticas se generan automáticamente de las ventas');
    return null;
  };

  const deleteSummary = async (id: string): Promise<boolean> => {
    toast.info('Las estadísticas se generan automáticamente de las ventas');
    return false;
  };

  const generateSummaryFromSales = async (date: string): Promise<CreateDailySalesSummaryInput | null> => {
    if (!profile?.business_id) return null;

    try {
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('price_usd, tip_amount, payment_method')
        .eq('business_id', profile.business_id)
        .eq('sale_date', date);

      if (salesError) throw salesError;

      const summary: CreateDailySalesSummaryInput = {
        summary_date: date,
        total_sales: 0,
        total_transactions: sales?.length || 0,
        cash_total: 0,
        card_total: 0,
        online_total: 0,
        tips_total: 0,
        refunds_total: 0,
      };

      sales?.forEach((sale) => {
        const amount = Number(sale.price_usd) || 0;
        const tip = Number(sale.tip_amount) || 0;

        summary.total_sales! += amount;
        summary.tips_total! += tip;

        switch (sale.payment_method) {
          case 'cash':
            summary.cash_total! += amount;
            break;
          case 'card':
            summary.card_total! += amount;
            break;
          case 'online':
            summary.online_total! += amount;
            break;
        }
      });

      return summary;
    } catch (err: any) {
      console.error('Error generating summary from sales:', err);
      return null;
    }
  };

  useEffect(() => {
    if (profile?.business_id) {
      fetchSummaries();
    }
  }, [profile?.business_id]);

  return {
    summaries,
    loading,
    error,
    fetchSummaries,
    getSummaryByDate,
    createSummary,
    updateSummary,
    deleteSummary,
    generateSummaryFromSales,
  };
}
