/**
 * Rocket Validation Service
 * 
 * Validation logic for rocket configurations and requests.
 * Uses Joi schemas similar to the auth module validation.
 */

import Joi from 'joi';
import { 
  CreateRocketRequest, 
  UpdateRocketRequest, 
  RocketConfig,
  RocketMaterial,
  NoseConeType,
  EngineType,
  RecoveryType,
  ComplexityLevel,
  ROCKET_CONSTRAINTS
} from '../../../shared/types/rocket';

export class ValidationService {
  
  // Joi schemas for validation
  private readonly rocketConfigSchema = Joi.object({
    body: Joi.object({
      length: Joi.number()
        .min(ROCKET_CONSTRAINTS.MIN_BODY_LENGTH)
        .max(ROCKET_CONSTRAINTS.MAX_BODY_LENGTH)
        .required()
        .messages({
          'number.min': `Body length must be at least ${ROCKET_CONSTRAINTS.MIN_BODY_LENGTH}m`,
          'number.max': `Body length cannot exceed ${ROCKET_CONSTRAINTS.MAX_BODY_LENGTH}m`
        }),
      diameter: Joi.number()
        .min(ROCKET_CONSTRAINTS.MIN_BODY_DIAMETER)
        .max(ROCKET_CONSTRAINTS.MAX_BODY_DIAMETER)
        .required()
        .messages({
          'number.min': `Body diameter must be at least ${ROCKET_CONSTRAINTS.MIN_BODY_DIAMETER}m`,
          'number.max': `Body diameter cannot exceed ${ROCKET_CONSTRAINTS.MAX_BODY_DIAMETER}m`
        }),
      mass: Joi.number()
        .min(ROCKET_CONSTRAINTS.MIN_MASS)
        .max(ROCKET_CONSTRAINTS.MAX_MASS)
        .required()
        .messages({
          'number.min': `Body mass must be at least ${ROCKET_CONSTRAINTS.MIN_MASS}kg`,
          'number.max': `Body mass cannot exceed ${ROCKET_CONSTRAINTS.MAX_MASS}kg`
        }),
      material: Joi.string()
        .valid(...Object.values(RocketMaterial))
        .required(),
      fineness: Joi.number().min(1).max(50).required()
    }).required(),

    noseCone: Joi.object({
      type: Joi.string().valid(...Object.values(NoseConeType)).required(),
      length: Joi.number().min(0.01).max(2).required(),
      mass: Joi.number().min(ROCKET_CONSTRAINTS.MIN_MASS).max(ROCKET_CONSTRAINTS.MAX_MASS).required(),
      material: Joi.string().valid(...Object.values(RocketMaterial)).required()
    }).required(),

    fins: Joi.object({
      count: Joi.number()
        .integer()
        .min(ROCKET_CONSTRAINTS.MIN_FINS)
        .max(ROCKET_CONSTRAINTS.MAX_FINS)
        .required()
        .messages({
          'number.min': `Must have at least ${ROCKET_CONSTRAINTS.MIN_FINS} fins`,
          'number.max': `Cannot have more than ${ROCKET_CONSTRAINTS.MAX_FINS} fins`
        }),
      span: Joi.number().min(0.01).max(0.5).required(),
      rootChord: Joi.number().min(0.01).max(0.3).required(),
      tipChord: Joi.number().min(0.005).max(0.2).required(),
      sweepAngle: Joi.number().min(0).max(60).required(),
      thickness: Joi.number().min(0.001).max(0.02).required(),
      material: Joi.string().valid(...Object.values(RocketMaterial)).required(),
      mass: Joi.number().min(ROCKET_CONSTRAINTS.MIN_MASS).max(ROCKET_CONSTRAINTS.MAX_MASS).required()
    }).required(),

    engine: Joi.object({
      type: Joi.string().valid(...Object.values(EngineType)).required(),
      thrust: Joi.number()
        .min(ROCKET_CONSTRAINTS.MIN_THRUST)
        .max(ROCKET_CONSTRAINTS.MAX_THRUST)
        .required()
        .messages({
          'number.min': `Thrust must be at least ${ROCKET_CONSTRAINTS.MIN_THRUST}N`,
          'number.max': `Thrust cannot exceed ${ROCKET_CONSTRAINTS.MAX_THRUST}N`
        }),
      burnTime: Joi.number()
        .min(ROCKET_CONSTRAINTS.MIN_BURN_TIME)
        .max(ROCKET_CONSTRAINTS.MAX_BURN_TIME)
        .required()
        .messages({
          'number.min': `Burn time must be at least ${ROCKET_CONSTRAINTS.MIN_BURN_TIME}s`,
          'number.max': `Burn time cannot exceed ${ROCKET_CONSTRAINTS.MAX_BURN_TIME}s`
        }),
      specificImpulse: Joi.number().min(50).max(500).required(),
      propellantMass: Joi.number().min(ROCKET_CONSTRAINTS.MIN_MASS).max(ROCKET_CONSTRAINTS.MAX_MASS).required(),
      totalMass: Joi.number().min(ROCKET_CONSTRAINTS.MIN_MASS).max(ROCKET_CONSTRAINTS.MAX_MASS).required()
    }).required(),

    recovery: Joi.object({
      type: Joi.string().valid(...Object.values(RecoveryType)).required(),
      deploymentAltitude: Joi.number().min(10).max(1000).required(),
      parachuteDiameter: Joi.number().min(0.1).max(5).optional(),
      chuteCount: Joi.number().integer().min(1).max(3).optional(),
      mass: Joi.number().min(ROCKET_CONSTRAINTS.MIN_MASS).max(ROCKET_CONSTRAINTS.MAX_MASS).required()
    }).required(),

    launch: Joi.object({
      launchAngle: Joi.number().min(0).max(15).required(),
      launchRodLength: Joi.number().min(0.3).max(5).required(),
      windSpeed: Joi.number().min(0).max(30).optional(),
      windDirection: Joi.number().min(0).max(360).optional()
    }).required()
  });

  private readonly createRocketSchema = Joi.object({
    name: Joi.string()
      .trim()
      .min(ROCKET_CONSTRAINTS.NAME_MIN_LENGTH)
      .max(ROCKET_CONSTRAINTS.NAME_MAX_LENGTH)
      .required()
      .messages({
        'string.min': `Name must be at least ${ROCKET_CONSTRAINTS.NAME_MIN_LENGTH} characters`,
        'string.max': `Name cannot exceed ${ROCKET_CONSTRAINTS.NAME_MAX_LENGTH} characters`
      }),
    
    description: Joi.string()
      .trim()
      .max(ROCKET_CONSTRAINTS.DESCRIPTION_MAX_LENGTH)
      .optional()
      .allow('')
      .messages({
        'string.max': `Description cannot exceed ${ROCKET_CONSTRAINTS.DESCRIPTION_MAX_LENGTH} characters`
      }),
    
    config: this.rocketConfigSchema.required(),
    
    metadata: Joi.object({
      tags: Joi.array().items(Joi.string().trim().max(50)).max(10).optional(),
      isPublic: Joi.boolean().optional(),
      complexity: Joi.string().valid(...Object.values(ComplexityLevel)).optional(),
      estimatedCost: Joi.number().min(0).max(10000).optional(),
      buildTime: Joi.number().integer().min(0).max(1000).optional()
    }).optional()
  });

  private readonly updateRocketSchema = Joi.object({
    name: Joi.string()
      .trim()
      .min(ROCKET_CONSTRAINTS.NAME_MIN_LENGTH)
      .max(ROCKET_CONSTRAINTS.NAME_MAX_LENGTH)
      .optional(),
    
    description: Joi.string()
      .trim()
      .max(ROCKET_CONSTRAINTS.DESCRIPTION_MAX_LENGTH)
      .optional()
      .allow(''),
    
    config: this.rocketConfigSchema.optional(),
    
    metadata: Joi.object({
      tags: Joi.array().items(Joi.string().trim().max(50)).max(10).optional(),
      isPublic: Joi.boolean().optional(),
      complexity: Joi.string().valid(...Object.values(ComplexityLevel)).optional(),
      estimatedCost: Joi.number().min(0).max(10000).optional(),
      buildTime: Joi.number().integer().min(0).max(1000).optional()
    }).optional()
  });

  /**
   * Validate create rocket request
   */
  async validateCreateRocket(data: CreateRocketRequest): Promise<{
    isValid: boolean;
    errors: string[];
    sanitizedData?: CreateRocketRequest;
  }> {
    try {
      const { error, value } = this.createRocketSchema.validate(data, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        return {
          isValid: false,
          errors: error.details.map(detail => detail.message)
        };
      }

      return {
        isValid: true,
        errors: [],
        sanitizedData: value
      };
    } catch (err) {
      return {
        isValid: false,
        errors: ['Validation error occurred']
      };
    }
  }

  /**
   * Validate update rocket request
   */
  async validateUpdateRocket(data: UpdateRocketRequest): Promise<{
    isValid: boolean;
    errors: string[];
    sanitizedData?: UpdateRocketRequest;
  }> {
    try {
      const { error, value } = this.updateRocketSchema.validate(data, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        return {
          isValid: false,
          errors: error.details.map(detail => detail.message)
        };
      }

      return {
        isValid: true,
        errors: [],
        sanitizedData: value
      };
    } catch (err) {
      return {
        isValid: false,
        errors: ['Validation error occurred']
      };
    }
  }

  /**
   * Validate rocket configuration with physics checks
   */
  async validateRocketConfig(config: RocketConfig): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Basic schema validation
      const { error } = this.rocketConfigSchema.validate(config, {
        abortEarly: false
      });

      if (error) {
        errors.push(...error.details.map(detail => detail.message));
      }

      // Physics-based validation
      const physicsValidation = this.validatePhysics(config);
      errors.push(...physicsValidation.errors);
      warnings.push(...physicsValidation.warnings);

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    } catch (err) {
      return {
        isValid: false,
        errors: ['Configuration validation error occurred'],
        warnings: []
      };
    }
  }

  /**
   * Physics-based validation checks
   */
  private validatePhysics(config: RocketConfig): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Calculate total mass
    const totalMass = config.body.mass + config.noseCone.mass + 
                     config.fins.mass + config.engine.totalMass + config.recovery.mass;

    // Thrust-to-weight ratio check
    const thrustToWeight = config.engine.thrust / (totalMass * 9.81);
    if (thrustToWeight < 3) {
      errors.push(`Thrust-to-weight ratio too low: ${thrustToWeight.toFixed(2)} (minimum 3.0)`);
    } else if (thrustToWeight < 5) {
      warnings.push(`Low thrust-to-weight ratio: ${thrustToWeight.toFixed(2)} (recommended minimum 5.0)`);
    }

    // Mass consistency checks
    if (config.engine.propellantMass >= config.engine.totalMass) {
      errors.push('Propellant mass cannot be greater than or equal to total engine mass');
    }

    // Fin geometry checks
    if (config.fins.tipChord >= config.fins.rootChord) {
      warnings.push('Tip chord should typically be smaller than root chord for better aerodynamics');
    }

    // Recovery system checks
    if (config.recovery.type === RecoveryType.PARACHUTE) {
      if (!config.recovery.parachuteDiameter) {
        errors.push('Parachute diameter is required for parachute recovery');
      } else {
        // Check descent rate (rough calculation)
        const parachuteArea = Math.PI * (config.recovery.parachuteDiameter / 2) ** 2;
        const descentRate = Math.sqrt((2 * totalMass * 9.81) / (1.225 * 1.3 * parachuteArea));
        
        if (descentRate > 7) { // 7 m/s is generally considered maximum safe descent rate
          warnings.push(`High descent rate: ${descentRate.toFixed(1)} m/s (recommend larger parachute)`);
        }
      }
    }

    // Stability checks (simplified)
    const bodyLength = config.body.length;
    const bodyDiameter = config.body.diameter;
    const finSpan = config.fins.span;

    // Check if fins are large enough for stability
    const finArea = config.fins.count * config.fins.rootChord * config.fins.span;
    const bodyArea = Math.PI * (bodyDiameter / 2) ** 2;
    const finToBodyRatio = finArea / bodyArea;

    if (finToBodyRatio < 0.5) {
      warnings.push('Fins may be too small for adequate stability');
    }

    // Length-to-diameter ratio check
    const lengthToDiameter = bodyLength / bodyDiameter;
    if (lengthToDiameter < 10) {
      warnings.push(`Short rocket (L/D = ${lengthToDiameter.toFixed(1)}), may be unstable`);
    } else if (lengthToDiameter > 30) {
      warnings.push(`Very long rocket (L/D = ${lengthToDiameter.toFixed(1)}), may be difficult to build`);
    }

    // Engine compatibility checks
    const bodyDiameterMm = bodyDiameter * 1000;
    let expectedDiameter = 0;

    // Standard engine diameters (simplified)
    const engineDiameters: { [key: string]: number } = {
      'A': 18, 'B': 18, 'C': 18, 'D': 24,
      'E': 24, 'F': 29, 'G': 29, 'H': 38,
      'I': 38, 'J': 54, 'K': 54, 'L': 75,
      'M': 75, 'N': 98
    };

    expectedDiameter = engineDiameters[config.engine.type] || 0;
    
    if (expectedDiameter > 0 && bodyDiameterMm < expectedDiameter) {
      errors.push(`Body diameter (${bodyDiameterMm}mm) too small for ${config.engine.type} engine (needs ${expectedDiameter}mm)`);
    }

    // Launch angle check
    if (config.launch.launchAngle > 5) {
      warnings.push(`High launch angle (${config.launch.launchAngle}°) may reduce altitude performance`);
    }

    // Launch rod length check
    if (config.launch.launchRodLength < bodyLength) {
      warnings.push('Launch rod should be longer than rocket body for good guidance');
    }

    return { errors, warnings };
  }

  /**
   * Sanitize rocket name (remove special characters, etc.)
   */
  sanitizeRocketName(name: string): string {
    return name
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
      .replace(/\s+/g, ' ') // Normalize whitespace
      .substring(0, ROCKET_CONSTRAINTS.NAME_MAX_LENGTH);
  }

  /**
   * Validate and sanitize tags
   */
  sanitizeTags(tags: string[]): string[] {
    return tags
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0 && tag.length <= 50)
      .slice(0, 10); // Max 10 tags
  }

  /**
   * Check if rocket configuration is safe for beginners
   */
  isBeginnerFriendly(config: RocketConfig): {
    isSafe: boolean;
    concerns: string[];
    recommendations: string[];
  } {
    const concerns: string[] = [];
    const recommendations: string[] = [];

    const totalMass = config.body.mass + config.noseCone.mass + 
                     config.fins.mass + config.engine.totalMass + config.recovery.mass;
    const thrustToWeight = config.engine.thrust / (totalMass * 9.81);

    // Check engine class
    const engineClass = config.engine.type;
    const highPowerEngines = ['H', 'I', 'J', 'K', 'L', 'M', 'N'];
    
    if (highPowerEngines.includes(engineClass)) {
      concerns.push('High-power engine requires certification');
      recommendations.push('Consider starting with C or D engines');
    }

    // Check complexity
    if (config.fins.count > 4) {
      concerns.push('Complex fin configuration');
      recommendations.push('Start with 3 or 4 fins for simplicity');
    }

    if (config.recovery.type === RecoveryType.DUAL_DEPLOY) {
      concerns.push('Dual-deploy recovery is advanced');
      recommendations.push('Use single parachute recovery for first rockets');
    }

    // Check materials
    const advancedMaterials = [RocketMaterial.CARBON_FIBER, RocketMaterial.FIBERGLASS];
    const hasAdvancedMaterials = [
      config.body.material,
      config.noseCone.material,
      config.fins.material
    ].some(material => advancedMaterials.includes(material));

    if (hasAdvancedMaterials) {
      concerns.push('Advanced materials require special tools');
      recommendations.push('Consider cardboard or balsa wood for first builds');
    }

    // Check size
    if (config.body.length > 1.0 || config.body.diameter > 0.05) {
      concerns.push('Large rocket may be difficult to handle');
      recommendations.push('Start with smaller rockets (< 1m length, < 5cm diameter)');
    }

    return {
      isSafe: concerns.length === 0,
      concerns,
      recommendations
    };
  }
}
