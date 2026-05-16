import { errorLogger } from "@/lib/errorLogger";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export const validateEmail = (email: string): ValidationResult => {
  const errors: string[] = [];

  if (!email) {
    errors.push("Email é obrigatório");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Formato de email inválido");
  }

  return { isValid: errors.length === 0, errors };
};

export const validatePhone = (phone: string): ValidationResult => {
  const errors: string[] = [];

  if (!phone) {
    errors.push("Telefone é obrigatório");
  } else {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      errors.push("Telefone deve ter 10 ou 11 dígitos");
    }
  }

  return { isValid: errors.length === 0, errors };
};

export const validateRequired = (value: any, fieldName: string): ValidationResult => {
  const errors: string[] = [];

  if (value === null || value === undefined || value === '') {
    errors.push(`${fieldName} é obrigatório`);
  }

  return { isValid: errors.length === 0, errors };
};

export const validateAndLog = (
  validations: ValidationResult[],
  context: string
): ValidationResult => {
  const allErrors = validations.flatMap(v => v.errors);
  const isValid = allErrors.length === 0;

  if (!isValid) {
    errorLogger.log({
      message: `Erro de validação em ${context}`,
      timestamp: new Date(),
      context: {
        type: 'validation_error',
        component: context,
        errors: allErrors,
      }
    });
  }

  return { isValid, errors: allErrors };
};

export const safeValidate = <T>(
  validator: (data: T) => ValidationResult,
  data: T,
  context: string
): ValidationResult => {
  try {
    return validator(data);
  } catch (error: any) {
    errorLogger.log({
      message: `Erro durante validação: ${error.message}`,
      stack: error.stack,
      timestamp: new Date(),
      context: {
        type: 'validation_error',
        component: context,
        originalError: error.message,
      }
    });

    return { isValid: false, errors: [`Erro interno de validação: ${error.message}`] };
  }
};