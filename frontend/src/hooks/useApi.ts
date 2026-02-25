import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { AxiosError } from 'axios';

interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function useApiGet<T>(
  key: (string | number | undefined)[],
  url: string,
  params?: Record<string, unknown>,
  options?: Omit<UseQueryOptions<T, AxiosError<ApiError>>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<T, AxiosError<ApiError>>({
    queryKey: key,
    queryFn: async () => {
      const { data } = await apiClient.get(url, { params });
      return data.data ?? data;
    },
    ...options,
  });
}

export function useApiList<T>(
  key: (string | number | undefined)[],
  url: string,
  params?: Record<string, unknown>,
  options?: Omit<
    UseQueryOptions<PaginatedResponse<T>, AxiosError<ApiError>>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery<PaginatedResponse<T>, AxiosError<ApiError>>({
    queryKey: [...key, params],
    queryFn: async () => {
      const { data } = await apiClient.get(url, { params });
      return {
        data: data.data,
        pagination: data.pagination,
      };
    },
    ...options,
  });
}

export function useApiMutation<TData = unknown, TVariables = unknown>(
  method: 'post' | 'put' | 'patch' | 'delete',
  url: string | ((variables: TVariables) => string),
  invalidateKeys?: (string | undefined)[][],
  options?: Omit<
    UseMutationOptions<TData, AxiosError<ApiError>, TVariables>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation<TData, AxiosError<ApiError>, TVariables>({
    mutationFn: async (variables) => {
      const resolvedUrl = typeof url === 'function' ? url(variables) : url;
      const { data } =
        method === 'delete'
          ? await apiClient.delete(resolvedUrl)
          : await apiClient[method](resolvedUrl, variables);
      return data.data ?? data;
    },
    onSuccess: (...args) => {
      if (invalidateKeys) {
        invalidateKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }
      options?.onSuccess?.(...args);
    },
    ...options,
    // Restore onSuccess since we spread options after
  });
}

export type { ApiError, PaginatedResponse };
