// Every response body is one of these. Services return plain data; the controller adds the message.

export interface MessageResponseDto {
  message: string;
}

export interface DataResponseDto<T> extends MessageResponseDto {
  data: T;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  /** Items matching the query, across all pages. */
  total: number;
}

export interface PaginatedResponseDto<T> extends DataResponseDto<T[]> {
  meta: PaginationMeta;
}

/** One page of a list, as services return it. */
export interface Page<T> {
  items: T[];
  total: number;
}
