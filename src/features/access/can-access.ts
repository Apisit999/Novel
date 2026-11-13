export type Access = "free" | "premium";
export type EpisodeAccess = Access | "inherit";

export type SubscriptionStatus = "active" | "past_due" | "canceled";

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  /** วันหมดรอบบิลปัจจุบัน — ใช้ตัดสินกรณี canceled แต่ยังไม่หมดรอบ */
  currentPeriodEnd: Date | null;
}

export interface AccessInput {
  titleAccess: Access;
  episodeAccess: EpisodeAccess;
  /** ผู้ใช้ที่ล็อกอิน; null = ผู้เยี่ยมชม */
  user: { subscription: SubscriptionInfo | null } | null;
  paywallEnabled: boolean;
  now?: Date;
}

export type AccessDecision =
  | { allowed: true; reason: "free" | "paywall-off" | "subscriber" }
  | { allowed: false; reason: "login-required" | "subscription-required" };

export function effectiveAccess(titleAccess: Access, episodeAccess: EpisodeAccess): Access {
  return episodeAccess === "inherit" ? titleAccess : episodeAccess;
}

/** สมาชิกมีสิทธิ์ถ้า active หรือ canceled แต่ยังไม่หมดรอบบิล (past_due ไม่ให้สิทธิ์) */
export function hasActiveSubscription(sub: SubscriptionInfo | null, now: Date): boolean {
  if (!sub) return false;
  if (sub.status === "active") return true;
  if (sub.status === "canceled" && sub.currentPeriodEnd) {
    return sub.currentPeriodEnd.getTime() > now.getTime();
  }
  return false;
}

/**
 * จุดตัดสินสิทธิ์จุดเดียวของทั้งเว็บ (ต้องตรงกับฟังก์ชัน SQL can_access ในฐานข้อมูล)
 */
export function canAccess(input: AccessInput): AccessDecision {
  const { titleAccess, episodeAccess, user, paywallEnabled, now = new Date() } = input;

  if (effectiveAccess(titleAccess, episodeAccess) === "free") {
    return { allowed: true, reason: "free" };
  }
  if (!paywallEnabled) return { allowed: true, reason: "paywall-off" };
  if (!user) return { allowed: false, reason: "login-required" };
  if (hasActiveSubscription(user.subscription, now)) {
    return { allowed: true, reason: "subscriber" };
  }
  return { allowed: false, reason: "subscription-required" };
}
