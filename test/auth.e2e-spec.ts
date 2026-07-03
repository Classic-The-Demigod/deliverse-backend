import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const testUser = {
    email: 'testuser@example.com',
    phone: '+2348012345678',
    password: 'password123',
    fullName: 'Test User',
    gender: 'MALE',
    dob: '01/90',
  };

  it('/api/auth/signup/user (POST)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/signup/user')
      .send(testUser);
    
    if (response.status !== 201) console.error(response.body);
    expect(response.status).toBe(201);
    expect(response.body.message).toBeDefined();
  });

  it('/api/auth/login (POST) - Success', () => {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password })
      .expect(201)
      .expect((res) => {
        expect(res.body.accessToken).toBeDefined();
      });
  });

  it('/api/auth/login (POST) - Rate Limit', async () => {
    // The limit is 5 requests per minute. We already made 1 login above.
    // Let's make 5 more to exceed the limit.
    for (let i = 0; i < 4; i++) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'wrongpassword' })
        .expect(401);
    }

    // The 6th request should hit 429 Too Many Requests
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    
    expect(response.status).toBe(429);
  });
});
