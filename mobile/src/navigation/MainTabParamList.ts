import type { NavigatorScreenParams } from '@react-navigation/native';
import type { ProfileStackParamList } from './ProfileStackParamList';
import type { WalletStackParamList } from './WalletStackParamList';

export type MainTabParamList = {
  Home: undefined;
  Explore: undefined;
  Scan: undefined;
  Wallet: NavigatorScreenParams<WalletStackParamList> | undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
  Assistant: undefined;
  MonthlyHistory: undefined;
};
