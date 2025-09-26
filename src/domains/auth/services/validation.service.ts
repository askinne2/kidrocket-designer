/**
 * Validation Service
 * 
 * Handles input validation for authentication operations.
 * Uses Joi for schema validation with custom rules for security.
 */

import Joi from 'joi';
import { injectable } from 'inversify';
import { 
  RegisterRequest, 
  LoginRequest, 
  ChangePasswordRequest,
  ResetPasswordRequest,
  ValidationResult,
  ValidationError 
} from '@/shared/types/auth';

@injectable()
export class ValidationService {
  private readonly emailSchema = Joi.string()
    .email({ tlds: { allow: false } }) // Allow all TLDs
    .max(254) // RFC 5321 limit
    .required()
    .messages({
      'string.email': 'Please enter a valid email address',
      'string.empty': 'Email is required',
      'string.max': 'Email address is too long'
    });

  private readonly usernameSchema = Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required()
    .messages({
      'string.alphanum': 'Username can only contain letters and numbers',
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username cannot be longer than 30 characters',
      'string.empty': 'Username is required'
    });

  private readonly passwordSchema = Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password cannot be longer than 128 characters',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'string.empty': 'Password is required'
    });

  private readonly displayNameSchema = Joi.string()
    .min(1)
    .max(100)
    .pattern(/^[a-zA-Z0-9\s\-_.]+$/)
    .required()
    .messages({
      'string.min': 'Display name cannot be empty',
      'string.max': 'Display name cannot be longer than 100 characters',
      'string.pattern.base': 'Display name can only contain letters, numbers, spaces, hyphens, underscores, and periods',
      'string.empty': 'Display name is required'
    });

  private readonly dateOfBirthSchema = Joi.date()
    .max('now')
    .min(new Date('1900-01-01'))
    .optional()
    .messages({
      'date.max': 'Date of birth cannot be in the future',
      'date.min': 'Please enter a valid date of birth',
      'date.base': 'Please enter a valid date'
    });

  /**
   * Validate user registration data
   */
  async validateRegistration(data: RegisterRequest): Promise<ValidationResult> {
    const schema = Joi.object({
      email: this.emailSchema,
      username: this.usernameSchema,
      displayName: this.displayNameSchema,
      password: this.passwordSchema,
      dateOfBirth: this.dateOfBirthSchema,
      parentEmail: Joi.when('dateOfBirth', {
        is: Joi.date().max(this.getDateYearsAgo(13)),
        then: this.emailSchema.required().messages({
          'any.required': 'Parent email is required for users under 13'
        }),
        otherwise: this.emailSchema.optional()
      }),
      acceptsTerms: Joi.boolean()
        .valid(true)
        .required()
        .messages({
          'any.only': 'You must accept the terms and conditions',
          'any.required': 'You must accept the terms and conditions'
        })
    });

    return this.validateWithSchema(schema, data);
  }

  /**
   * Validate user login data
   */
  async validateLogin(data: LoginRequest): Promise<ValidationResult> {
    const schema = Joi.object({
      email: this.emailSchema,
      password: Joi.string()
        .required()
        .messages({
          'string.empty': 'Password is required'
        }),
      rememberMe: Joi.boolean().optional()
    });

    return this.validateWithSchema(schema, data);
  }

  /**
   * Validate password change data
   */
  async validatePasswordChange(data: ChangePasswordRequest): Promise<ValidationResult> {
    const schema = Joi.object({
      currentPassword: Joi.string()
        .required()
        .messages({
          'string.empty': 'Current password is required'
        }),
      newPassword: this.passwordSchema
    }).custom((value, helpers) => {
      if (value.currentPassword === value.newPassword) {
        return helpers.error('password.same');
      }
      return value;
    }).messages({
      'password.same': 'New password must be different from current password'
    });

    return this.validateWithSchema(schema, data);
  }

  /**
   * Validate password reset data
   */
  async validatePasswordReset(data: ResetPasswordRequest): Promise<ValidationResult> {
    const schema = Joi.object({
      token: Joi.string()
        .required()
        .messages({
          'string.empty': 'Reset token is required'
        }),
      newPassword: this.passwordSchema
    });

    return this.validateWithSchema(schema, data);
  }

  /**
   * Validate email address format
   */
  async validateEmail(email: string): Promise<ValidationResult> {
    return this.validateWithSchema(this.emailSchema, email);
  }

  /**
   * Validate username format and availability
   */
  async validateUsername(username: string): Promise<ValidationResult> {
    const result = await this.validateWithSchema(this.usernameSchema, username);
    
    if (result.isValid) {
      // Check for reserved usernames
      const reservedUsernames = [
        'admin', 'administrator', 'root', 'system', 'api', 'www', 'mail',
        'support', 'help', 'info', 'contact', 'sales', 'marketing',
        'kidrocket', 'rocket', 'user', 'guest', 'anonymous', 'null', 'undefined'
      ];

      if (reservedUsernames.includes(username.toLowerCase())) {
        result.isValid = false;
        result.errors.push({
          field: 'username',
          message: 'This username is reserved and cannot be used',
          code: 'USERNAME_RESERVED'
        });
      }
    }

    return result;
  }

  /**
   * Validate password strength
   */
  async validatePasswordStrength(password: string): Promise<ValidationResult & { strength: 'weak' | 'medium' | 'strong' }> {
    const result = await this.validateWithSchema(this.passwordSchema, password);
    
    // Calculate password strength
    let strength: 'weak' | 'medium' | 'strong' = 'weak';
    let score = 0;

    // Length bonus
    if (password.length >= 12) score += 2;
    else if (password.length >= 8) score += 1;

    // Character variety
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[@$!%*?&]/.test(password)) score += 1;
    if (/[^A-Za-z0-9@$!%*?&]/.test(password)) score += 1; // Other special chars

    // Patterns (reduce score for common patterns)
    if (/(.)\1{2,}/.test(password)) score -= 1; // Repeated characters
    if (/123|abc|qwe/i.test(password)) score -= 1; // Sequential patterns

    if (score >= 6) strength = 'strong';
    else if (score >= 4) strength = 'medium';

    return { ...result, strength };
  }

  /**
   * Validate age compliance (COPPA)
   */
  validateAge(dateOfBirth: Date): { isMinor: boolean; requiresParentalConsent: boolean; age: number } {
    const age = this.calculateAge(dateOfBirth);
    
    return {
      age,
      isMinor: age < 18,
      requiresParentalConsent: age < 13 // COPPA compliance
    };
  }

  /**
   * Sanitize input data
   */
  sanitizeInput(data: any): any {
    if (typeof data === 'string') {
      return data.trim();
    }
    
    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }
    
    return data;
  }

  /**
   * Check for common password patterns that should be avoided
   */
  checkPasswordPatterns(password: string): string[] {
    const warnings: string[] = [];

    // Common patterns
    const patterns = [
      { regex: /password/i, message: 'Avoid using "password" in your password' },
      { regex: /123456/, message: 'Avoid sequential numbers' },
      { regex: /qwerty/i, message: 'Avoid keyboard patterns like "qwerty"' },
      { regex: /(.)\1{3,}/, message: 'Avoid repeating the same character multiple times' },
      { regex: /^[a-zA-Z]+$/, message: 'Consider adding numbers or special characters' },
      { regex: /^[0-9]+$/, message: 'Consider adding letters or special characters' }
    ];

    patterns.forEach(pattern => {
      if (pattern.regex.test(password)) {
        warnings.push(pattern.message);
      }
    });

    return warnings;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async validateWithSchema(schema: Joi.Schema, data: any): Promise<ValidationResult> {
    try {
      await schema.validateAsync(data, { abortEarly: false });
      return { isValid: true, errors: [] };
    } catch (error) {
      if (Joi.isError(error)) {
        const errors: ValidationError[] = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          code: detail.type.toUpperCase().replace(/\./g, '_')
        }));

        return { isValid: false, errors };
      }
      
      throw error;
    }
  }

  private calculateAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  private getDateYearsAgo(years: number): Date {
    const date = new Date();
    date.setFullYear(date.getFullYear() - years);
    return date;
  }
}

// TODO: Add custom validation for profanity filtering in usernames/display names
// TODO: Implement email domain blacklisting/whitelisting
// TODO: Add validation for international characters in names
// TODO: Implement rate limiting for validation attempts
// TODO: Add validation caching for expensive operations
// TODO: Implement custom validation rules for educational content appropriateness
