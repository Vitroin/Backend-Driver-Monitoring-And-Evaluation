import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { transactionContext } from './transactions.context';

@Injectable()
export class TransactionService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  /** Runs `work` in a transaction. Nested calls join the outer transaction instead of opening a new one. */
  run<T>(work: () => Promise<T>): Promise<T> {
    if (transactionContext.getStore()) return work();
    return this.connection.transaction((session) => transactionContext.run(session, work));
  }
}