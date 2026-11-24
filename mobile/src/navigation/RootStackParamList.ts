import type { NavigatorScreenParams } from '@react-navigation/native';
import type { MainTabParamList } from './MainTabParamList';

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  FacilityDetails: { facilityId: string };
};
