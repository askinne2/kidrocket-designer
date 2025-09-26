/**
 * Launch Button Component
 * 
 * A button component that handles rocket simulation launches.
 * Includes loading states, error handling, and launch options.
 */

import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Typography,
  CircularProgress,
  Alert,
  Box,
  InputAdornment,
  FormControlLabel,
  Switch,
  Collapse,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  RocketLaunch as LaunchIcon,
  Settings as SettingsIcon,
  Cloud as WeatherIcon
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import {
  RocketConfig,
  SimulationResult,
  LaunchOptions,
  rocketApi
} from '../api/rocketApi';

interface LaunchButtonProps {
  rocketConfig: RocketConfig;
  rocketId?: string;
  onLaunchSuccess: (result: SimulationResult) => void;
  onLaunchError?: (error: string) => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'contained' | 'outlined' | 'text';
}

interface LaunchFormData {
  weather: {
    temperature: number;
    pressure: number;
    humidity: number;
    windSpeed: number;
    windDirection: number;
  };
  simulation: {
    timeStep: number;
    maxFlightTime: number;
    detailedTelemetry: boolean;
  };
}

const defaultLaunchOptions: LaunchFormData = {
  weather: {
    temperature: 20,
    pressure: 101325,
    humidity: 50,
    windSpeed: 5,
    windDirection: 0
  },
  simulation: {
    timeStep: 0.01,
    maxFlightTime: 300,
    detailedTelemetry: true
  }
};

export const LaunchButton: React.FC<LaunchButtonProps> = ({
  rocketConfig,
  rocketId,
  onLaunchSuccess,
  onLaunchError,
  disabled = false,
  size = 'large',
  variant = 'contained'
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [isLaunching, setIsLaunching] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, watch, reset } = useForm<LaunchFormData>({
    defaultValues: defaultLaunchOptions
  });

  const watchedOptions = watch();

  const handleQuickLaunch = async () => {
    await handleLaunch(defaultLaunchOptions);
  };

  const handleLaunch = async (formData: LaunchFormData) => {
    if (!rocketConfig) {
      setError('No rocket configuration provided');
      return;
    }

    setIsLaunching(true);
    setError(null);

    try {
      let result: SimulationResult;

      if (rocketId) {
        // Launch existing rocket
        const launchOptions: LaunchOptions = {
          weather: formData.weather,
          timeStep: formData.simulation.timeStep,
          maxFlightTime: formData.simulation.maxFlightTime,
          detailedTelemetry: formData.simulation.detailedTelemetry
        };

        result = await rocketApi.launchRocket(rocketId, launchOptions);
      } else {
        // For new rockets, we need to create them first
        // This is a simplified version - in a real app you'd want to save the rocket first
        const tempRocket = await rocketApi.createRocket({
          name: 'Temporary Rocket',
          description: 'Temporary rocket for simulation',
          config: rocketConfig,
          metadata: {
            tags: ['temp'],
            isPublic: false,
            complexity: 'beginner'
          }
        });

        const launchOptions: LaunchOptions = {
          weather: formData.weather,
          timeStep: formData.simulation.timeStep,
          maxFlightTime: formData.simulation.maxFlightTime,
          detailedTelemetry: formData.simulation.detailedTelemetry
        };

        result = await rocketApi.launchRocket(tempRocket.id, launchOptions);
      }

      onLaunchSuccess(result);
      setShowOptions(false);
      reset();
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Launch failed';
      setError(errorMessage);
      onLaunchError?.(errorMessage);
    } finally {
      setIsLaunching(false);
    }
  };

  const onSubmit = (data: LaunchFormData) => {
    handleLaunch(data);
  };

  return (
    <>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {/* Quick Launch Button */}
        <Button
          variant={variant}
          size={size}
          color="primary"
          startIcon={isLaunching ? <CircularProgress size={20} /> : <LaunchIcon />}
          onClick={handleQuickLaunch}
          disabled={disabled || isLaunching || !rocketConfig}
          sx={{
            minWidth: isMobile ? '100%' : 200,
            height: size === 'large' ? 56 : size === 'medium' ? 42 : 36
          }}
        >
          {isLaunching ? 'Launching...' : 'Quick Launch'}
        </Button>

        {/* Advanced Launch Button */}
        <Button
          variant="outlined"
          size={size}
          startIcon={<SettingsIcon />}
          onClick={() => setShowOptions(true)}
          disabled={disabled || isLaunching || !rocketConfig}
          sx={{
            minWidth: isMobile ? '100%' : 160,
            height: size === 'large' ? 56 : size === 'medium' ? 42 : 36
          }}
        >
          Advanced Launch
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Advanced Launch Options Dialog */}
      <Dialog
        open={showOptions}
        onClose={() => setShowOptions(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LaunchIcon />
            <Typography variant="h6">Launch Configuration</Typography>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 2 }}>
            {/* Weather Conditions */}
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <WeatherIcon />
              Weather Conditions
            </Typography>

            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="weather.temperature"
                  control={control}
                  rules={{ 
                    required: 'Temperature is required',
                    min: { value: -50, message: 'Minimum temperature is -50°C' },
                    max: { value: 60, message: 'Maximum temperature is 60°C' }
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Temperature"
                      type="number"
                      fullWidth
                      InputProps={{
                        endAdornment: <InputAdornment position="end">°C</InputAdornment>,
                      }}
                      inputProps={{ step: 1, min: -50, max: 60 }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="weather.humidity"
                  control={control}
                  rules={{ 
                    required: 'Humidity is required',
                    min: { value: 0, message: 'Minimum humidity is 0%' },
                    max: { value: 100, message: 'Maximum humidity is 100%' }
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Humidity"
                      type="number"
                      fullWidth
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>,
                      }}
                      inputProps={{ step: 1, min: 0, max: 100 }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="weather.windSpeed"
                  control={control}
                  rules={{ 
                    required: 'Wind speed is required',
                    min: { value: 0, message: 'Minimum wind speed is 0 m/s' },
                    max: { value: 30, message: 'Maximum wind speed is 30 m/s' }
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Wind Speed"
                      type="number"
                      fullWidth
                      InputProps={{
                        endAdornment: <InputAdornment position="end">m/s</InputAdornment>,
                      }}
                      inputProps={{ step: 0.1, min: 0, max: 30 }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="weather.windDirection"
                  control={control}
                  rules={{ 
                    required: 'Wind direction is required',
                    min: { value: 0, message: 'Minimum wind direction is 0°' },
                    max: { value: 360, message: 'Maximum wind direction is 360°' }
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Wind Direction"
                      type="number"
                      fullWidth
                      InputProps={{
                        endAdornment: <InputAdornment position="end">°</InputAdornment>,
                      }}
                      inputProps={{ step: 1, min: 0, max: 360 }}
                      helperText="0° = North, 90° = East, 180° = South, 270° = West"
                    />
                  )}
                />
              </Grid>
            </Grid>

            {/* Advanced Simulation Options */}
            <FormControlLabel
              control={
                <Switch
                  checked={showAdvanced}
                  onChange={(e) => setShowAdvanced(e.target.checked)}
                />
              }
              label="Advanced Simulation Options"
              sx={{ mb: 2 }}
            />

            <Collapse in={showAdvanced}>
              <Grid container spacing={3} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="simulation.timeStep"
                    control={control}
                    rules={{ 
                      required: 'Time step is required',
                      min: { value: 0.001, message: 'Minimum time step is 0.001s' },
                      max: { value: 0.1, message: 'Maximum time step is 0.1s' }
                    }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Time Step"
                        type="number"
                        fullWidth
                        InputProps={{
                          endAdornment: <InputAdornment position="end">s</InputAdornment>,
                        }}
                        inputProps={{ step: 0.001, min: 0.001, max: 0.1 }}
                        helperText="Smaller values = more accurate but slower"
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Controller
                    name="simulation.maxFlightTime"
                    control={control}
                    rules={{ 
                      required: 'Max flight time is required',
                      min: { value: 10, message: 'Minimum flight time is 10s' },
                      max: { value: 600, message: 'Maximum flight time is 600s' }
                    }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Max Flight Time"
                        type="number"
                        fullWidth
                        InputProps={{
                          endAdornment: <InputAdornment position="end">s</InputAdornment>,
                        }}
                        inputProps={{ step: 10, min: 10, max: 600 }}
                        helperText="Maximum simulation duration"
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Controller
                    name="simulation.detailedTelemetry"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={<Switch {...field} checked={field.value} />}
                        label="Detailed Telemetry (includes full trajectory data)"
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </Collapse>

            {/* Current Configuration Summary */}
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Launch Conditions:</strong><br />
                Temperature: {watchedOptions.weather.temperature}°C, 
                Wind: {watchedOptions.weather.windSpeed} m/s at {watchedOptions.weather.windDirection}°, 
                Humidity: {watchedOptions.weather.humidity}%
                {showAdvanced && (
                  <>
                    <br />
                    <strong>Simulation:</strong> {watchedOptions.simulation.timeStep}s steps, 
                    {watchedOptions.simulation.maxFlightTime}s max time, 
                    {watchedOptions.simulation.detailedTelemetry ? 'detailed' : 'basic'} telemetry
                  </>
                )}
              </Typography>
            </Alert>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button
            onClick={() => setShowOptions(false)}
            disabled={isLaunching}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={isLaunching ? <CircularProgress size={20} /> : <LaunchIcon />}
            onClick={handleSubmit(onSubmit)}
            disabled={isLaunching}
            sx={{ minWidth: 120 }}
          >
            {isLaunching ? 'Launching...' : 'Launch'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
