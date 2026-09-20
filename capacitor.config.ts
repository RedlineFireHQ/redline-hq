import type { CapacitorConfig } from '@capacitor/cli';

const hostedAppUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.redlinehq.app',
  appName: 'Redline HQ',
  webDir: 'www',
  // Configure this at native build time with the hosted HTTPS Redline HQ URL.
  server: hostedAppUrl
    ? {
        url: hostedAppUrl,
        cleartext: false,
      }
    : undefined,
};

export default config;
