import { useCallback } from "react";

export interface ErrorInfo {
  message: string;
  stack?: string;
  component?: string;
  action?: string;
  userId?: string;
  timestamp: Date;
  context?: Record<string, any>;
}

export const useErrorLogger = () => {
  const logError = useCallback((error: Error | string, context?: Record<string, any>) => {
    const errorInfo: ErrorInfo = {
      message: typeof error === "string" ? error : error.message,
      stack: typeof error === "string" ? undefined : error.stack,
      timestamp: new Date(),
      context,
    };

    // Log to console
    console.error("Error logged:", errorInfo);

    // In a real app, you would send this to a logging service
    // sendToLoggingService(errorInfo);

    // Store in localStorage for debugging (in development)
    if (process.env.NODE_ENV === "development") {
      const existingErrors = JSON.parse(localStorage.getItem("app_errors") || "[]");
      existingErrors.push(errorInfo);
      localStorage.setItem("app_errors", JSON.stringify(existingErrors.slice(-50))); // Keep last 50
    }
  }, []);

  const logApiError = useCallback((error: any, endpoint: string, method: string) => {
    logError(error, {
      type: "api_error",
      endpoint,
      method,
      status: error?.status || error?.response?.status,
      response: error?.response?.data,
    });
  }, [logError]);

  const logComponentError = useCallback((error: Error, componentName: string, action?: string) => {
    logError(error, {
      type: "component_error",
      component: componentName,
      action,
    });
  }, [logError]);

  return { logError, logApiError, logComponentError };
};