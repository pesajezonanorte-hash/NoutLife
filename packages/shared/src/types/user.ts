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
  /** Días sin actividad que la racha general aguanta (protectores de la Tienda). */
  streakShieldDays?: number;
  /** Cómo se identifica (onboarding y Ajustes). Solo 'female' abre la zona Ciclo. Null en cuentas anteriores. */
  gender?: Gender | null;
  coliseoPlaylistUrl?: string | null;
  equippedHat?: string | null;
  equippedAura?: string | null;
  equippedFrame?: string | null;
  equippedTheme?: string | null;
  createdAt: string;
  /** Plan del usuario. Llega al iniciar sesión, al renovar la sesión y en /auth/me. */
  subscription?: Subscription | null;
}

/** 'trialing' prueba de 7 días · 'active' mes pagado · 'canceled' Pro hasta fin de periodo · 'lite' gratis con límites */
/** 'pending_approval': un cobro de Nequi espera la aprobación del celular. La API lo deriva del cobro; no se guarda como estado. */
export type SubscriptionStatus = 'trialing' | 'active' | 'canceled' | 'lite' | 'pending_approval';
export type Plan = 'pro' | 'lite';

export interface Subscription {
  status: SubscriptionStatus;
  plan: Plan;
  trialEndsAt: string;
  currentPeriodEnd: string | null;
  /** Fin del Pro ya concedido (prueba o mes pagado). null en Lite. */
  accessEndsAt: string | null;
  /** Se cobrará automáticamente al vencer. */
  renews: boolean;
  /** Pro de cortesía: sin cobros ni vencimiento. La lista la decide el servidor (COMP_PRO_EMAILS). Ausente en APIs anteriores. */
  complimentary?: boolean;
  hasPaymentMethod: boolean;
  /** Solo para mostrar: «VISA •••• 4242» o «NEQUI •••• 1703». */
  paymentMethodLabel: string | null;
  /** Tipo del medio de pago. Sirve para decir en qué app aprobar un cobro. */
  paymentMethodType?: 'CARD' | 'NEQUI' | null;
  liteSince: string | null;
  lastPaymentError: string | null;
  pendingPayment: boolean;
  /** Puede empezar los 7 días de Pro vinculando un medio de pago (el servidor lo confirma al vincularlo). */
  trialAvailable: boolean;
  /**
   * Paywall de entrada: no entra al Dashboard hasta vincular un medio de pago.
   * Lo decide la API (false sin llaves de Wompi). Ausente en APIs anteriores: no bloquea.
   */
  paywall?: boolean;
  priceCop: number;
  trialDays: number;
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

export type Gender = 'female' | 'male' | 'other' | 'unspecified';

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
