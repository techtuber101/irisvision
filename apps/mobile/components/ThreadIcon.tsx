import React from 'react';
import { MessageSquareMore } from 'lucide-react-native';

interface ThreadIconProps {
  iconName?: string | null;
  size?: number;
  color?: string;
}

export function ThreadIcon({
  iconName,
  size = 16,
  color = '#666666'
}: ThreadIconProps) {
  // If no icon name is provided, use MessageSquareMore as fallback
  if (!iconName) {
    return <MessageSquareMore size={size} color={color} />;
  }

  // Try to dynamically import the icon
  try {
    // Convert kebab-case to PascalCase for Lucide React Native
    const pascalCaseName = iconName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
    
    // Dynamic import of Lucide React Native icons
    const IconComponent = require('lucide-react-native')[pascalCaseName];
    
    if (IconComponent) {
      return <IconComponent size={size} color={color} />;
    }
  } catch (error) {
    // If dynamic import fails, fall back to MessageSquareMore
    console.warn(`Failed to load icon: ${iconName}`, error);
  }

  // Fallback to MessageSquareMore
  return <MessageSquareMore size={size} color={color} />;
}
