import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('BusinessOrdersController (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

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

    // Sign up a user to get an access token
    await request(app.getHttpServer())
      .post('/api/auth/signup/user')
      .send({
        email: 'business@example.com',
        phone: '+2348098765432',
        password: 'password123',
        fullName: 'Business User',
        gender: 'FEMALE',
        dob: '02/92',
      });

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'business@example.com', password: 'password123' });
    
    accessToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const quotePayload = {
    distanceKm: 15.5,
    vehicleType: 'BIKE',
    urgency: 'STANDARD',
  };

  it('/api/business/orders/quote (POST) - Unauthorized without token', () => {
    return request(app.getHttpServer())
      .post('/api/business/orders/quote')
      .send(quotePayload)
      .expect(401);
  });

  it('/api/business/orders/quote (POST) - Success with token', () => {
    return request(app.getHttpServer())
      .post('/api/business/orders/quote')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(quotePayload)
      .expect(201)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  it('/api/business/orders/quote (POST) - Rate Limit', async () => {
    // The limit is 10 requests per minute. We already made 2 requests above (one 401, one 201).
    // Let's make 8 more to reach the 10-request limit.
    for (let i = 0; i < 8; i++) {
      await request(app.getHttpServer())
        .post('/api/business/orders/quote')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(quotePayload)
        .expect(201);
    }

    // The 11th request should hit 429 Too Many Requests
    const response = await request(app.getHttpServer())
      .post('/api/business/orders/quote')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(quotePayload);
    
    expect(response.status).toBe(429);
  });
});
