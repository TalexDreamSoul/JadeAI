export interface DatabaseAdapter {
  db: any;
  initialize(): Promise<void>;
  transaction<T>(operation: (transaction: any) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
