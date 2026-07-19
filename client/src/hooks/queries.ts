import { useQuery } from '@tanstack/react-query';
import { API_URL } from '../config/api';
import { apiFetch } from '../services/api';
import { tClient, T } from '../i18n/clientTranslation';

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
      if (!json.success) throw new Error(json.message || tClient(T.BOOKINGS.LOAD_ERROR));
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
      const json = await res.json();
      if (!res.ok) {
        throw new Error(typeof json?.error === 'string' ? json.error : tClient(T.CALENDAR.LOAD_ERROR));
      }
      if (Array.isArray(json)) return json;
      if (Array.isArray(json?.data)) return json.data;
      return [];
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
      if (!json.success) throw new Error(json.message || tClient(T.FEEDBACK.LOAD_ERROR));
      return { data: json.data, pagination: json.pagination as PaginationMeta };
    },
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  });
}

export interface FeedbackStatsData {
  period: { year: number | null; month: number | null; allYears: boolean };
  availableYears: number[];
  averages: {
    combined: number | null;
    food: number | null;
    service: number | null;
    venue: number | null;
  };
  counts: {
    completedFeedbacks: number;
    totalEventsFinished: number;
    pendingFeedbacks: number;
    notSentEvents: number;
    lowScore: number;
    excellent: number;
    expectedSides: number;
  };
  responseRate: number | null;
  byEventType: { eventType: string; average: number | null; count: number }[];
  byMonth: { month: number; label: string; average: number | null; count: number }[];
  byYear: { year: number; average: number | null; count: number }[];
  categoryComparison: { category: string; average: number | null }[];
  recentLow: {
    eventCode: string;
    eventDate: string | null;
    eventType: string;
    clients: string;
    clientSide: string;
    score: number;
    comment: string | null;
  }[];
  recentComments: {
    eventCode: string;
    eventDate: string | null;
    comment: string;
    score: number | null;
  }[];
}

export function useFeedbackStatsQuery(year: string, month: string) {
  return useQuery({
    queryKey: ['feedback-stats', year, month],
    queryFn: async (): Promise<FeedbackStatsData> => {
      let url = `${API_URL}/feedback/admin/stats?year=${year}`;
      if (month) url += `&month=${month}`;
      const res = await apiFetch(url);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || tClient(T.FEEDBACK.STATS_LOAD_ERROR));
      return json.data as FeedbackStatsData;
    },
  });
}

export function useGlobalSettingsQuery() {
  return useQuery({
    queryKey: ['settings', 'global'],
    queryFn: async () => {
      const res = await apiFetch(`${API_URL}/settings/global`);
      return res.json();
    },
    staleTime: 0,
  });
}

export function useExtrasQuery() {
  return useQuery({
    queryKey: ['settings', 'extras'],
    queryFn: async () => {
      const res = await apiFetch(`${API_URL}/settings/extras`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });
}

export function useStaffQuery() {
  return useQuery({
    queryKey: ['settings', 'staff'],
    queryFn: async () => {
      const res = await apiFetch(`${API_URL}/settings/staff`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });
}

export function useKashrutQuery() {
  return useQuery({
    queryKey: ['kashrut'],
    queryFn: async () => {
      const res = await apiFetch(`${API_URL}/kashrut`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });
}

export function useEventFormsQuery() {
  return useQuery({
    queryKey: ['event-forms'],
    queryFn: async () => {
      const res = await apiFetch(`${API_URL}/event-forms`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });
}

export function useCancellationStatsQuery(year: string, month: string) {
  return useQuery({
    queryKey: ['cancellation-stats', year, month],
    queryFn: async () => {
      let url = `${API_URL}/bookings/stats/cancellations?year=${year}`;
      if (month) url += `&month=${month}`;
      const res = await apiFetch(url);
      const data = await res.json();
      if (!data.success) throw new Error(tClient(T.OPTIONS.STATS_LOAD_ERROR));
      return data.data as { reason: string; count: number }[];
    },
  });
}

export function useMenuQuery() {
  return useQuery({
    queryKey: ['menu'],
    queryFn: async () => {
      const res = await apiFetch(`${API_URL}/menu`);
      const json = await res.json();
      return json?.data ?? json;
    },
  });
}

export interface CheckInQueryData {
  checkIn: Record<string, unknown>;
  booking: Record<string, unknown>;
  eventForm: Record<string, unknown> | null;
}

export function useCheckInQuery(bookingId: string | null | undefined) {
  return useQuery({
    queryKey: ['check-in', bookingId],
    queryFn: async (): Promise<CheckInQueryData> => {
      const res = await apiFetch(`${API_URL}/check-in/${bookingId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || tClient(T.LIVE_EVENT.FORM_LOAD_ERROR));
      return json.data;
    },
    enabled: Boolean(bookingId),
  });
}
