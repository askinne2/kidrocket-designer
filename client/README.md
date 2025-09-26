# KidRocket Designer - React Frontend

## 🚀 Overview

A modern, responsive React frontend for the KidRocket Designer application. Built with Material-UI and TypeScript, providing an intuitive interface for designing and simulating model rockets.

## ✨ Features

### 🎨 **User Interface**
- **Material-UI Design System**: Consistent, professional appearance
- **Mobile-First Responsive**: Optimized for all screen sizes
- **Dark/Light Theme Support**: Built-in theming system
- **Intuitive Navigation**: Clear, user-friendly interface

### 🚀 **Rocket Designer**
- **Interactive Form**: Comprehensive rocket configuration
- **Real-time Validation**: Instant feedback on design parameters
- **Performance Estimates**: Live performance calculations
- **Collapsible Sections**: Organized, mobile-friendly layout

### 🎯 **Launch System**
- **Quick Launch**: One-click simulation with default settings
- **Advanced Options**: Customizable weather and simulation parameters
- **Loading States**: Clear feedback during simulation
- **Error Handling**: User-friendly error messages

### 📊 **Results Display**
- **Interactive Charts**: Altitude, velocity, and acceleration graphs
- **Key Metrics**: Performance highlights and statistics
- **Detailed Analysis**: Comprehensive flight data
- **Mobile Optimized**: Touch-friendly charts and data

## 🏗️ Architecture

```
client/src/
├── components/           # React components
│   ├── RocketBuilderForm.tsx
│   ├── LaunchButton.tsx
│   ├── ResultPanel.tsx
│   └── ResponsiveDemo.tsx
├── api/                 # API client and types
│   └── rocketApi.ts
├── App.tsx              # Main application component
├── index.tsx            # Application entry point
└── package.json         # Dependencies and scripts
```

## 🛠️ Technology Stack

- **React 18**: Latest React with hooks and concurrent features
- **TypeScript**: Full type safety and development experience
- **Material-UI 5**: Modern design system with theming
- **React Hook Form**: Efficient form handling and validation
- **Recharts**: Interactive data visualization
- **Axios**: HTTP client for API communication

## 📱 Mobile Responsiveness

### Breakpoint Strategy
- **Mobile (xs)**: < 600px - Single column, fullscreen dialogs
- **Tablet (sm)**: 600px - 900px - Optimized touch interface
- **Desktop (md+)**: > 900px - Side-by-side layout

### Responsive Features
- ✅ Collapsible accordion sections for rocket configuration
- ✅ Stacked layout on mobile, side-by-side on desktop
- ✅ Touch-friendly buttons and controls
- ✅ Optimized chart sizes for different screen sizes
- ✅ Fullscreen dialogs on mobile for better UX
- ✅ Responsive grid layouts that adapt to screen size
- ✅ Scroll-to-results behavior on mobile after launch
- ✅ Flexible typography that scales appropriately

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ 
- npm or yarn
- Backend API running on port 3001

### Installation

```bash
# Navigate to client directory
cd client

# Install dependencies
npm install

# Start development server
npm start
```

The application will open at `http://localhost:3000`

### Environment Variables

Create a `.env` file in the client directory:

```env
REACT_APP_API_URL=http://localhost:3001/api/v1
```

## 🎯 Component Usage

### RocketBuilderForm

```tsx
import { RocketBuilderForm } from './components/RocketBuilderForm';

<RocketBuilderForm
  onConfigChange={handleConfigChange}
  initialConfig={rocketConfig}
  disabled={false}
/>
```

**Props:**
- `onConfigChange`: Callback when rocket configuration changes
- `initialConfig`: Initial rocket configuration
- `disabled`: Disable form inputs during simulation

### LaunchButton

```tsx
import { LaunchButton } from './components/LaunchButton';

<LaunchButton
  rocketConfig={rocketConfig}
  rocketId={rocketId}
  onLaunchSuccess={handleLaunchSuccess}
  onLaunchError={handleLaunchError}
  disabled={false}
  size="large"
  variant="contained"
/>
```

**Props:**
- `rocketConfig`: Current rocket configuration
- `rocketId`: Optional existing rocket ID
- `onLaunchSuccess`: Callback for successful simulation
- `onLaunchError`: Callback for simulation errors
- `disabled`: Disable launch functionality
- `size`: Button size (small, medium, large)
- `variant`: Button variant (contained, outlined, text)

### ResultPanel

```tsx
import { ResultPanel } from './components/ResultPanel';

<ResultPanel
  result={simulationResult}
  loading={isLaunching}
/>
```

**Props:**
- `result`: Simulation result data or null
- `loading`: Show loading state during simulation

## 🎨 Theming and Styling

### Custom Theme

The application uses a custom Material-UI theme with:
- **Primary Color**: Blue (#1976d2)
- **Secondary Color**: Pink (#dc004e)
- **Typography**: Roboto font family
- **Shape**: 12px border radius
- **Shadows**: Subtle elevation effects

### Responsive Breakpoints

```typescript
// Material-UI breakpoints
xs: 0px      // Mobile
sm: 600px    // Tablet
md: 900px    // Desktop
lg: 1200px   // Large Desktop
xl: 1536px   // Extra Large
```

## 📊 Data Flow

```
User Input → RocketBuilderForm → App State → LaunchButton → API Call → ResultPanel
     ↓              ↓                ↓           ↓            ↓           ↓
Form Controls → Config Object → React State → HTTP Request → Response → Charts & Metrics
```

## 🧪 Testing

### Running Tests

```bash
# Run test suite
npm test

# Run tests in watch mode
npm test -- --watch

# Generate coverage report
npm test -- --coverage
```

### Test Structure

- **Component Tests**: React Testing Library
- **API Tests**: Mock service workers
- **Integration Tests**: End-to-end user flows
- **Accessibility Tests**: Screen reader compatibility

## 🔧 Development

### Available Scripts

```bash
npm start       # Start development server
npm build       # Build for production
npm test        # Run test suite
npm eject       # Eject from Create React App
```

### Code Quality

- **ESLint**: Code linting and style enforcement
- **Prettier**: Code formatting
- **TypeScript**: Type checking and IntelliSense
- **React DevTools**: Component debugging

## 📦 Build and Deployment

### Production Build

```bash
npm run build
```

Creates an optimized production build in the `build` folder.

### Deployment Options

- **Static Hosting**: Netlify, Vercel, GitHub Pages
- **CDN**: AWS CloudFront, Azure CDN
- **Docker**: Containerized deployment
- **Traditional Hosting**: Apache, Nginx

### Performance Optimizations

- **Code Splitting**: Automatic route-based splitting
- **Tree Shaking**: Unused code elimination
- **Bundle Analysis**: `npm run build` provides size analysis
- **Lazy Loading**: Components loaded on demand
- **Memoization**: React.memo for expensive components

## 🎯 User Experience

### Design Principles

1. **Simplicity**: Clean, uncluttered interface
2. **Accessibility**: WCAG 2.1 AA compliance
3. **Performance**: Fast loading and smooth interactions
4. **Mobile-First**: Touch-optimized for all devices
5. **Feedback**: Clear loading states and error messages

### Interaction Patterns

- **Progressive Disclosure**: Advanced options hidden by default
- **Immediate Feedback**: Real-time validation and estimates
- **Error Recovery**: Clear error messages with recovery options
- **Loading States**: Progress indicators for all async operations

## 🔌 API Integration

### Rocket API Client

The `rocketApi.ts` file provides a complete TypeScript client for the backend API:

```typescript
// Create a rocket
const rocket = await rocketApi.createRocket(rocketData);

// Launch simulation
const result = await rocketApi.launchRocket(rocketId, options);

// Get performance estimate
const estimate = await rocketApi.estimatePerformance(config);
```

### Error Handling

- **Network Errors**: Automatic retry with exponential backoff
- **Validation Errors**: Field-specific error messages
- **Server Errors**: User-friendly error display
- **Offline Support**: Graceful degradation when offline

## 🚀 Future Enhancements

### Planned Features

1. **3D Visualization**: Three.js rocket rendering
2. **Animation**: Launch sequence animation
3. **PWA Support**: Offline functionality
4. **Social Features**: Share and compare rockets
5. **Advanced Charts**: More detailed telemetry visualization
6. **Drag & Drop**: Visual rocket builder interface

### Performance Improvements

1. **Virtual Scrolling**: For large telemetry datasets
2. **Web Workers**: Heavy calculations in background
3. **Service Workers**: Caching and offline support
4. **Bundle Optimization**: Further size reduction

## 📱 Mobile-Specific Features

### Touch Interactions
- **Swipe Gestures**: Navigate between rocket sections
- **Pinch to Zoom**: Chart interaction
- **Touch Feedback**: Visual feedback for all interactions
- **Haptic Feedback**: Device vibration for important actions

### Mobile UX
- **Bottom Sheet**: Mobile-friendly modal dialogs
- **Safe Areas**: Respect device safe areas (notches, etc.)
- **Orientation**: Support both portrait and landscape
- **Keyboard**: Optimized keyboard handling

## 🎨 Customization

### Theme Customization

```typescript
const customTheme = createTheme({
  palette: {
    primary: { main: '#your-color' },
    secondary: { main: '#your-color' }
  },
  typography: {
    fontFamily: 'Your Font Family'
  }
});
```

### Component Customization

All components accept standard Material-UI props and can be styled with the `sx` prop or custom CSS classes.

## 📄 License

This project is part of the KidRocket Designer application and follows the same licensing terms.

---

**Built with ❤️ using React, TypeScript, and Material-UI**
