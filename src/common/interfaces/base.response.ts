export interface MessageResponseDto {
  message: string;
}

export interface DataResponseDto<T> extends MessageResponseDto {
  data: T;
}
