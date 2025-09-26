/**
 * Rocket Builder Form Component
 * 
 * A comprehensive form for designing rockets with controlled inputs.
 * Mobile responsive with Material-UI components.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  InputAdornment,
  Chip,
  Alert
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Rocket as RocketIcon,
  Speed as SpeedIcon,
  Engineering as EngineeringIcon,
  FlightTakeoff as FlightIcon,
  FlightLand as ParachuteIcon
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import {
  RocketConfig,
  PerformanceEstimate,
  defaultRocketConfig,
  materialOptions,
  noseConeTypes,
  engineTypes,
  recoveryTypes,
  rocketApi
} from '../api/rocketApi';

interface RocketBuilderFormProps {
  onConfigChange: (config: RocketConfig) => void;
  initialConfig?: RocketConfig;
  disabled?: boolean;
}

export const RocketBuilderForm: React.FC<RocketBuilderFormProps> = ({
  onConfigChange,
  initialConfig = defaultRocketConfig,
  disabled = false
}) => {
  const [estimate, setEstimate] = useState<PerformanceEstimate | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  const { control, watch, formState: { errors } } = useForm<RocketConfig>({
    defaultValues: initialConfig,
    mode: 'onChange'
  });

  const watchedConfig = watch();

  // Update parent component when config changes
  useEffect(() => {
    onConfigChange(watchedConfig);
  }, [watchedConfig, onConfigChange]);

  // Get performance estimate when config changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (!disabled) {
        try {
          setEstimateError(null);
          const estimate = await rocketApi.estimatePerformance(watchedConfig);
          setEstimate(estimate);
        } catch (error) {
          setEstimateError('Failed to calculate performance estimate');
          console.error('Performance estimate error:', error);
        }
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [watchedConfig, disabled]);

  return (
    <Box sx={{ width: '100%', maxWidth: 1200, mx: 'auto', p: 2 }}>
      <Card elevation={3}>
        <CardHeader
          avatar={<RocketIcon color="primary" />}
          title="Rocket Designer"
          subheader="Design your custom model rocket"
          sx={{ pb: 1 }}
        />
        <CardContent>
          {/* Performance Estimate */}
          {estimate && (
            <Alert 
              severity="info" 
              sx={{ mb: 3 }}
              icon={<SpeedIcon />}
            >
              <Typography variant="body2" component="div">
                <strong>Performance Estimate:</strong><br />
                Altitude: {estimate.estimatedAltitude.toFixed(1)}m | 
                Velocity: {estimate.estimatedVelocity.toFixed(1)}m/s | 
                T/W: {estimate.thrustToWeight.toFixed(1)} | 
                Stability: {estimate.stabilityMargin.toFixed(1)} cal
              </Typography>
              {estimate.recommendations.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  {estimate.recommendations.map((rec, index) => (
                    <Chip key={index} label={rec} size="small" sx={{ mr: 1, mb: 1 }} />
                  ))}
                </Box>
              )}
            </Alert>
          )}

          {estimateError && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              {estimateError}
            </Alert>
          )}

          {/* Body Configuration */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <RocketIcon sx={{ mr: 1 }} />
              <Typography variant="h6">Body Configuration</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="body.length"
                    control={control}
                    rules={{ 
                      required: 'Length is required',
                      min: { value: 0.1, message: 'Minimum length is 0.1m' },
                      max: { value: 10, message: 'Maximum length is 10m' }
                    }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Length"
                        type="number"
                        fullWidth
                        disabled={disabled}
                        error={!!errors.body?.length}
                        helperText={errors.body?.length?.message}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">m</InputAdornment>,
                        }}
                        inputProps={{ step: 0.01, min: 0.1, max: 10 }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="body.diameter"
                    control={control}
                    rules={{ 
                      required: 'Diameter is required',
                      min: { value: 0.01, message: 'Minimum diameter is 0.01m' },
                      max: { value: 1, message: 'Maximum diameter is 1m' }
                    }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Diameter"
                        type="number"
                        fullWidth
                        disabled={disabled}
                        error={!!errors.body?.diameter}
                        helperText={errors.body?.diameter?.message}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">m</InputAdornment>,
                        }}
                        inputProps={{ step: 0.001, min: 0.01, max: 1 }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="body.mass"
                    control={control}
                    rules={{ 
                      required: 'Mass is required',
                      min: { value: 0.001, message: 'Minimum mass is 0.001kg' },
                      max: { value: 1000, message: 'Maximum mass is 1000kg' }
                    }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Mass"
                        type="number"
                        fullWidth
                        disabled={disabled}
                        error={!!errors.body?.mass}
                        helperText={errors.body?.mass?.message}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">kg</InputAdornment>,
                        }}
                        inputProps={{ step: 0.001, min: 0.001, max: 1000 }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="body.material"
                    control={control}
                    rules={{ required: 'Material is required' }}
                    render={({ field }) => (
                      <FormControl fullWidth disabled={disabled} error={!!errors.body?.material}>
                        <InputLabel>Material</InputLabel>
                        <Select {...field} label="Material">
                          {materialOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Nose Cone Configuration */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <EngineeringIcon sx={{ mr: 1 }} />
              <Typography variant="h6">Nose Cone</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="noseCone.type"
                    control={control}
                    rules={{ required: 'Nose cone type is required' }}
                    render={({ field }) => (
                      <FormControl fullWidth disabled={disabled}>
                        <InputLabel>Type</InputLabel>
                        <Select {...field} label="Type">
                          {noseConeTypes.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="noseCone.length"
                    control={control}
                    rules={{ 
                      required: 'Length is required',
                      min: { value: 0.01, message: 'Minimum length is 0.01m' },
                      max: { value: 2, message: 'Maximum length is 2m' }
                    }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Length"
                        type="number"
                        fullWidth
                        disabled={disabled}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">m</InputAdornment>,
                        }}
                        inputProps={{ step: 0.01, min: 0.01, max: 2 }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="noseCone.mass"
                    control={control}
                    rules={{ 
                      required: 'Mass is required',
                      min: { value: 0.001, message: 'Minimum mass is 0.001kg' }
                    }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Mass"
                        type="number"
                        fullWidth
                        disabled={disabled}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">kg</InputAdornment>,
                        }}
                        inputProps={{ step: 0.001, min: 0.001 }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="noseCone.material"
                    control={control}
                    rules={{ required: 'Material is required' }}
                    render={({ field }) => (
                      <FormControl fullWidth disabled={disabled}>
                        <InputLabel>Material</InputLabel>
                        <Select {...field} label="Material">
                          {materialOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Fins Configuration */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <FlightIcon sx={{ mr: 1 }} />
              <Typography variant="h6">Fins</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={4}>
                  <Controller
                    name="fins.count"
                    control={control}
                    rules={{ 
                      required: 'Fin count is required',
                      min: { value: 3, message: 'Minimum 3 fins' },
                      max: { value: 8, message: 'Maximum 8 fins' }
                    }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Count"
                        type="number"
                        fullWidth
                        disabled={disabled}
                        inputProps={{ step: 1, min: 3, max: 8 }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Controller
                    name="fins.span"
                    control={control}
                    rules={{ 
                      required: 'Span is required',
                      min: { value: 0.01, message: 'Minimum span is 0.01m' },
                      max: { value: 0.5, message: 'Maximum span is 0.5m' }
                    }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Span"
                        type="number"
                        fullWidth
                        disabled={disabled}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">m</InputAdornment>,
                        }}
                        inputProps={{ step: 0.01, min: 0.01, max: 0.5 }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Controller
                    name="fins.rootChord"
                    control={control}
                    rules={{ 
                      required: 'Root chord is required',
                      min: { value: 0.01, message: 'Minimum root chord is 0.01m' },
                      max: { value: 0.3, message: 'Maximum root chord is 0.3m' }
                    }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Root Chord"
                        type="number"
                        fullWidth
                        disabled={disabled}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">m</InputAdornment>,
                        }}
                        inputProps={{ step: 0.01, min: 0.01, max: 0.3 }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Controller
                    name="fins.tipChord"
                    control={control}
                    rules={{ 
                      required: 'Tip chord is required',
                      min: { value: 0.005, message: 'Minimum tip chord is 0.005m' },
                      max: { value: 0.2, message: 'Maximum tip chord is 0.2m' }
                    }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Tip Chord"
                        type="number"
                        fullWidth
                        disabled={disabled}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">m</InputAdornment>,
                        }}
                        inputProps={{ step: 0.005, min: 0.005, max: 0.2 }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Controller
                    name="fins.sweepAngle"
                    control={control}
                    rules={{ 
                      required: 'Sweep angle is required',
                      min: { value: 0, message: 'Minimum sweep angle is 0°' },
                      max: { value: 60, message: 'Maximum sweep angle is 60°' }
                    }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Sweep Angle"
                        type="number"
                        fullWidth
                        disabled={disabled}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">°</InputAdornment>,
                        }}
                        inputProps={{ step: 1, min: 0, max: 60 }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Controller
                    name="fins.material"
                    control={control}
                    rules={{ required: 'Material is required' }}
                    render={({ field }) => (
                      <FormControl fullWidth disabled={disabled}>
                        <InputLabel>Material</InputLabel>
                        <Select {...field} label="Material">
                          {materialOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Engine Configuration */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <SpeedIcon sx={{ mr: 1 }} />
              <Typography variant="h6">Engine</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={4}>
                  <Controller
                    name="engine.type"
                    control={control}
                    rules={{ required: 'Engine type is required' }}
                    render={({ field }) => (
                      <FormControl fullWidth disabled={disabled}>
                        <InputLabel>Type</InputLabel>
                        <Select {...field} label="Type">
                          {engineTypes.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Controller
                    name="engine.thrust"
                    control={control}
                    rules={{ 
                      required: 'Thrust is required',
                      min: { value: 0.1, message: 'Minimum thrust is 0.1N' },
                      max: { value: 100000, message: 'Maximum thrust is 100000N' }
                    }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Thrust"
                        type="number"
                        fullWidth
                        disabled={disabled}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">N</InputAdornment>,
                        }}
                        inputProps={{ step: 0.1, min: 0.1, max: 100000 }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Controller
                    name="engine.burnTime"
                    control={control}
                    rules={{ 
                      required: 'Burn time is required',
                      min: { value: 0.1, message: 'Minimum burn time is 0.1s' },
                      max: { value: 300, message: 'Maximum burn time is 300s' }
                    }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Burn Time"
                        type="number"
                        fullWidth
                        disabled={disabled}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">s</InputAdornment>,
                        }}
                        inputProps={{ step: 0.1, min: 0.1, max: 300 }}
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Recovery Configuration */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <ParachuteIcon sx={{ mr: 1 }} />
              <Typography variant="h6">Recovery System</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="recovery.type"
                    control={control}
                    rules={{ required: 'Recovery type is required' }}
                    render={({ field }) => (
                      <FormControl fullWidth disabled={disabled}>
                        <InputLabel>Type</InputLabel>
                        <Select {...field} label="Type">
                          {recoveryTypes.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="recovery.deploymentAltitude"
                    control={control}
                    rules={{ 
                      required: 'Deployment altitude is required',
                      min: { value: 10, message: 'Minimum deployment altitude is 10m' },
                      max: { value: 1000, message: 'Maximum deployment altitude is 1000m' }
                    }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Deployment Altitude"
                        type="number"
                        fullWidth
                        disabled={disabled}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">m</InputAdornment>,
                        }}
                        inputProps={{ step: 1, min: 10, max: 1000 }}
                      />
                    )}
                  />
                </Grid>
                {watchedConfig.recovery.type === 'parachute' && (
                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="recovery.parachuteDiameter"
                      control={control}
                      rules={{ 
                        required: 'Parachute diameter is required for parachute recovery',
                        min: { value: 0.1, message: 'Minimum parachute diameter is 0.1m' },
                        max: { value: 5, message: 'Maximum parachute diameter is 5m' }
                      }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Parachute Diameter"
                          type="number"
                          fullWidth
                          disabled={disabled}
                          InputProps={{
                            endAdornment: <InputAdornment position="end">m</InputAdornment>,
                          }}
                          inputProps={{ step: 0.1, min: 0.1, max: 5 }}
                        />
                      )}
                    />
                  </Grid>
                )}
              </Grid>
            </AccordionDetails>
          </Accordion>
        </CardContent>
      </Card>
    </Box>
  );
};
