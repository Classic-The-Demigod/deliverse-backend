import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class PremblyService {
  private readonly logger = new Logger(PremblyService.name);
  private readonly baseUrl: string;
  private readonly appId: string;
  private readonly secretKey: string;

  constructor() {
    // For testing, default to Sandbox API if env is not explicitly set to live
    this.baseUrl = process.env.PREMBLY_BASE_URL || 'https://sandbox.api.prembly.com';
    this.appId = process.env.PREMBLY_APP_ID || 'sandbox_app_id';
    this.secretKey = process.env.PREMBLY_SECRET_KEY || 'sandbox_secret_key';
  }

  private get headers() {
    return {
      'app-id': this.appId,
      'x-api-key': this.secretKey,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Verifies the Business Registration (CAC) Number.
   */
  async verifyBusiness(rcNumber: string): Promise<any> {
    try {
      // Identitypass CAC Verification Endpoint
      const response = await axios.post(
        `${this.baseUrl}/api/v2/biometrics/merchant/data/verification/cac`,
        { rc_number: rcNumber, company_type: 'RC' },
        { headers: this.headers }
      );

      if (response.data.status === true) {
        return response.data.data;
      }
      throw new BadRequestException('CAC verification failed or RC number not found.');
    } catch (error: any) {
      this.logger.error(`verifyBusiness error: ${error.message}`);
      
      // Sandbox fallback: auto-approve if we are using the fallback keys
      if (this.appId === 'sandbox_app_id') {
        this.logger.warn('Mocking verifyBusiness success for sandbox.');
        return { company_name: 'Mocked Company Ltd', registration_date: '2023-01-01' };
      }

      throw new BadRequestException(error.response?.data?.message || 'Failed to verify RC Number');
    }
  }

  /**
   * Verifies a National Identity Number (NIN).
   */
  async verifyNIN(nin: string): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v2/biometrics/merchant/data/verification/nin_wo_face`,
        { number: nin },
        { headers: this.headers }
      );

      if (response.data.status === true) {
        return response.data.data;
      }
      throw new BadRequestException('NIN verification failed or not found.');
    } catch (error: any) {
      this.logger.error(`verifyNIN error: ${error.message}`);
      
      if (this.appId === 'sandbox_app_id') {
        this.logger.warn('Mocking verifyNIN success for sandbox.');
        return { firstName: 'Mocked', lastName: 'User' };
      }

      throw new BadRequestException(error.response?.data?.message || 'Failed to verify NIN');
    }
  }

  /**
   * Verifies a Driver's License Number.
   */
  async verifyDriverLicense(licenseNumber: string): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v2/biometrics/merchant/data/verification/drivers_license`,
        { number: licenseNumber },
        { headers: this.headers }
      );

      if (response.data.status === true) {
        return response.data.data;
      }
      throw new BadRequestException('Driver License verification failed.');
    } catch (error: any) {
      this.logger.error(`verifyDriverLicense error: ${error.message}`);
      
      if (this.appId === 'sandbox_app_id') {
        this.logger.warn('Mocking verifyDriverLicense success for sandbox.');
        return { firstName: 'Mocked', lastName: 'Driver' };
      }

      throw new BadRequestException(error.response?.data?.message || 'Failed to verify Driver License');
    }
  }

  /**
   * Verifies a Vehicle License Plate.
   */
  async verifyVehicle(licensePlate: string): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v2/biometrics/merchant/data/verification/vehicle`,
        { vehicle_number: licensePlate },
        { headers: this.headers }
      );

      if (response.data.status === true) {
        return response.data.data;
      }
      throw new BadRequestException('Vehicle License Plate verification failed.');
    } catch (error: any) {
      this.logger.error(`verifyVehicle error: ${error.message}`);
      
      if (this.appId === 'sandbox_app_id') {
        this.logger.warn('Mocking verifyVehicle success for sandbox.');
        return { licensePlate, make: 'Mocked', color: 'White' };
      }

      throw new BadRequestException(error.response?.data?.message || 'Failed to verify License Plate');
    }
  }
}
