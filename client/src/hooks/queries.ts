import { useQuery } from '@tanstack/react-query';
import { API_URL } from '../config/api';
import { apiFetch } from '../services/api';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface BookingsParams {
  status?: string;
  page?: number;
  limit?: number;
  search?: string;
}

interface BookingsResponse {
  data: unknown[];
  pagination: PaginationMeta;
}

export function useBookingsQuery(params: BookingsParams) {
  return useQuery({
    queryKey: ['bookings', params],
    queryFn: async (): Promise<BookingsResponse> => {
      const qs = new URLSearchParams();
      if (params.status) qs.set('status', params.status);
      if (params.page) qs.set('page', String(params.page));
      if (params.limit) qs.set('limit', String(params.limit));
      if (params.search) qs.set('search', params.search);

      const res = await apiFetch(`${API_URL}/bookings?${qs}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'שגיאה בטעינת הזמנות');
      return { data: json.data, pagination: json.pagination };
    },
  });
}

export function useCalendarDatesQuery(start: string, end: string, eventType: string) {
  return useQuery({
    queryKey: ['calendar', start, end, eventType],
    queryFn: async () => {
      const qs = new URLSearchParams({ start, end, eventType });
      const res = await apiFetch(`${API_URL}/calendar/dates?${qs}`);
      return res.json();
    },
    enabled: Boolean(start && end),
  });
}

export function useFeedbackAdminQuery(page: number, limit = 20) {
  return useQuery({
    queryKey: ['feedback-admin', page, limit],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
      const res = await apiFetch(`${API_URL}/feedback/admin/list?${qs}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'שגיאה בטעינת משובים');
      return { data: json.data, pagination: json.pagination as PaginationMeta };
    },
  });
}
