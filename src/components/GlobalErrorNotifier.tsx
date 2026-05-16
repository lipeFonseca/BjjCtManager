import { useEffect } from "react";
import { errorLogger } from "@/lib/errorLogger";
import { toast } from "sonner";

export const GlobalErrorNotifier = () => {
  useEffect(() => {
    let lastErrorCount = 0;

    const checkForNewErrors = () => {
      const errors = errorLogger.getErrors();
      const newErrors = errors.filter(error =>
        error.timestamp > new Date(Date.now() - 10000) // Last 10 seconds
      );

      if (newErrors.length > lastErrorCount) {
        const latestError = newErrors[newErrors.length - 1];

        // Only show toast for certain types of errors
        if (latestError.context?.type === 'api_error' ||
            latestError.context?.type === 'mutation_error' ||
            latestError.context?.type === 'component_error') {
          toast.error("Ocorreu uma instabilidade. Tente novamente.", {
            description: "Se o problema continuar, recarregue a pagina.",
          });
        }
      }

      lastErrorCount = newErrors.length;
    };

    const interval = setInterval(checkForNewErrors, 2000); // Check every 2 seconds

    return () => clearInterval(interval);
  }, []);

  return null; // This component doesn't render anything
};
