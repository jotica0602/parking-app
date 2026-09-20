import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Connection } from 'mongoose';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/config/app/configure-app';

type Http = ReturnType<typeof request>;
type Auth = string | { token: string };

export type TestApp = {
  app: INestApplication;
  dataSource: DataSource;
  jwt: JwtService;
  get(path: string, auth?: Auth): ReturnType<Http['get']>;
  post(path: string, body?: object, auth?: Auth): ReturnType<Http['post']>;
  put(path: string, body?: object, auth?: Auth): ReturnType<Http['put']>;
  delete(path: string, auth?: Auth): ReturnType<Http['delete']>;
  reset(): Promise<void>;
  close(): Promise<void>;
};

export async function createTestApp(): Promise<TestApp> {
  const postgresDb = process.env.POSTGRES_DB ?? '';
  const mongoUri = process.env.MONGO_URI ?? '';
  if (
    process.env.NODE_ENV !== 'test' ||
    !postgresDb.includes('test') ||
    !mongoUri.includes('test')
  ) {
    throw new Error(
      `E2E tests must use test databases. NODE_ENV=${process.env.NODE_ENV} POSTGRES_DB=${postgresDb}`,
    );
  }

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const nestApp = configureApp(moduleRef.createNestApplication());
  await nestApp.init();

  const dataSource = nestApp.get(DataSource);
  const mongo = nestApp.get<Connection>(getConnectionToken());
  const http = request(nestApp.getHttpServer());

  const call = (method: 'get' | 'post' | 'put' | 'delete', path: string, auth?: Auth) => {
    const req = http[method](`/api${path}`);
    if (auth) {
      req.auth(typeof auth === 'string' ? auth : auth.token, { type: 'bearer' });
    }
    return req;
  };

  return {
    app: nestApp,
    dataSource,
    jwt: nestApp.get(JwtService),
    get: (path, auth) => call('get', path, auth),
    post: (path, body, auth) => {
      const req = call('post', path, auth);
      return body ? req.send(body) : req;
    },
    put: (path, body, auth) => {
      const req = call('put', path, auth);
      return body ? req.send(body) : req;
    },
    delete: (path, auth) => call('delete', path, auth),
    reset: () => reset(dataSource, mongo),
    close: () => nestApp.close(),
  };
}

async function reset(dataSource: DataSource, mongo: Connection): Promise<void> {
  const tables = dataSource.entityMetadatas.map((m) => `"${m.tableName}"`);
  if (tables.length) {
    await dataSource.query(
      `TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`,
    );
  }
  if (mongo.db) {
    const collections = await mongo.db.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
  }
}
