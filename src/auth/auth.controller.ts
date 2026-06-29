import { Body, Controller, Get, Param, Post, Patch, Res } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { BusinessSignupDto } from './dto/business-signup.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { LoginDto } from './dto/login.dto';
import { OAuthSignupDto } from './dto/oauth-signup.dto';
import { OperatorSignupDto } from './dto/operator-signup.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SubmitDocumentsDto } from './dto/submit-documents.dto';
import { UserSignupDto } from './dto/user-signup.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendCodeDto } from './dto/resend-code.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { DriverInviteSetupDto } from './dto/driver-invite-setup.dto';
import { DriverVerifySetupDto } from './dto/driver-verify-setup.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { InitiateOperatorSignupDto } from './dto/initiate-operator-signup.dto';
import { SetOperatorPasswordDto } from './dto/set-operator-password.dto';
import { CompleteOperatorProfileDto } from './dto/complete-operator-profile.dto';
import { ChangePasswordVerifyDto } from './dto/change-password-verify.dto';
import type { Response } from 'express';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true, // Must be true for sameSite: 'none'
  sameSite: 'none' as const, // Allows cross-domain cookies for Vercel <-> Backend
  path: '/',
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup/user')
  async signupUser(
    @Body() payload: UserSignupDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.authService.signupUser(payload);
    res.cookie('accessToken', data.accessToken, COOKIE_OPTIONS);
    res.cookie('refreshToken', data.refreshToken, COOKIE_OPTIONS);
    return data;
  }

  @Public()
  @Post('signup/business')
  async signupBusiness(
    @Body() payload: BusinessSignupDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.authService.signupBusiness(payload);
    res.cookie('accessToken', data.accessToken, COOKIE_OPTIONS);
    res.cookie('refreshToken', data.refreshToken, COOKIE_OPTIONS);
    return data;
  }

  @Public()
  @Post('signup/operator')
  async signupOperator(
    @Body() payload: OperatorSignupDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.authService.signupOperator(payload);
    res.cookie('accessToken', data.accessToken, COOKIE_OPTIONS);
    res.cookie('refreshToken', data.refreshToken, COOKIE_OPTIONS);
    return data;
  }

  @Public()
  @Post('operator/initiate-signup')
  initiateOperatorSignup(@Body() payload: InitiateOperatorSignupDto) {
    return this.authService.initiateOperatorSignup(payload);
  }

  @Roles(Role.OPERATOR)
  @Post('operator/set-password')
  setOperatorPassword(
    @CurrentUser('userId') userId: string,
    @Body() payload: SetOperatorPasswordDto
  ) {
    return this.authService.setOperatorPassword(userId, payload);
  }

  @Roles(Role.OPERATOR)
  @Post('operator/complete-profile')
  completeOperatorProfile(
    @CurrentUser('userId') userId: string,
    @Body() payload: CompleteOperatorProfileDto
  ) {
    return this.authService.completeOperatorProfile(userId, payload);
  }

  @Public()
  @Post('invitations/accept')
  async acceptInvitation(
    @Body() payload: AcceptInvitationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.authService.acceptInvitation(payload);
    res.cookie('accessToken', data.accessToken, COOKIE_OPTIONS);
    res.cookie('refreshToken', data.refreshToken, COOKIE_OPTIONS);
    return data;
  }

  @Roles(Role.OPERATOR, Role.ADMIN)
  @Post('invitations')
  createInvitation(@Body() payload: CreateInvitationDto) {
    return this.authService.createInvitation(payload);
  }

  @Roles(Role.USER)
  @Post('onboarding/business/:businessProfileId/documents')
  submitBusinessDocuments(
    @Param('businessProfileId') businessProfileId: string,
    @Body() payload: SubmitDocumentsDto,
  ) {
    return this.authService.submitBusinessDocuments(businessProfileId, payload);
  }

  @Roles(Role.OPERATOR)
  @Post('onboarding/operator/:operatorProfileId/documents')
  submitOperatorDocuments(
    @Param('operatorProfileId') operatorProfileId: string,
    @Body() payload: SubmitDocumentsDto,
  ) {
    return this.authService.submitOperatorDocuments(operatorProfileId, payload);
  }

  @Public()
  @Post('oauth/google')
  signupWithGoogle(@Body() payload: OAuthSignupDto) {
    return this.authService.signupWithGoogle(payload);
  }

  @Public()
  @Post('oauth/apple')
  signupWithApple(@Body() payload: OAuthSignupDto) {
    return this.authService.signupWithApple(payload);
  }

  @Public()
  @Post('login')
  async login(
    @Body() payload: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.authService.login(payload);
    res.cookie('accessToken', data.accessToken, COOKIE_OPTIONS);
    res.cookie('refreshToken', data.refreshToken, COOKIE_OPTIONS);
    return data;
  }

  @Public()
  @Post('driver/invite-setup')
  driverInviteSetup(@Body() payload: DriverInviteSetupDto) {
    return this.authService.driverInviteSetup(payload);
  }

  @Public()
  @Post('driver/verify-setup')
  async driverVerifySetup(
    @Body() payload: DriverVerifySetupDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.authService.driverVerifySetup(payload);
    res.cookie('accessToken', data.accessToken, COOKIE_OPTIONS);
    res.cookie('refreshToken', data.refreshToken, COOKIE_OPTIONS);
    return data;
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Body() payload: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.authService.refresh(payload);
    res.cookie('accessToken', data.accessToken, COOKIE_OPTIONS);
    res.cookie('refreshToken', data.refreshToken, COOKIE_OPTIONS);
    return data;
  }

  @Public()
  @Post('verify-email')
  async verifyEmail(
    @Body() payload: VerifyEmailDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.authService.verifyEmail(payload);
    res.cookie('accessToken', data.accessToken, COOKIE_OPTIONS);
    res.cookie('refreshToken', data.refreshToken, COOKIE_OPTIONS);
    return data;
  }

  @Public()
  @Post('resend-code')
  resendCode(@Body() payload: ResendCodeDto) {
    return this.authService.resendCode(payload);
  }

  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() payload: ForgotPasswordDto) {
    return this.authService.forgotPassword(payload);
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() payload: ResetPasswordDto) {
    return this.authService.resetPassword(payload);
  }

  @Public()
  @Post('logout')
  async logout(
    @Body() payload: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.authService.logout(payload);
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return data;
  }

  @Post('change-password-request')
  changePasswordRequest(@CurrentUser('userId') userId: string) {
    return this.authService.changePasswordRequest(userId);
  }

  @Post('change-password-verify')
  changePasswordVerify(
    @CurrentUser('userId') userId: string,
    @Body() payload: ChangePasswordVerifyDto,
  ) {
    return this.authService.changePasswordVerify(userId, payload);
  }

  @Get('me')
  getMe(@CurrentUser('userId') userId: string) {
    return this.authService.getMe(userId);
  }

  @Patch('me')
  updateMe(
    @CurrentUser('userId') userId: string,
    @Body() payload: UpdateProfileDto,
  ) {
    return this.authService.updateMe(userId, payload);
  }
}
