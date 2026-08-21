import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export type AuthRequest = Request & { userId?: string };

export function requireAuth(request: AuthRequest, response: Response, next: NextFunction) {
  const header = request.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) return response.status(401).json({ message: 'Authentication is required.' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string };
    request.userId = payload.userId;
    return next();
  } catch {
    return response.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  }
}
