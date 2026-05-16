import { ErrorInfo } from "@/hooks/useErrorLogger";

class ErrorLoggerService {
  private errors: ErrorInfo[] = [];
  private maxErrors = 100;

  log(error: ErrorInfo) {
    // Filter out VS Code injected element errors
    if (this.isVscodeInjectedError(error)) {
      return;
    }

    this.errors.push(error);
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // In development, also log to console with more detail
    if (process.env.NODE_ENV === "development") {
      console.group(`🚨 Error: ${error.message}`);
      console.error("Stack:", error.stack);
      console.log("Context:", error.context);
      console.log("Timestamp:", error.timestamp);
      console.groupEnd();
    }

    // Send to external logging service (uncomment when you have one)
    // this.sendToExternalService(error);
  }

  private isVscodeInjectedError(error: ErrorInfo): boolean {
    // Skip errors related to VS Code injected elements
    if (error.message?.includes('Notifications alt+T')) return true;
    if (error.context?.filename?.includes('vscode')) return true;
    if (error.context?.type === 'global_error' &&
        (error.context.filename?.includes('extension') ||
         error.context.filename?.includes('vscode'))) return true;
    if (error.stack?.includes('vscode') || error.stack?.includes('extension')) return true;

    return false;
  }

  getErrors(): ErrorInfo[] {
    return [...this.errors];
  }

  clearErrors() {
    this.errors = [];
  }

  getErrorsByType(type: string): ErrorInfo[] {
    return this.errors.filter(error => error.context?.type === type);
  }

  getRecentErrors(minutes: number = 5): ErrorInfo[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.errors.filter(error => error.timestamp > cutoff);
  }

  private sendToExternalService(error: ErrorInfo) {
    // Example: Send to Sentry, LogRocket, or your own logging API
    // fetch('/api/log-error', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(error)
    // }).catch(() => {
    //   // Ignore logging errors to prevent infinite loops
    // });
  }
}

export const errorLogger = new ErrorLoggerService();

// Global error handler for unhandled errors
window.addEventListener('error', (event) => {
  // Skip errors from VS Code injected elements or extensions
  if (event.target && (event.target as Element).closest('[data-vscode-extension]') ||
      event.filename?.includes('vscode') ||
      event.message?.includes('Notifications alt+T')) {
    return;
  }

  errorLogger.log({
    message: event.message,
    stack: event.error?.stack,
    timestamp: new Date(),
    context: {
      type: 'global_error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    }
  });
});

// Global handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  // Skip VS Code related rejections
  if (event.reason?.message?.includes('Notifications alt+T') ||
      event.reason?.stack?.includes('vscode')) {
    return;
  }

  errorLogger.log({
    message: event.reason?.message || 'Unhandled promise rejection',
    stack: event.reason?.stack,
    timestamp: new Date(),
    context: {
      type: 'unhandled_rejection',
      reason: event.reason,
    }
  });
});