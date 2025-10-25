'use client';

import {
  useQuery,
  useMutation,
  UseQueryOptions,
  UseMutationOptions,
  QueryKey,
} from '@tanstack/react-query';
import { handleApiError, ErrorContext } from '@/lib/error-handler';

type QueryKeyValue = readonly unknown[];
type QueryKeyFunction = (...args: any[]) => QueryKeyValue;
type QueryKeyItem = QueryKeyValue | QueryKeyFunction;

export const createQueryKeys = <T extends Record<string, QueryKeyItem>>(
  keys: T,
): T => keys;

export function createQueryHook<
  TData,
  TError = Error,
  TQueryKey extends QueryKey = QueryKey,
>(
  queryKey: TQueryKey,
  queryFn: () => Promise<TData>,
  options?: Omit<
    UseQueryOptions<TData, TError, TData, TQueryKey>,
    'queryKey' | 'queryFn'
  >,
) {
  return (
    customOptions?: Omit<
      UseQueryOptions<TData, TError, TData, TQueryKey>,
      'queryKey' | 'queryFn'
    >,
  ) => {
    return useQuery<TData, TError, TData, TQueryKey>({
      queryKey,
      queryFn,
      ...options,
      ...customOptions,
    });
  };
}

export function createMutationHook<
  TData,
  TVariables,
  TError = Error,
  TContext = unknown,
>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: Omit<
    UseMutationOptions<TData, TError, TVariables, TContext>,
    'mutationFn'
  > & {
    errorContext?: ErrorContext;
  },
) {
  return (
    customOptions?: Omit<
      UseMutationOptions<TData, TError, TVariables, TContext>,
      'mutationFn'
    > & {
      errorContext?: ErrorContext;
    },
  ) => {
    const { errorContext: baseErrorContext, onError: baseOnError, ...baseOptions } = options || {};
    const { errorContext: customErrorContext, onError: customOnError, ...customMutationOptions } = customOptions || {};
    
    return useMutation<TData, TError, TVariables, TContext>({
      mutationFn,
      onError: (error, variables, context) => {
        const errorContext = customErrorContext || baseErrorContext;
        if (!customOnError && !baseOnError) {
          handleApiError(error, errorContext);
        }
        if (baseOnError) {
          (baseOnError as any)(error, variables, context);
        }
        if (customOnError) {
          (customOnError as any)(error, variables, context);
        }
      },
      ...baseOptions,
      ...customMutationOptions,
    });
  };
}
