import { AsyncLocalStorage } from 'node:async_hooks';
import type { ClientSession } from 'mongoose';

/** Holds the session of the transaction currently running in this request, if any. */
export const transactionContext = new AsyncLocalStorage<ClientSession>();