import { Injectable, Logger, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class MonnifyService {
  private readonly logger = new Logger(MonnifyService.name);
  private readonly baseUrl = 'https://sandbox.monnify.com/api/v1'; // Use config for production
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly contractCode: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('MONNIFY_API_KEY') || 'MK_TEST_PLACEHOLDER';
    this.secretKey = this.configService.get<string>('MONNIFY_SECRET_KEY') || 'SK_TEST_PLACEHOLDER';
    this.contractCode = this.configService.get<string>('MONNIFY_CONTRACT_CODE') || '1234567890';
  }

  private async getAccessToken() {
    const auth = Buffer.from(`${this.apiKey}:${this.secretKey}`).toString('base64');
    try {
      const response = await axios.post(
        `${this.baseUrl}/auth/login`,
        {},
        {
          headers: {
            Authorization: `Basic ${auth}`,
          },
        },
      );
      return response.data.responseBody.accessToken;
    } catch (error: any) {
      this.logger.error('Monnify auth failed', error.response?.data || error.message);
      throw new InternalServerErrorException('Failed to authenticate with Monnify');
    }
  }

  async initializePayment(email: string, amountKobo: number, reference: string) {
    const token = await this.getAccessToken();
    const amountNaira = amountKobo / 100; // Monnify takes amount in major currency

    try {
      const response = await axios.post(
        `${this.baseUrl}/merchant/transactions/init-transaction`,
        {
          amount: amountNaira,
          customerName: email, // Assuming name is not strictly required or use email
          customerEmail: email,
          paymentReference: reference,
          paymentDescription: `Deliverse Order ${reference}`,
          currencyCode: 'NGN',
          contractCode: this.contractCode,
          paymentMethods: ['CARD', 'ACCOUNT_TRANSFER', 'USSD'],
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return {
        checkoutUrl: response.data.responseBody.checkoutUrl,
        accessCode: response.data.responseBody.transactionReference,
        reference,
      };
    } catch (error: any) {
      this.logger.error('Monnify initialization failed', error.response?.data || error.message);
      throw new InternalServerErrorException('Failed to initialize Monnify payment');
    }
  }

  async chargeAuthorization(email: string, amountKobo: number, authorizationCode: string, reference: string) {
    const token = await this.getAccessToken();
    const amountNaira = amountKobo / 100;

    try {
      const response = await axios.post(
        `${this.baseUrl}/merchant/transactions/charge-card-token`,
        {
          amount: amountNaira,
          customerEmail: email,
          paymentReference: reference,
          paymentDescription: `Deliverse Order ${reference}`,
          currencyCode: 'NGN',
          contractCode: this.contractCode,
          cardToken: authorizationCode,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const status = response.data.responseBody.paymentStatus;
      if (status !== 'PAID') {
        throw new BadRequestException(`Payment failed: ${response.data.responseMessage}`);
      }

      return {
        status: 'success',
        reference,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Monnify charge token failed', error.response?.data || error.message);
      throw new BadRequestException('Failed to charge saved card with Monnify. Please try a new card.');
    }
  }
}
