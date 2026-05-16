import { useCallback } from "react";
import { useErrorLogger } from "./useErrorLogger";

export const useApiWithErrorHandling = () => {
  const { logApiError } = useErrorLogger();

  const apiCall = useCallback(async <T>(
    apiFunction: () => Promise<T>,
    context?: { endpoint?: string; method?: string; description?: string }
  ): Promise<T | null> => {
    try {
      return await apiFunction();
    } catch (error: any) {
      logApiError(error, context?.endpoint || 'unknown', context?.method || 'unknown');

      // Re-throw the error so calling code can handle it
      throw error;
    }
  }, [logApiError]);

  const safeApiCall = useCallback(async <T>(
    apiFunction: () => Promise<T>,
    fallbackValue: T,
    context?: { endpoint?: string; method?: string; description?: string }
  ): Promise<T> => {
    try {
      return await apiFunction();
    } catch (error: any) {
      logApiError(error, context?.endpoint || 'unknown', context?.method || 'unknown');
      return fallbackValue;
    }
  }, [logApiError]);

  return { apiCall, safeApiCall };
};