import React, { useState } from 'react';
import {
  Image,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type IconName = React.ComponentProps<
  typeof MaterialCommunityIcons
>['name'];

const photos = {
  fitness:
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=80',
  workspace:
    'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80',
  wellness:
    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=900&q=80',
  library:
    'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=900&q=80',
};

function getFacilityPhoto(name: string, category: string) {
  const searchText = `${name} ${category}`.toLowerCase();

  if (searchText.includes('fitness') || searchText.includes('gym')) {
    return { uri: photos.fitness, icon: 'dumbbell' as IconName };
  }
  if (
    searchText.includes('workspace') ||
    searchText.includes('cowork') ||
    searchText.includes('work')
  ) {
    return { uri: photos.workspace, icon: 'briefcase-outline' as IconName };
  }
  if (
    searchText.includes('library') ||
    searchText.includes('libraries')
  ) {
    return {
      uri: photos.library,
      icon: 'book-open-page-variant' as IconName,
    };
  }

  return { uri: photos.wellness, icon: 'spa-outline' as IconName };
}

export default function FacilityPhoto({
  name,
  category,
  style,
  iconColor,
}: {
  name: string;
  category: string;
  style?: StyleProp<ViewStyle>;
  iconColor: string;
}) {
  const [failed, setFailed] = useState(false);
  const photo = getFacilityPhoto(name, category);

  return (
    <View style={[styles.container, style]}>
      <MaterialCommunityIcons
        name={photo.icon}
        size={36}
        color={iconColor}
      />
      {!failed && (
        <Image
          source={{ uri: photo.uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFailed(true)}
          accessibilityLabel={`${name} ${category} photo`}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
