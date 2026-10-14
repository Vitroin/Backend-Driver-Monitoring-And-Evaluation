import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';

interface SetOptions<T> {
  key: string;
  value: T;
  /** Lifetime in seconds. Omit to keep the value until it's deleted. */
  ttl?: number;
}

/** Thin wrapper over cache-manager: TTLs in seconds, and an atomic `take` for single-use values. */
@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  async get<T>(key: string): Promise<T | undefined> {
    return this.cacheManager.get<T>(key);
  }

  async set<T>({ key, value, ttl }: SetOptions<T>): Promise<void> {
    await this.cacheManager.set(key, value, ttl === undefined ? undefined : ttl * 1000);
  }

  /**
   * Reads and deletes a key so it can be used exactly once, even under concurrent requests:
   * only the caller whose delete actually removes the key gets the value.
   */
  async take<T>(key: string): Promise<T | undefined> {
    const value = await this.cacheManager.get<T>(key);
    if (value === undefined) return undefined;
    const removed = await Promise.all(this.cacheManager.stores.map((store) => store.delete(key)));
    return removed.some(Boolean) ? value : undefined;
  }

  /** @returns true if the key existed and was removed. */
  async delete(key: string): Promise<boolean> {
    const removed = await Promise.all(this.cacheManager.stores.map((store) => store.delete(key)));
    return removed.some(Boolean);
  }
}
