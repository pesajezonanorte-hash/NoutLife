export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  gold: number;
  hp: number;
  maxHp: number;
  strength: number;
  intelligence: number;
  charisma: number;
  avatarConfig: AvatarConfig;
  avatarUrl?: string | null;
  timezone: string;
  currency: string;
  language: string;
  relationshipStatus: RelationshipStatus;
  onboardingCompleted: boolean;
  birthDate: string | null;
  currentStreak: number;
  longestStreak: number;
  gymPlaylistUrl?: string | null;
  equippedHat?: string | null;
  equippedAura?: string | null;
  equippedFrame?: string | null;
  equippedTheme?: string | null;
  createdAt: string;
}

export type HairStyle = 'short' | 'medium' | 'long' | 'shaved' | 'copete' | 'afro' | 'recogido' | 'trenzas' | 'ondulado';
export type Accessory = 'none' | 'glasses' | 'cap' | 'headband' | 'earrings' | 'scarf';
export type Expression = 'normal' | 'smile' | 'serious' | 'determined';
export type AvatarMode = 'pixel' | 'photo' | 'minecraft';

export interface AvatarConfig {
  bodyType?: 'male' | 'female';
  hairStyle: HairStyle;
  hairColor: string;
  skinColor: string;
  shirtColor: string;
  pants: string;
  accessory: Accessory;
  expression: Expression;
  pet: string | null;
  /** Determines which saved visual is rendered without deleting the others. */
  avatarMode?: AvatarMode;
  /** A normalized standard 64×64 Minecraft skin PNG stored as a data URL. */
  minecraftSkinUrl?: string | null;
}

export type RelationshipStatus =
  | 'SINGLE'
  | 'IN_RELATIONSHIP'
  | 'COMPLICATED'
  | 'PREFER_NOT_TO_SAY';

export interface AuthResponse {
  user: User;
  accessToken: string;
}

/** Sign-in is only through Google ID tokens. */
export interface OAuthPayload {
  provider: 'google';
  idToken: string;
  displayName?: string;
}
