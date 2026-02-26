import { GoBlink } from '@urban-blazer/goblink-sdk';

let instance: GoBlink;

export function getSDK(): GoBlink {
  if (!instance) {
    instance = new GoBlink({
      timeout: 30_000,
      cacheTtl: 300_000,
    });
  }
  return instance;
}
