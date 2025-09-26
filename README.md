# 🚀 KidRocket Designer

A comprehensive web application for designing and simulating model rockets with realistic physics. Built for educational purposes to teach kids about rocketry, physics, and engineering principles.

![KidRocket Designer](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)
![React](https://img.shields.io/badge/React-18+-blue)
![Node.js](https://img.shields.io/badge/Node.js-20+-green)
![Material-UI](https://img.shields.io/badge/Material--UI-5+-purple)

## ✨ Features

### 🎯 **Rocket Design Studio**
- **Comprehensive Design Form**: Configure body, nose cone, fins, engine, and recovery systems
- **Real-time Performance Estimates**: See altitude, velocity, and stability as you design
- **Material Selection**: Choose from cardboard, balsa, fiberglass, and carbon fiber
- **Engine Options**: A through O class engines with realistic specifications
- **Recovery Systems**: Parachute and streamer recovery with deployment settings

### 🧮 **Physics Simulation Engine**
- **Realistic Physics**: Drag coefficients, thrust curves, mass calculations
- **Environmental Factors**: Weather conditions, wind speed, atmospheric pressure
- **Flight Dynamics**: Multi-stage flight simulation with detailed telemetry
- **Performance Analysis**: Thrust-to-weight ratio, stability margin, apogee prediction

### 📊 **Interactive Results**
- **Flight Visualization**: Interactive charts showing altitude, velocity, and acceleration
- **Telemetry Data**: Detailed flight data with timestamps and events
- **Performance Metrics**: Key statistics and recommendations
- **Mobile Responsive**: Optimized for desktop, tablet, and mobile devices

### 🎨 **Modern UI/UX**
- **Material Design**: Clean, intuitive interface with Material-UI components
- **Mobile-First**: Responsive design that works on all screen sizes
- **Real-time Updates**: Live performance estimates as you design
- **Accessibility**: WCAG compliant with keyboard navigation support

## 🏗️ Architecture

### **Frontend** (React + TypeScript)
```
client/
├── src/
│   ├── components/          # React components
│   │   ├── RocketBuilderForm.tsx
│   │   ├── LaunchButton.tsx
│   │   └── ResultPanel.tsx
│   ├── api/                 # API client
│   └── App.tsx             # Main application
├── public/                  # Static assets
└── package.json
```

### **Backend** (Node.js + TypeScript)
```
src/
├── domains/
│   ├── auth/               # User authentication
│   └── rocket/             # Rocket simulation logic
│       ├── controllers/    # HTTP request handlers
│       ├── services/       # Business logic
│       ├── repositories/   # Database layer
│       └── routes/         # API routes
├── infrastructure/         # Cross-cutting concerns
│   ├── database/          # PostgreSQL setup
│   ├── logging/           # Winston logging
│   └── security/          # Rate limiting, validation
└── shared/                # Shared types and utilities
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** 20+ 
- **npm** or **yarn**
- **PostgreSQL** (for full backend)
- **Redis** (for caching - optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/kidrocket-designer.git
   cd kidrocket-designer
   ```

2. **Install backend dependencies**
   ```bash
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd client
   npm install
   cd ..
   ```

4. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

### Development Mode

1. **Start the backend server**
   ```bash
   npm start
   # Server runs on http://localhost:3001
   ```

2. **Start the frontend (in a new terminal)**
   ```bash
   cd client
   npm start
   # Frontend runs on http://localhost:3000
   ```

3. **Open your browser**
   Navigate to `http://localhost:3000` and start designing rockets! 🚀

## 🛠️ API Endpoints

### Rocket Design & Simulation
```
POST /api/v1/rockets/estimate     # Get performance estimate
POST /api/v1/rockets              # Create rocket design
POST /api/v1/rockets/:id/launch   # Launch simulation
GET  /api/v1/rockets/:id          # Get rocket details
GET  /api/v1/rockets/public       # List public rockets
```

### Health & Status
```
GET  /health                      # Service health check
GET  /api/v1                      # API information
```

## 🧪 Example Usage

### Create a Rocket Design
```javascript
const rocket = {
  name: "My First Rocket",
  config: {
    body: { length: 0.6, diameter: 0.024, mass: 0.1, material: "cardboard" },
    noseCone: { type: "ogive", length: 0.1, mass: 0.02 },
    fins: { count: 4, span: 0.08, material: "balsa" },
    engine: { type: "C", thrust: 12, burnTime: 2.5 },
    recovery: { type: "parachute", deploymentAltitude: 150 }
  }
};
```

### Launch Simulation
```javascript
const launchOptions = {
  weather: { temperature: 20, pressure: 101325, windSpeed: 5 },
  timeStep: 0.01,
  maxFlightTime: 300
};
```

### Expected Results
```javascript
{
  success: true,
  data: {
    maxAltitude: 287.5,        // meters
    maxVelocity: 45.2,         // m/s
    flightTime: 18.7,          // seconds
    telemetry: [...],          // detailed flight data
    events: [...]              // flight events
  }
}
```

## 🎓 Educational Value

### **Physics Concepts**
- Newton's Laws of Motion
- Drag and Lift Forces  
- Center of Pressure vs Center of Gravity
- Impulse and Momentum
- Energy Conservation

### **Engineering Principles**
- Design Trade-offs
- Material Properties
- Stability Analysis
- Performance Optimization
- Systems Integration

### **Mathematical Skills**
- Geometry and Trigonometry
- Calculus (derivatives, integrals)
- Statistics and Data Analysis
- Unit Conversions
- Scientific Notation

## 🔧 Technology Stack

### **Frontend**
- **React 18+** - Modern UI framework
- **TypeScript** - Type safety and better DX
- **Material-UI 5** - Google Material Design components
- **Recharts** - Interactive data visualization
- **Axios** - HTTP client for API calls
- **React Hook Form** - Form state management

### **Backend**
- **Node.js 20+** - JavaScript runtime
- **Express.js** - Web application framework
- **TypeScript** - Type-safe server development
- **PostgreSQL** - Relational database
- **Redis** - Caching and session storage
- **Winston** - Structured logging
- **Jest** - Testing framework

### **Infrastructure**
- **Docker** - Containerization
- **GitHub Actions** - CI/CD pipeline
- **ESLint + Prettier** - Code quality
- **Husky** - Git hooks

## 📱 Mobile Support

KidRocket Designer is fully responsive and optimized for:
- 📱 **Mobile phones** (320px+)
- 📟 **Tablets** (768px+) 
- 💻 **Desktops** (1024px+)
- 🖥️ **Large screens** (1440px+)

Features include:
- Touch-friendly controls
- Collapsible sections
- Optimized charts and visualizations
- Smooth scrolling and animations

## 🧪 Testing

```bash
# Run backend tests
npm test

# Run frontend tests
cd client
npm test

# Run integration tests
npm run test:integration

# Generate coverage report
npm run test:coverage
```

## 🚀 Deployment

### Production Build
```bash
# Build frontend
cd client
npm run build

# Build backend
cd ..
npm run build

# Start production server
npm run start:prod
```

### Docker Deployment
```bash
# Build and run with Docker
docker-compose up --build

# Production deployment
docker-compose -f docker-compose.prod.yml up
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

### Code Standards
- TypeScript for type safety
- ESLint + Prettier for formatting
- Jest for testing
- Conventional commits
- 100% test coverage for critical paths

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **NAR (National Association of Rocketry)** for safety guidelines
- **OpenRocket** for simulation reference
- **Material-UI** for the excellent component library
- **React community** for the amazing ecosystem

## 📞 Support

- 📧 **Email**: support@kidrocket-designer.com
- 🐛 **Issues**: [GitHub Issues](https://github.com/YOUR_USERNAME/kidrocket-designer/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/YOUR_USERNAME/kidrocket-designer/discussions)
- 📖 **Documentation**: [Wiki](https://github.com/YOUR_USERNAME/kidrocket-designer/wiki)

---

**Built with ❤️ for young engineers and rocket enthusiasts! 🚀**

*KidRocket Designer - Where imagination meets physics!*