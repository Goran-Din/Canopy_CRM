import type { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env.js';
import * as authService from './service.js';

const REFRESH_COOKIE = 'refresh_token';

export async function loginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);

    res.cookie(REFRESH_COOKIE, result.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: result.refreshExpirySeconds * 1000,
    });

    res.status(200).json({
      status: 'success',
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function refreshHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const refreshToken = req.cookies[REFRESH_COOKIE];
    if (!refreshToken) {
      res.status(401).json({ status: 'error', message: 'No refresh token provided' });
      return;
    }

    const result = await authService.refresh(refreshToken);

    res.status(200).json({
      status: 'success',
      data: {
        accessToken: result.accessToken,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function logoutHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const refreshToken = req.cookies[REFRESH_COOKIE];
    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    res.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    res.status(200).json({ status: 'success', message: 'Logged out' });
  } catch (err) {
    next(err);
  }
}
