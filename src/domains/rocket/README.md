# Rocket/Simulation Module

## Overview

The Rocket/Simulation module is a comprehensive system for designing, storing, and simulating model rocket flights. It follows clean architecture principles with clear separation between controllers, services, and repositories.

## Features

### 🚀 **Rocket Design Management**
- Create, read, update, and delete rocket designs
- Version control for design iterations
- Comprehensive rocket configuration including:
  - Body specifications (length, diameter, mass, materials)
  - Nose cone design (type, dimensions, materials)
  - Fin configuration (count, geometry, materials)
  - Engine specifications (type, thrust, burn time, performance)
  - Recovery system (parachutes, deployment altitude)
  - Launch parameters (angle, rod length, weather conditions)

### 🧮 **Physics Simulation Engine**
- Industry-standard rocket physics calculations
- Real-time trajectory simulation
- Environmental factors (weather, altitude, air density)
- Performance metrics:
  - Maximum altitude and velocity
  - Flight time and acceleration
  - Stability analysis
  - Recovery predictions

### 📊 **Performance Analytics**
- Detailed telemetry data
- Flight phase tracking (boost, coast, recovery, landing)
- Performance scoring system
- Issue detection and warnings
- Comparative analysis

### 👥 **Social Features**
- Public/private rocket sharing
- Like and download system
- Performance leaderboards
- User statistics and achievements

### 🔒 **Security & Validation**
- Comprehensive input validation
- Physics-based configuration checks
- User ownership verification
- Rate limiting protection

## Architecture

```
src/domains/rocket/
├── controllers/           # HTTP request handlers
│   └── rocket.controller.ts
├── services/             # Business logic
│   ├── rocket.service.ts
│   ├── simulation.engine.ts
│   └── validation.service.ts
├── repositories/         # Data access layer
│   ├── rocket.repository.ts
│   └── simulation.repository.ts
├── routes/              # HTTP route definitions
│   └── rocket.routes.ts
├── __tests__/           # Unit tests
│   ├── rocket.service.test.ts
│   ├── simulation.engine.test.ts
│   └── rocket.controller.test.ts
├── index.ts             # Module exports
└── README.md            # This file
```

## API Endpoints

### Public Endpoints
- `GET /api/v1/rockets/popular` - Get popular public rockets
- `GET /api/v1/leaderboard` - Get performance leaderboard
- `POST /api/v1/rockets/estimate` - Get performance estimate

### Semi-Public Endpoints (Optional Auth)
- `GET /api/v1/rockets` - List rockets
- `GET /api/v1/rockets/:id` - Get rocket by ID
- `GET /api/v1/rockets/:id/simulations` - Get simulation history

### Protected Endpoints (Auth Required)
- `POST /api/v1/rockets` - Create rocket
- `PUT /api/v1/rockets/:id` - Update rocket
- `DELETE /api/v1/rockets/:id` - Delete rocket
- `POST /api/v1/rockets/:id/launch` - Launch simulation
- `POST /api/v1/rockets/:id/like` - Like rocket
- `POST /api/v1/rockets/:id/download` - Download rocket

### User-Specific Endpoints
- `GET /api/v1/users/me/rockets` - Get user's rockets
- `GET /api/v1/users/me/simulations` - Get user's simulations
- `GET /api/v1/users/me/stats` - Get user statistics

## Database Schema

### Rockets Table
```sql
CREATE TABLE rockets (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    version INTEGER DEFAULT 1,
    config JSONB NOT NULL,
    tags TEXT[],
    is_public BOOLEAN DEFAULT FALSE,
    likes INTEGER DEFAULT 0,
    downloads INTEGER DEFAULT 0,
    complexity VARCHAR(20),
    estimated_cost DECIMAL(10,2),
    build_time INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
);
```

### Simulations Table
```sql
CREATE TABLE simulations (
    id UUID PRIMARY KEY,
    rocket_id UUID REFERENCES rockets(id),
    user_id UUID REFERENCES users(id),
    rocket_config JSONB NOT NULL,
    results JSONB NOT NULL,
    weather JSONB NOT NULL,
    launch_options JSONB,
    max_altitude DECIMAL(10,3),
    max_velocity DECIMAL(10,3),
    flight_time DECIMAL(10,3),
    successful BOOLEAN,
    score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE
);
```

### Telemetry Table
```sql
CREATE TABLE simulation_telemetry (
    id UUID PRIMARY KEY,
    simulation_id UUID REFERENCES simulations(id),
    telemetry_data JSONB NOT NULL,
    time_step DECIMAL(6,4),
    total_points INTEGER,
    data_size_kb INTEGER,
    created_at TIMESTAMP WITH TIME ZONE
);
```

## Usage Examples

### Creating a Rocket
```typescript
const rocketData = {
  name: "My First Rocket",
  description: "A simple beginner rocket",
  config: {
    body: {
      length: 0.6,
      diameter: 0.024,
      mass: 0.1,
      material: RocketMaterial.CARDBOARD,
      fineness: 25
    },
    engine: {
      type: EngineType.C,
      thrust: 12,
      burnTime: 2.5,
      // ... more config
    }
    // ... complete configuration
  },
  metadata: {
    complexity: ComplexityLevel.BEGINNER,
    tags: ["beginner", "cardboard"],
    isPublic: false
  }
};

const rocket = await rocketService.createRocket(userId, rocketData);
```

### Running a Simulation
```typescript
const launchOptions = {
  weather: {
    temperature: 20,
    windSpeed: 5,
    windDirection: 0
  },
  timeStep: 0.01,
  detailedTelemetry: true
};

const simulation = await rocketService.launchRocket(
  rocketId, 
  userId, 
  { options: launchOptions }
);

console.log(`Max altitude: ${simulation.results.maxAltitude}m`);
console.log(`Flight time: ${simulation.results.flightTime}s`);
console.log(`Performance score: ${simulation.results.score}/100`);
```

### Performance Estimation
```typescript
const estimate = await rocketService.estimatePerformance(rocketConfig);

console.log(`Estimated altitude: ${estimate.estimatedAltitude}m`);
console.log(`Thrust-to-weight: ${estimate.thrustToWeight}`);
console.log(`Stability margin: ${estimate.stabilityMargin} calibers`);

if (estimate.recommendations.length > 0) {
  console.log("Recommendations:");
  estimate.recommendations.forEach(rec => console.log(`- ${rec}`));
}
```

## Physics Engine

The simulation engine implements industry-standard rocket physics:

### Forces Calculated
- **Thrust**: Engine force during burn phase
- **Drag**: Aerodynamic resistance based on velocity and air density
- **Weight**: Gravitational force (varies with altitude)
- **Wind**: Environmental wind effects

### Integration Method
- Euler integration for stability
- Configurable time steps (default 0.01s)
- Launch rod constraint handling
- Multi-phase flight simulation

### Validation Checks
- Thrust-to-weight ratio analysis
- Stability margin calculations (simplified Barrowman method)
- Mass consistency verification
- Aerodynamic feasibility checks

## Testing

The module includes comprehensive unit tests:

```bash
# Run all rocket module tests
npm test src/domains/rocket

# Run specific test suites
npm test rocket.service.test.ts
npm test simulation.engine.test.ts
npm test rocket.controller.test.ts
```

### Test Coverage
- **Service Layer**: Business logic validation
- **Simulation Engine**: Physics calculations accuracy
- **Controller Layer**: HTTP request/response handling
- **Repository Layer**: Data access operations
- **Integration Tests**: End-to-end workflows

## Configuration

### Environment Variables
```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/kidrocket
REDIS_URL=redis://localhost:6379

# Simulation limits
MAX_SIMULATION_TIME=300
MAX_TELEMETRY_POINTS=10000
SIMULATION_TIME_STEP=0.01

# Rate limiting
ROCKET_CREATE_LIMIT=10
SIMULATION_LAUNCH_LIMIT=50
```

### Validation Constraints
```typescript
const ROCKET_CONSTRAINTS = {
  NAME_MIN_LENGTH: 3,
  NAME_MAX_LENGTH: 100,
  MAX_BODY_LENGTH: 10,     // meters
  MIN_BODY_LENGTH: 0.1,    // meters
  MAX_BODY_DIAMETER: 1,    // meters
  MIN_BODY_DIAMETER: 0.01, // meters
  MAX_FINS: 8,
  MIN_FINS: 3,
  MAX_THRUST: 100000,      // Newtons
  MIN_THRUST: 0.1,         // Newtons
};
```

## Performance Considerations

### Caching Strategy
- **Rocket Data**: 1 hour TTL for individual rockets
- **User Lists**: 30 minutes TTL for user's rockets
- **Public Lists**: 10 minutes TTL for public rocket lists
- **Leaderboards**: 5 minutes TTL for performance rankings

### Database Optimization
- Indexes on frequently queried fields
- JSONB for flexible configuration storage
- Separate telemetry table for large datasets
- Pagination for all list endpoints

### Simulation Performance
- Configurable time steps for accuracy vs speed
- Optional detailed telemetry recording
- Background processing for heavy simulations
- WASM-ready architecture for client-side execution

## Future Enhancements

### Planned Features
1. **3D Visualization**: WebGL-based flight visualization
2. **Advanced Physics**: Multi-stage rockets, aerodynamic heating
3. **Mission Planning**: Trajectory optimization, payload delivery
4. **Social Features**: Rocket sharing, community challenges
5. **Mobile Support**: PWA with offline design capabilities

### WASM Integration
The simulation engine is designed to be compiled to WebAssembly for:
- Client-side simulation execution
- Reduced server load
- Real-time design feedback
- Offline simulation capabilities

### Scalability
- Microservice architecture ready
- Event-driven simulation processing
- Horizontal scaling support
- CDN integration for static assets

## Integration Guide

### With Auth Module
```typescript
import { createRocketModule } from './domains/rocket';
import { authMiddleware } from './domains/auth';

const rocketModule = createRocketModule({
  databaseService,
  cacheService
});

const rocketRoutes = rocketModule.createRoutes(authMiddleware);
app.use('/api/v1', rocketRoutes);
```

### With Frontend
```typescript
// React hook example
const { data: rockets, loading } = useRockets({
  complexity: 'beginner',
  tags: ['educational'],
  page: 1,
  limit: 20
});

// Launch simulation
const handleLaunch = async (rocketId) => {
  const simulation = await launchRocket(rocketId, {
    weather: { temperature: 25, windSpeed: 3 }
  });
  
  setResults(simulation.results);
  setTelemetry(simulation.telemetry);
};
```

## Contributing

When contributing to the rocket module:

1. **Follow Architecture**: Maintain clean separation of concerns
2. **Add Tests**: Include unit tests for new functionality
3. **Validate Physics**: Ensure simulation accuracy with known test cases
4. **Update Documentation**: Keep this README current
5. **Performance**: Consider caching and database impact

## License

This module is part of the KidRocket Designer application and follows the same licensing terms.
