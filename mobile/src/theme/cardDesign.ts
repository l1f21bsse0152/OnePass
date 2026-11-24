export type CardSkinId =
  | 'year'
  | 'christmas'
  | 'valentine'
  | 'summer';
export type CardAccentId = 'azure' | 'mint' | 'violet' | 'gold';

export interface CardDesignSelection {
  skinId: CardSkinId;
  accentId: CardAccentId;
}

export const CARD_DESIGN_STORAGE_KEY = 'onepass_card_design';
export const DEFAULT_CARD_DESIGN: CardDesignSelection = {
  skinId: 'year',
  accentId: 'gold',
};

export const cardSkins: {
  id: CardSkinId;
  name: string;
  description: string;
  color: string;
  textColor: string;
  accent: string;
}[] = [
  {
    id: 'year',
    name: 'For Year',
    description: 'Annual Member',
    color: '#4A32B8',
    textColor: '#FFFFFF',
    accent: '#FCD34D',
  },
  {
    id: 'christmas',
    name: 'Christmas',
    description: 'Holiday Festive',
    color: '#157147',
    textColor: '#FFFFFF',
    accent: '#FEF08A',
  },
  {
    id: 'valentine',
    name: 'Valentine',
    description: 'Sweet Coral',
    color: '#F43F5E',
    textColor: '#FFFFFF',
    accent: '#FFE4E6',
  },
  {
    id: 'summer',
    name: 'Cool Summer',
    description: 'Breeze Ocean',
    color: '#0284C7',
    textColor: '#FFFFFF',
    accent: '#FEF08A',
  },
];

export const cardAccents: {
  id: CardAccentId;
  label: string;
  color: string;
}[] = [
  { id: 'azure', label: 'Azure', color: '#0EA5E9' },
  { id: 'mint', label: 'Mint', color: '#10B981' },
  { id: 'violet', label: 'Violet', color: '#818CF8' },
  { id: 'gold', label: 'Gold', color: '#F59E0B' },
];

export function parseCardDesign(value: string | null): CardDesignSelection {
  if (!value) return DEFAULT_CARD_DESIGN;
  const [skinId, accentId] = value.split(':');
  const legacySkinMap: Record<string, CardSkinId> = {
    aether: 'year',
    obsidian: 'year',
    emerald: 'christmas',
    cyber: 'summer',
    champagne: 'valentine',
    solar: 'valentine',
  };
  const normalizedSkinId = legacySkinMap[skinId] ?? skinId;
  return {
    skinId: cardSkins.some((skin) => skin.id === normalizedSkinId)
      ? (normalizedSkinId as CardSkinId)
      : DEFAULT_CARD_DESIGN.skinId,
    accentId: cardAccents.some((accent) => accent.id === accentId)
      ? (accentId as CardAccentId)
      : DEFAULT_CARD_DESIGN.accentId,
  };
}

export function serializeCardDesign(selection: CardDesignSelection) {
  return `${selection.skinId}:${selection.accentId}`;
}

export function getCardSkin(id: CardSkinId) {
  return cardSkins.find((skin) => skin.id === id) ?? cardSkins[0];
}

export function getCardAccent(id: CardAccentId) {
  return cardAccents.find((accent) => accent.id === id) ?? cardAccents[0];
}

export function createMemberNumber(userId?: string | null) {
  const suffix = userId?.replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase();
  return suffix ? `OP-${suffix}` : 'OP-MEMBER';
}
