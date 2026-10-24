import { Model, QueryFilter, UpdateQuery, ProjectionType, QueryOptions, HydratedDocument, SortOrder } from 'mongoose';
import type { Page } from '../interfaces/base.response';
import { skipFor, type PaginationQuery } from '../types/pagination';

export abstract class BaseRepository<T> {
  protected constructor(protected readonly model: Model<T>) {}

  async create(data: Partial<T>): Promise<HydratedDocument<T>> {
    return this.model.create(data);
  }

  async findById(id: string, projection?: ProjectionType<T>): Promise<HydratedDocument<T> | null> {
    return this.model.findById(id, projection).exec();
  }

  async findOne(filter: QueryFilter<T>, projection?: ProjectionType<T>): Promise<HydratedDocument<T> | null> {
    return this.model.findOne(filter, projection).exec();
  }

  async find(filter: QueryFilter<T> = {}, projection?: ProjectionType<T>, options?: QueryOptions<T>): Promise<HydratedDocument<T>[]> {
    return this.model.find(filter, projection, options).exec();
  }

  /** One page of the documents matching `filter`, newest first unless `sort` says otherwise, with the total count. */
  async findPage(
    filter: QueryFilter<T>,
    pagination: PaginationQuery,
    { projection, sort = { _id: -1 } }: { projection?: ProjectionType<T>; sort?: Record<string, SortOrder> } = {},
  ): Promise<Page<HydratedDocument<T>>> {
    const [items, total] = await Promise.all([
      this.model.find(filter, projection).sort(sort).skip(skipFor(pagination)).limit(pagination.limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async updateById(id: string, update: UpdateQuery<T>): Promise<HydratedDocument<T> | null> {
    return this.model.findByIdAndUpdate(id, update, { new: true, runValidators: true }).exec();
  }

  async updateOne(filter: QueryFilter<T>, update: UpdateQuery<T>): Promise<HydratedDocument<T> | null> {
    return this.model.findOneAndUpdate(filter, update, { new: true, runValidators: true }).exec();
  }

  async deleteById(id: string): Promise<HydratedDocument<T> | null> {
    return this.model.findByIdAndDelete(id).exec();
  }

  async exists(filter: QueryFilter<T>): Promise<boolean> {
    return (await this.model.exists(filter)) !== null;
  }

  async count(filter: QueryFilter<T> = {}): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }
}
