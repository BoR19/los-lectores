import { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'user' | 'lecturador';

export interface User {
  id: string;
  name: string;
  username?: string;
  email?: string;
  address: string;
  phone: string;
  createdAt: Timestamp;
  role: UserRole;
  lastReadingValue?: number;
  lastReadingDate?: string;
  customerNumber?: string;
  meterId?: string;
}

export interface Reading {
  id: string;
  userId: string;
  lecturadorId: string;
  value: number;
  imageUrl?: string;
  date: Timestamp;
  previousValue?: number;
  consumption?: number;
}

export interface Invoice {
  id: string;
  userId: string;
  readingId: string;
  amount: number;
  status: 'pending' | 'paid';
  date: Timestamp;
  dueDate?: Timestamp;
  consumption: number;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
