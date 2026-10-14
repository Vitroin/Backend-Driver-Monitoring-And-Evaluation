import { Module } from "@nestjs/common";
import { TransactionService } from "./transactions.service";

@Module({
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionsModule {}