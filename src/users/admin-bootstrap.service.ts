import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Creates (or syncs) the admin defined in ADMIN_EMAIL / ADMIN_PASSWORD on startup.
 */
@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get('NODE_ENV') === 'test') {
      return;
    }

    const email = this.config.get<string>('ADMIN_EMAIL')?.trim();
    const password = this.config.get<string>('ADMIN_PASSWORD');
    const name = this.config.get<string>('ADMIN_NAME')?.trim() || 'Admin';

    if (!email && !password) {
      this.logger.warn(
        'ADMIN_EMAIL and ADMIN_PASSWORD are not set; skipping admin bootstrap',
      );
      return;
    }

    if (!email || !password) {
      throw new Error(
        'Both ADMIN_EMAIL and ADMIN_PASSWORD must be set to bootstrap the admin',
      );
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(
        `ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );
    }

    const result = await this.usersService.ensureBootstrapAdmin({
      name,
      email,
      password,
    });

    if (result === 'created') {
      this.logger.log(`Created admin user ${email}`);
    } else if (result === 'updated') {
      this.logger.log(`Updated admin user ${email} from environment`);
    }
  }
}
