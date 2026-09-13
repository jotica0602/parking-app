import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../common/enums';

export const ROLES_KEY = 'roles';

// Restricts an endpoint to the specified roles
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
