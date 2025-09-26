/**
 * Responsive Demo Component
 * 
 * Demonstrates mobile responsiveness features of the rocket designer.
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  useTheme,
  useMediaQuery,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  PhoneIphone as MobileIcon,
  Tablet as TabletIcon,
  Computer as DesktopIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';

export const ResponsiveDemo: React.FC = () => {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const isSm = useMediaQuery(theme.breakpoints.down('md'));
  const isMd = useMediaQuery(theme.breakpoints.down('lg'));

  const getCurrentBreakpoint = () => {
    if (isXs) return { name: 'Mobile', icon: <MobileIcon />, color: 'error' as const };
    if (isSm) return { name: 'Tablet', icon: <TabletIcon />, color: 'warning' as const };
    if (isMd) return { name: 'Desktop (Medium)', icon: <DesktopIcon />, color: 'info' as const };
    return { name: 'Desktop (Large)', icon: <DesktopIcon />, color: 'success' as const };
  };

  const breakpoint = getCurrentBreakpoint();

  const responsiveFeatures = [
    'Collapsible accordion sections for rocket configuration',
    'Stacked layout on mobile, side-by-side on desktop',
    'Touch-friendly buttons and controls',
    'Optimized chart sizes for different screen sizes',
    'Fullscreen dialogs on mobile for better UX',
    'Responsive grid layouts that adapt to screen size',
    'Scroll-to-results behavior on mobile after launch',
    'Flexible typography that scales appropriately'
  ];

  return (
    <Card elevation={2} sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Typography variant="h6">
            Mobile Responsive Design
          </Typography>
          <Chip
            icon={breakpoint.icon}
            label={`Current: ${breakpoint.name}`}
            color={breakpoint.color}
            size="small"
          />
        </Box>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          The KidRocket Designer adapts to all screen sizes for optimal user experience.
        </Typography>

        <Grid container spacing={3} sx={{ mt: 2 }}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>
              <strong>Responsive Features:</strong>
            </Typography>
            <List dense>
              {responsiveFeatures.slice(0, 4).map((feature, index) => (
                <ListItem key={index} sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <CheckIcon color="success" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText 
                    primary={feature}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
              ))}
            </List>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>
              <strong>Additional Features:</strong>
            </Typography>
            <List dense>
              {responsiveFeatures.slice(4).map((feature, index) => (
                <ListItem key={index} sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <CheckIcon color="success" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText 
                    primary={feature}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
              ))}
            </List>
          </Grid>
        </Grid>

        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            <strong>Try it:</strong> Resize your browser window or view on different devices to see the responsive design in action!
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};
