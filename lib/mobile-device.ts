export type MobileDeviceSignals = {
  isNative: boolean;
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
};

const MOBILE_USER_AGENT = /Android|iPhone|iPod|iPad|IEMobile|Windows Phone/i;

export function shouldUseMobileInterface(signals: MobileDeviceSignals): boolean {
  if (signals.isNative || MOBILE_USER_AGENT.test(signals.userAgent)) {
    return true;
  }

  // iPadOS can present a desktop Mac user agent in Safari.
  return signals.platform === "MacIntel" && signals.maxTouchPoints > 1;
}