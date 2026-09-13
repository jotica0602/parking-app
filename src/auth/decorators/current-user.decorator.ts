import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '../../common/enums';

export interface AuthUser {
  userId: string;
  email: string;
  role: UserRole;
}

// Injects the authenticated user (extracted from the JWT) into the handler
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
