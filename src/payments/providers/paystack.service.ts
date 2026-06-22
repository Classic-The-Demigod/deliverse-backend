import { Injectable, Logger, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private readonly baseUrl = 'https://api.paystack.co';
  private readonly secretKey: string;

  constructor(private configService: ConfigService) {
    this.secretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY') || 'sk_test_placeholder';
  }

  async initializePayment(email: string, amountKobo: number, reference: string) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        {
          email,
          amount: amountKobo,
          reference,
          channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return {
        checkoutUrl: response.data.data.authorization_url,
        accessCode: response.data.data.access_code,
        reference: response.data.data.reference,
      };
    } catch (error: any) {
      this.logger.error('Paystack initialization failed', error.response?.data || error.message);
      throw new InternalServerErrorException('Failed to initialize Paystack payment');
    }
  }

  async chargeAuthorization(email: string, amountKobo: number, authorizationCode: string, reference: string) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transaction/charge_authorization`,
        {
          email,
          amount: amountKobo,
          authorization_code: authorizationCode,
          reference,
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const status = response.data.data.status;
      if (status !== 'success') {
        throw new BadRequestException(`Payment failed: ${response.data.data.gateway_response}`);
      }

      return {
        status: 'success',
        reference: response.data.data.reference,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Paystack charge authorization failed', error.response?.data || error.message);
      throw new BadRequestException('Failed to charge saved card. Please try a new card.');
    }
  }

  async listBanks() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/bank?country=nigeria`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        }
      );
      return response.data.data;
    } catch (error: any) {
      this.logger.error('Failed to list banks from Paystack', error.response?.data || error.message);
      throw new InternalServerErrorException('Failed to list banks');
    }
  }

  async resolveAccountNumber(accountNumber: string, bankCode: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        }
      );
      return response.data.data;
    } catch (error: any) {
      this.logger.error('Failed to resolve account number', error.response?.data || error.message);
      throw new BadRequestException('Invalid account number or bank code');
    }
  }
}
