/**
 * Result Panel Component
 * 
 * Displays simulation results with charts, metrics, and telemetry data.
 * Mobile responsive with collapsible sections.
 */

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Grid,
  Box,
  Chip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableRow,
  LinearProgress,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  TrendingUp as TrendingUpIcon,
  Speed as SpeedIcon,
  Height as AltitudeIcon,
  Timer as TimerIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  FlightTakeoff as FlightIcon,
  FlightLand as ParachuteIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { SimulationResult } from '../api/rocketApi';

interface ResultPanelProps {
  result: SimulationResult | null;
  loading?: boolean;
}

export const ResultPanel: React.FC<ResultPanelProps> = ({
  result,
  loading = false
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [selectedChart, setSelectedChart] = useState<'altitude' | 'velocity' | 'acceleration'>('altitude');

  if (loading) {
    return (
      <Card elevation={3}>
        <CardHeader
          avatar={<FlightIcon color="primary" />}
          title="Running Simulation..."
          subheader="Please wait while we calculate your rocket's flight"
        />
        <CardContent>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Simulating rocket physics...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card elevation={3}>
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <FlightIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No simulation results yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Design your rocket and click launch to see results
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const { results, telemetry, weather } = result;

  // Prepare chart data
  const chartData = telemetry.map(point => ({
    time: point.time,
    altitude: point.altitude,
    velocity: Math.sqrt(point.velocity.x ** 2 + point.velocity.y ** 2 + point.velocity.z ** 2),
    acceleration: Math.sqrt(point.acceleration.x ** 2 + point.acceleration.y ** 2 + point.acceleration.z ** 2) / 9.81, // Convert to G's
    phase: point.phase
  }));

  // Find key events
  const burnoutPoint = telemetry.find(p => p.thrust === 0 && p.time > 0);
  const apogeePoint = telemetry.reduce((max, p) => p.altitude > max.altitude ? p : max, telemetry[0]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'error': return <ErrorIcon color="error" />;
      case 'warning': return <WarningIcon color="warning" />;
      default: return <InfoIcon color="info" />;
    }
  };

  const formatNumber = (value: number, decimals: number = 1) => {
    return value.toFixed(decimals);
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
  };

  return (
    <Card elevation={3}>
      <CardHeader
        avatar={results.successful ? <SuccessIcon color="success" /> : <ErrorIcon color="error" />}
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="h6">
              Flight Results
            </Typography>
            <Chip 
              label={`Score: ${results.score}/100`}
              color={getScoreColor(results.score)}
              size="small"
            />
            <Chip 
              label={results.successful ? 'Successful' : 'Failed'}
              color={results.successful ? 'success' : 'error'}
              size="small"
            />
          </Box>
        }
        subheader={`Flight completed in ${formatTime(results.flightTime)}`}
      />

      <CardContent>
        {/* Key Metrics */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <Box sx={{ textAlign: 'center' }}>
              <AltitudeIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="h6" color="primary">
                {formatNumber(results.maxAltitude)}m
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Max Altitude
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={6} sm={3}>
            <Box sx={{ textAlign: 'center' }}>
              <SpeedIcon color="secondary" sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="h6" color="secondary">
                {formatNumber(results.maxVelocity)}m/s
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Max Velocity
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={6} sm={3}>
            <Box sx={{ textAlign: 'center' }}>
              <TrendingUpIcon color="info" sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="h6" color="info.main">
                {formatNumber(results.maxAcceleration / 9.81)}G
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Max Acceleration
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={6} sm={3}>
            <Box sx={{ textAlign: 'center' }}>
              <TimerIcon color="warning" sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="h6" color="warning.main">
                {formatTime(results.flightTime)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Flight Time
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Issues and Warnings */}
        {results.issues.length > 0 && (
          <Alert 
            severity={results.issues.some(i => i.type === 'error') ? 'error' : 'warning'}
            sx={{ mb: 3 }}
          >
            <Typography variant="body2" component="div">
              <strong>Flight Issues:</strong>
              {results.issues.map((issue, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  {getIssueIcon(issue.type)}
                  <Typography variant="body2">
                    {issue.message}
                    {issue.time && ` (at ${formatTime(issue.time)})`}
                  </Typography>
                </Box>
              ))}
            </Typography>
          </Alert>
        )}

        {/* Flight Chart */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <TimelineIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Flight Trajectory</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ mb: 2 }}>
              <Grid container spacing={1}>
                <Grid item>
                  <Chip
                    label="Altitude"
                    color={selectedChart === 'altitude' ? 'primary' : 'default'}
                    onClick={() => setSelectedChart('altitude')}
                    size="small"
                  />
                </Grid>
                <Grid item>
                  <Chip
                    label="Velocity"
                    color={selectedChart === 'velocity' ? 'primary' : 'default'}
                    onClick={() => setSelectedChart('velocity')}
                    size="small"
                  />
                </Grid>
                <Grid item>
                  <Chip
                    label="Acceleration"
                    color={selectedChart === 'acceleration' ? 'primary' : 'default'}
                    onClick={() => setSelectedChart('acceleration')}
                    size="small"
                  />
                </Grid>
              </Grid>
            </Box>

            <Box sx={{ height: isMobile ? 300 : 400, width: '100%' }}>
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time" 
                    label={{ value: 'Time (s)', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    label={{ 
                      value: selectedChart === 'altitude' ? 'Altitude (m)' : 
                             selectedChart === 'velocity' ? 'Velocity (m/s)' : 
                             'Acceleration (G)', 
                      angle: -90, 
                      position: 'insideLeft' 
                    }}
                  />
                  <Tooltip 
                    formatter={(value: number) => [
                      formatNumber(value, 2),
                      selectedChart === 'altitude' ? 'Altitude (m)' : 
                      selectedChart === 'velocity' ? 'Velocity (m/s)' : 
                      'Acceleration (G)'
                    ]}
                    labelFormatter={(time: number) => `Time: ${formatNumber(time, 2)}s`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey={selectedChart} 
                    stroke={theme.palette.primary.main}
                    strokeWidth={2}
                    dot={false}
                  />
                  {/* Mark burnout */}
                  {burnoutPoint && (
                    <ReferenceLine 
                      x={burnoutPoint.time} 
                      stroke={theme.palette.warning.main}
                      strokeDasharray="5 5"
                      label="Burnout"
                    />
                  )}
                  {/* Mark apogee */}
                  {apogeePoint && selectedChart === 'altitude' && (
                    <ReferenceLine 
                      x={apogeePoint.time} 
                      stroke={theme.palette.success.main}
                      strokeDasharray="5 5"
                      label="Apogee"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Detailed Metrics */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <FlightIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Detailed Metrics</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>
                  <strong>Performance</strong>
                </Typography>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell>Burnout Altitude</TableCell>
                      <TableCell align="right">{formatNumber(results.burnoutAltitude)}m</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Burnout Velocity</TableCell>
                      <TableCell align="right">{formatNumber(results.burnoutVelocity)}m/s</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Apogee Time</TableCell>
                      <TableCell align="right">{formatTime(results.apogeeTime)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Recovery Time</TableCell>
                      <TableCell align="right">{formatTime(results.recoveryTime)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Landing Distance</TableCell>
                      <TableCell align="right">{formatNumber(results.landingDistance)}m</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>
                  <strong>Advanced Metrics</strong>
                </Typography>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell>Max Mach Number</TableCell>
                      <TableCell align="right">{formatNumber(results.maxMachNumber, 3)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Max Dynamic Pressure</TableCell>
                      <TableCell align="right">{formatNumber(results.maxDynamicPressure)}Pa</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Stability Margin</TableCell>
                      <TableCell align="right">{formatNumber(results.stabilityMargin, 2)} cal</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Performance Score</TableCell>
                      <TableCell align="right">
                        <Chip 
                          label={`${results.score}/100`}
                          color={getScoreColor(results.score)}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Weather Conditions */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <ParachuteIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Launch Conditions</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              <Grid item xs={6} sm={3}>
                <Typography variant="body2" color="text.secondary">Temperature</Typography>
                <Typography variant="h6">{weather.temperature}°C</Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="body2" color="text.secondary">Wind Speed</Typography>
                <Typography variant="h6">{weather.windSpeed}m/s</Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="body2" color="text.secondary">Wind Direction</Typography>
                <Typography variant="h6">{weather.windDirection}°</Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="body2" color="text.secondary">Humidity</Typography>
                <Typography variant="h6">{weather.humidity}%</Typography>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Telemetry Data Summary */}
        {telemetry.length > 0 && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Telemetry Data:</strong> {telemetry.length} data points recorded over {formatTime(results.flightTime)}
              <br />
              <strong>Simulation ID:</strong> {result.id}
              <br />
              <strong>Created:</strong> {new Date(result.createdAt).toLocaleString()}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
