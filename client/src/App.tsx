/**
 * Main App Component
 * 
 * Root component that combines all rocket designer components.
 * Mobile responsive with Material-UI theming.
 */

import React, { useState } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Grid,
  Paper,
  Fab,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  Rocket as RocketIcon,
  KeyboardArrowUp as ScrollTopIcon
} from '@mui/icons-material';
import { RocketBuilderForm } from './components/RocketBuilderForm';
import { LaunchButton } from './components/LaunchButton';
import { ResultPanel } from './components/ResultPanel';
import { RocketConfig, SimulationResult, defaultRocketConfig } from './api/rocketApi';

// Create Material-UI theme
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#dc004e',
      light: '#ff5983',
      dark: '#9a0036',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
  },
});

// Scroll to top component
const ScrollTop: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const theme = useTheme();
  
  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Box
      onClick={handleClick}
      role="presentation"
      sx={{
        position: 'fixed',
        bottom: theme.spacing(2),
        right: theme.spacing(2),
        zIndex: 1000,
      }}
    >
      {children}
    </Box>
  );
};

function App() {
  const [rocketConfig, setRocketConfig] = useState<RocketConfig>(defaultRocketConfig);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleConfigChange = (config: RocketConfig) => {
    setRocketConfig(config);
    // Keep previous results visible - let user decide when to run new simulation
  };

  const handleLaunchSuccess = (result: SimulationResult) => {
    setSimulationResult(result);
    setIsLaunching(false);
    setLaunchError(null);
    
    // Scroll to results on mobile
    if (isMobile) {
      setTimeout(() => {
        const resultElement = document.getElementById('simulation-results');
        if (resultElement) {
          resultElement.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  };

  const handleLaunchError = (error: string) => {
    setLaunchError(error);
    setIsLaunching(false);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      
      {/* App Bar */}
      <AppBar position="sticky" elevation={1}>
        <Toolbar>
          <RocketIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            KidRocket Designer
          </Typography>
          <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
            Design • Simulate • Launch
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Grid container spacing={3}>
          {/* Rocket Builder - Left Side on Desktop, Top on Mobile */}
          <Grid item xs={12} lg={6}>
            <RocketBuilderForm
              onConfigChange={handleConfigChange}
              initialConfig={rocketConfig}
              disabled={isLaunching}
            />

            {/* Launch Controls */}
            <Paper 
              elevation={3} 
              sx={{ 
                p: 3, 
                mt: 3, 
                textAlign: 'center',
                background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)',
                color: 'white'
              }}
            >
              <Typography variant="h6" gutterBottom>
                Ready for Launch?
              </Typography>
              <Typography variant="body2" sx={{ mb: 3, opacity: 0.9 }}>
                Launch your rocket simulation with realistic physics
              </Typography>
              
              <LaunchButton
                rocketConfig={rocketConfig}
                onLaunchSuccess={handleLaunchSuccess}
                onLaunchError={handleLaunchError}
                disabled={isLaunching}
                size={isMobile ? 'medium' : 'large'}
              />

              {launchError && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="error.light">
                    ⚠️ {launchError}
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>

          {/* Results Panel - Right Side on Desktop, Bottom on Mobile */}
          <Grid item xs={12} lg={6}>
            <Box id="simulation-results">
              <ResultPanel 
                result={simulationResult}
                loading={isLaunching}
              />
            </Box>
          </Grid>
        </Grid>

        {/* Footer */}
        <Box sx={{ mt: 6, py: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            KidRocket Designer • Built with React & Material-UI
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Realistic rocket physics simulation for educational purposes
          </Typography>
        </Box>
      </Container>

      {/* Scroll to Top Button */}
      <ScrollTop>
        <Fab color="primary" size="small" aria-label="scroll back to top">
          <ScrollTopIcon />
        </Fab>
      </ScrollTop>
    </ThemeProvider>
  );
}

export default App;
