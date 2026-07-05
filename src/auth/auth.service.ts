import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  NotImplementedException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  AuthProvider,
  DocumentType,
  InvitationStatus,
  OnboardingStatus,
  Prisma,
  Role,
  SignupChannel,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { BusinessSignupDto } from './dto/business-signup.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { LoginDto } from './dto/login.dto';
import { OAuthSignupDto } from './dto/oauth-signup.dto';
import { OperatorSignupDto } from './dto/operator-signup.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SubmitDocumentsDto } from './dto/submit-documents.dto';
import { UserSignupDto } from './dto/user-signup.dto';
import { MailService } from '../mail/mail.service';
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
import { PremblyService } from '../prembly/prembly.service';
import { VerifyOperatorDto } from './dto/verify-operator.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly premblyService: PremblyService,
  ) {}

  private async generateAndSendVerificationCode(userId: string, email: string, isPasswordReset = false, length = 4) {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    const code = Math.floor(min + Math.random() * (max - min + 1)).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    const hashedCode = await argon2.hash(code);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Dev] Verification Code generated for ${email}: ${code}`);
    }

    await this.prisma.verificationCode.create({
      data: {
        userId,
        code: hashedCode,
        expiresAt,
      },
    });

    if (isPasswordReset) {
      await this.mailService.sendPasswordResetEmail(email, code);
    } else {
      await this.mailService.sendVerificationEmail(email, code);
    }
  }


  async signupUser(payload: UserSignupDto) {
    const email = requireValue(normalizeEmail(payload.email), 'email');
    const phone = requireValue(normalizePhone(payload.phone), 'phone');
    await this.assertUserDoesNotExist(email, phone);

    let passwordHash: string | null = null;
    let provider: AuthProvider = AuthProvider.LOCAL;
    
    if (payload.oauthToken) {
      try {
        const decoded = this.jwtService.verify(payload.oauthToken);
        if (decoded.email !== email) throw new BadRequestException('Email mismatch');
        provider = decoded.provider as AuthProvider;
      } catch (e) {
        throw new BadRequestException('Invalid OAuth token');
      }
    } else if (payload.password) {
      passwordHash = await argon2.hash(payload.password);
    } else {
      throw new BadRequestException('Password or OAuth token is required');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        phone,
        passwordHash,
        role: Role.USER,
        primaryAuthProvider: provider,
        signupChannel: SignupChannel.MOBILE_APP,
        fullName: payload.fullName,
        gender: payload.gender,
        dateOfBirth: payload.dob,
        authIdentities: {
          create: {
            provider: provider,
            providerAccountId: email,
            email,
          },
        },
        wallet: {
          create: {},
        },
      },
      select: authUserSelect,
    });

    await this.generateAndSendVerificationCode(user.id, user.email);

    const session = await this.issueSession(user.id, user.email, user.role);
    return {
      message: 'User signup successful.',
      user,
      ...session,
    };
  }

  async signupBusiness(payload: BusinessSignupDto) {
    const email = requireValue(normalizeEmail(payload.email), 'email');
    const phone = requireValue(normalizePhone(payload.phone), 'phone');
    await this.assertUserDoesNotExist(email, phone);

    let passwordHash: string | null = null;
    let provider: AuthProvider = AuthProvider.LOCAL;
    
    if (payload.oauthToken) {
      try {
        const decoded = this.jwtService.verify(payload.oauthToken);
        if (decoded.email !== email) throw new BadRequestException('Email mismatch');
        provider = decoded.provider as AuthProvider;
      } catch (e) {
        throw new BadRequestException('Invalid OAuth token');
      }
    } else if (payload.password) {
      passwordHash = await argon2.hash(payload.password);
    } else {
      throw new BadRequestException('Password or OAuth token is required');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        phone,
        passwordHash,
        role: Role.USER,
        primaryAuthProvider: provider,
        signupChannel: SignupChannel.WEB_DASHBOARD,
        authIdentities: {
          create: {
            provider: provider,
            providerAccountId: email,
            email,
          },
        },
        wallet: {
          create: {},
        },
        businessProfile: {
          create: {
            businessName: payload.businessName.trim(),
            contactName: payload.contactName?.trim(),
            address: payload.address.trim(),
            website: payload.website.trim(),
            category: payload.category,
            onboardingStatus: OnboardingStatus.DRAFT,
            isApproved: true, // Auto-approved for MVP
          },
        },
      },
      select: authUserSelect,
    });

    await this.generateAndSendVerificationCode(user.id, user.email);

    const session = await this.issueSession(user.id, user.email, user.role);
    return {
      message: 'Business account created. Submit documents to complete onboarding.',
      user,
      ...session,
    };
  }

  async signupOperator(payload: OperatorSignupDto) {
    const email = requireValue(normalizeEmail(payload.email), 'email');
    const phone = requireValue(normalizePhone(payload.phone), 'phone');
    await this.assertUserDoesNotExist(email, phone);

    const passwordHash = await argon2.hash(payload.password);
    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          phone,
          passwordHash,
          role: Role.OPERATOR,
          primaryAuthProvider: AuthProvider.LOCAL,
          signupChannel: SignupChannel.WEB_DASHBOARD,
          authIdentities: {
            create: {
              provider: AuthProvider.LOCAL,
              providerAccountId: email,
              email,
            },
          },
          operatorProfile: {
            create: {
              companyName: payload.companyName.trim(),
              address: payload.address.trim(),
              rcNumber: payload.rcNumber?.trim(),
              supportPhone: payload.supportPhone?.trim(),
              onboardingStatus: OnboardingStatus.DRAFT,
              wallet: {
                create: {},
              },
            },
          },
        },
        select: authUserSelect,
      });

      return createdUser;
    });

    await this.generateAndSendVerificationCode(user.id, user.email);

    const session = await this.issueSession(user.id, user.email, user.role);
    return {
      message: 'Operator account created. Submit documents before dispatch is enabled.',
      user,
      ...session,
    };
  }

  async initiateOperatorSignup(payload: InitiateOperatorSignupDto) {
    const email = requireValue(normalizeEmail(payload.email), 'email');
    const phone = requireValue(normalizePhone(payload.phone), 'phone');
    
    // Check if user exists
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user && user.isVerified) {
      throw new ConflictException('User already exists and is verified.');
    }

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          phone,
          role: Role.OPERATOR,
          primaryAuthProvider: AuthProvider.LOCAL,
          signupChannel: SignupChannel.WEB_DASHBOARD,
          authIdentities: {
            create: {
              provider: AuthProvider.LOCAL,
              providerAccountId: email,
              email,
            },
          },
        },
      });
    }

    await this.generateAndSendVerificationCode(user.id, user.email);

    return {
      message: 'OTP sent to your email.',
    };
  }

  async setOperatorPassword(userId: string, payload: SetOperatorPasswordDto) {
    const passwordHash = await argon2.hash(payload.password);
    
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return {
      message: 'Password set successfully. Please complete your profile.',
    };
  }

  async completeOperatorProfile(userId: string, payload: CompleteOperatorProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { operatorProfile: true },
    });

    if (!user) throw new NotFoundException('User not found.');
    if (user.role !== Role.OPERATOR) throw new ForbiddenException('Invalid role.');
    if (user.operatorProfile) throw new ConflictException('Profile already exists.');

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      await tx.operatorProfile.create({
        data: {
          userId,
          companyName: payload.companyName.trim(),
          address: payload.address.trim(),
          rcNumber: payload.rcNumber?.trim(),
          supportPhone: payload.supportPhone?.trim(),
          onboardingStatus: OnboardingStatus.DRAFT,
          wallet: {
            create: {},
          },
        },
      });

      return await tx.user.findUnique({
        where: { id: userId },
        // @ts-ignore
        select: typeof authUserSelect !== 'undefined' ? authUserSelect : undefined,
      });
    });

    return {
      message: 'Operator profile created. Please submit documents.',
      user: updatedUser || user,
    };
  }

  async acceptInvitation(payload: AcceptInvitationDto) {
    const invitation = await this.prisma.userInvitation.findUnique({
      where: {
        inviteToken: payload.token,
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found.');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Invitation is no longer active.');
    }

    if (invitation.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Invitation has expired.');
    }

    if (invitation.role !== Role.DRIVER && invitation.role !== Role.ADMIN) {
      throw new BadRequestException('Invitation role is not supported.');
    }

    const email = normalizeEmail(invitation.email ?? undefined);
    const phone = normalizePhone(invitation.phone ?? payload.phone);

    if (!email || !phone) {
      throw new BadRequestException(
        'Invitation acceptance requires both email and phone.',
      );
    }

    await this.assertUserDoesNotExist(email, phone);
    const passwordHash = await argon2.hash(payload.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          phone,
          passwordHash,
          role: invitation.role,
          primaryAuthProvider: AuthProvider.LOCAL,
          signupChannel: SignupChannel.INVITE,
          authIdentities: {
            create: {
              provider: AuthProvider.LOCAL,
              providerAccountId: email,
              email,
            },
          },
          ...(invitation.role === Role.DRIVER
            ? {
                driverProfile: {
                  create: {
                    operatorId: requireValue(
                      invitation.operatorId ?? undefined,
                      'operatorId',
                    ),
                    firstName: requireValue(payload.firstName, 'firstName'),
                    lastName: requireValue(payload.lastName, 'lastName'),
                    onboardingStatus: OnboardingStatus.DRAFT,
                  },
                },
              }
            : {
                adminProfile: {
                  create: {
                    fullName: `${requireValue(payload.firstName, 'firstName')} ${requireValue(payload.lastName, 'lastName')}`.trim(),
                  },
                },
              }),
        },
        select: authUserSelect,
      });

      await tx.userInvitation.update({
        where: {
          id: invitation.id,
        },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
          acceptedByUserId: createdUser.id,
        },
      });

      return createdUser;
    });

    const session = await this.issueSession(user.id, user.email, user.role);
    return {
      message: 'Invitation accepted.',
      user,
      ...session,
    };
  }

  async createInvitation(payload: CreateInvitationDto) {
    if (payload.role !== Role.DRIVER && payload.role !== Role.ADMIN) {
      throw new BadRequestException(
        'Only DRIVER and ADMIN invitations are supported.',
      );
    }

    if (payload.role === Role.DRIVER && !payload.operatorId) {
      throw new BadRequestException(
        'Driver invitations must be linked to an operator.',
      );
    }

    if (payload.operatorId) {
      const operator = await this.prisma.operatorProfile.findUnique({
        where: {
          id: payload.operatorId,
        },
        select: {
          id: true,
        },
      });

      if (!operator) {
        throw new NotFoundException('Operator not found.');
      }
    }

    const invitation = await this.prisma.userInvitation.create({
      data: {
        role: payload.role,
        email: normalizeEmail(payload.email),
        phone: normalizePhone(payload.phone),
        operatorId: payload.operatorId,
        invitedByUserId: payload.invitedByUserId,
        inviteToken: randomBytes(24).toString('hex'),
        expiresAt: addDays(payload.expiresInDays ?? 7),
      },
      select: {
        id: true,
        role: true,
        email: true,
        phone: true,
        operatorId: true,
        inviteToken: true,
        expiresAt: true,
        status: true,
      },
    });

    return {
      message: 'Invitation created.',
      invitation,
    };
  }

  async submitBusinessDocuments(
    businessProfileId: string,
    payload: SubmitDocumentsDto,
  ) {
    const business = await this.prisma.businessProfile.findUnique({
      where: {
        id: businessProfileId,
      },
      select: {
        id: true,
      },
    });

    if (!business) {
      throw new NotFoundException('Business profile not found.');
    }

    await this.prisma.$transaction([
      this.prisma.kycDocument.createMany({
        data: payload.documents.map((document) => ({
          businessId: businessProfileId,
          type: document.type,
          fileUrl: document.fileUrl,
          notes: document.notes,
        })),
      }),
      this.prisma.businessProfile.update({
        where: {
          id: businessProfileId,
        },
        data: {
          onboardingStatus: OnboardingStatus.PENDING_REVIEW,
          onboardingSubmittedAt: new Date(),
          rejectionReason: null,
        },
        select: {
          id: true,
          onboardingStatus: true,
          onboardingSubmittedAt: true,
        },
      }),
    ]);

    return {
      message: 'Business documents submitted for review.',
      businessProfileId,
      documentsSubmitted: payload.documents.length,
      onboardingStatus: OnboardingStatus.PENDING_REVIEW,
    };
  }

  async submitOperatorDocuments(
    operatorProfileId: string,
    payload: SubmitDocumentsDto,
  ) {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: {
        id: operatorProfileId,
      },
      select: {
        id: true,
      },
    });

    if (!operator) {
      throw new NotFoundException('Operator profile not found.');
    }

    await this.prisma.$transaction([
      this.prisma.kycDocument.createMany({
        data: payload.documents.map((document) => ({
          operatorId: operatorProfileId,
          type: document.type,
          fileUrl: document.fileUrl,
          notes: document.notes,
        })),
      }),
      this.prisma.operatorProfile.update({
        where: {
          id: operatorProfileId,
        },
        data: {
          onboardingStatus: OnboardingStatus.PENDING_REVIEW,
          onboardingSubmittedAt: new Date(),
          rejectionReason: null,
        },
        select: {
          id: true,
          onboardingStatus: true,
          onboardingSubmittedAt: true,
        },
      }),
    ]);

    return {
      message: 'Operator documents submitted for review.',
      operatorProfileId,
      documentsSubmitted: payload.documents.length,
      onboardingStatus: OnboardingStatus.PENDING_REVIEW,
    };
  }

  async verifyOperator(
    operatorProfileId: string,
    payload: VerifyOperatorDto,
  ) {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { id: operatorProfileId },
      include: { user: true },
    });

    if (!operator) {
      throw new NotFoundException('Operator profile not found.');
    }

    let isFullyVerified = true;

    // 1. Verify RC Number
    let companyName = operator.companyName;
    try {
      const cacData = await this.premblyService.verifyBusiness(payload.rcNumber);
      if (cacData && cacData.company_name) {
        companyName = cacData.company_name;
      }
    } catch (error) {
      console.warn(`CAC verification failed for ${payload.rcNumber}`);
      isFullyVerified = false;
    }

    // 2. Verify NIN
    let ownerName = operator.user.fullName;
    try {
      const ninData = await this.premblyService.verifyNIN(payload.nin);
      if (ninData && (ninData.firstName || ninData.lastName)) {
        ownerName = `${ninData.firstName || ''} ${ninData.lastName || ''}`.trim();
      }
    } catch (error) {
      console.warn(`NIN verification failed for ${payload.nin}`);
      isFullyVerified = false;
    }

    // 3. Complete Onboarding
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: operator.userId },
        data: { fullName: ownerName },
      }),
      this.prisma.operatorProfile.update({
        where: { id: operatorProfileId },
        data: {
          rcNumber: payload.rcNumber,
          companyName: companyName,
          onboardingStatus: isFullyVerified ? OnboardingStatus.APPROVED : OnboardingStatus.PENDING_REVIEW,
          kycStatus: isFullyVerified ? 'APPROVED' : 'PENDING',
          onboardingSubmittedAt: new Date(),
          reviewedAt: isFullyVerified ? new Date() : null,
        },
      })
    ]);

    if (isFullyVerified && operator.user) {
      await this.mailService.sendAccountApprovalEmail(operator.user.email, companyName, 'Operator');
    }

    return {
      message: isFullyVerified 
        ? 'Identity verified. Operator approved.' 
        : 'Identity verification failed. Profile submitted for manual review.',
      operatorProfileId,
      status: isFullyVerified ? OnboardingStatus.APPROVED : OnboardingStatus.PENDING_REVIEW,
    };
  }

  async signupWithGoogle(payload: OAuthSignupDto) {
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    try {
      const ticket = await client.verifyIdToken({
        idToken: payload.idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payloadObj = ticket.getPayload();
      
      if (!payloadObj || !payloadObj.email) {
        throw new BadRequestException('Invalid Google token');
      }

      const email = payloadObj.email;
      const user = await this.prisma.user.findUnique({ where: { email } });

      if (user) {
        // User exists, log them in
        return this.issueSession(user.id, user.email, user.role);
      } else {
        // Return a temporary token for the onboarding screen
        const tempToken = this.jwtService.sign(
          { email, provider: 'GOOGLE', fullName: payloadObj.name },
          { expiresIn: '15m' }
        );
        return {
          requiresOnboarding: true,
          oauthToken: tempToken,
          email,
          fullName: payloadObj.name,
        };
      }
    } catch (e) {
      throw new UnauthorizedException('Google authentication failed');
    }
  }

  async signupWithApple(payload: OAuthSignupDto) {
    // Apple verification uses JWKS. In production, use apple-signin-auth or similar.
    // We decode the JWT here for demonstration, assuming the frontend verified it locally.
    try {
      const decoded = this.jwtService.decode(payload.idToken) as any;
      if (!decoded || !decoded.email) {
         throw new BadRequestException('Invalid Apple token');
      }

      const email = decoded.email;
      const user = await this.prisma.user.findUnique({ where: { email } });

      if (user) {
        return this.issueSession(user.id, user.email, user.role);
      } else {
        const tempToken = this.jwtService.sign(
          { email, provider: 'APPLE' },
          { expiresIn: '15m' }
        );
        return {
          requiresOnboarding: true,
          oauthToken: tempToken,
          email,
        };
      }
    } catch (e) {
      throw new UnauthorizedException('Apple authentication failed');
    }
  }

  async login(payload: LoginDto) {
    const email = requireValue(normalizeEmail(payload.email), 'email');
    if (!email) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
      select: authUserWithPasswordSelect,
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      payload.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is disabled.');
    }

    const session = await this.issueSession(user.id, user.email, user.role);
    return {
      message: 'Login successful.',
      user: sanitizeUser(user),
      ...session,
    };
  }

  async refresh(payload: RefreshTokenDto) {
    const hashedToken = hashOpaqueToken(payload.refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: {
        token: hashedToken,
      },
      include: {
        user: {
          select: authUserSelect,
        },
      },
    });

    if (!storedToken || storedToken.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token is invalid or expired.');
    }

    if (!storedToken.user.isActive) {
      throw new ForbiddenException('Account is disabled.');
    }

    await this.prisma.refreshToken.deleteMany({
      where: {
        id: storedToken.id,
      },
    });

    const session = await this.issueSession(
      storedToken.user.id,
      storedToken.user.email,
      storedToken.user.role,
    );

    return {
      message: 'Token refreshed.',
      user: storedToken.user,
      ...session,
    };
  }

  async logout(payload: RefreshTokenDto) {
    const hashedToken = hashOpaqueToken(payload.refreshToken);
    await this.prisma.refreshToken.deleteMany({
      where: {
        token: hashedToken,
      },
    });

    return {
      message: 'Logout successful.',
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: authUserSelect,
    });

    if (!user) {
      throw new NotFoundException('Authenticated user was not found.');
    }

    return {
      user,
    };
  }

  async updateMe(userId: string, payload: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(payload.fullName !== undefined && { fullName: payload.fullName }),
        ...(payload.phone !== undefined && { phone: payload.phone }),
        ...(payload.dateOfBirth !== undefined && { dateOfBirth: payload.dateOfBirth }),
        ...(payload.avatarUrl !== undefined && { avatarUrl: payload.avatarUrl }),
        ...(payload.notifyDelivery !== undefined && { notifyDelivery: payload.notifyDelivery }),
        ...(payload.notifyPayment !== undefined && { notifyPayment: payload.notifyPayment }),
        ...(payload.notifyDispatch !== undefined && { notifyDispatch: payload.notifyDispatch }),
        ...(payload.notifyAnnouncements !== undefined && { notifyAnnouncements: payload.notifyAnnouncements }),
      },
      select: authUserSelect,
    });

    return {
      message: 'Profile updated successfully.',
      user,
    };
  }

  async driverInviteSetup(payload: DriverInviteSetupDto) {
    let user = await this.prisma.user.findUnique({
      where: { email: payload.email.toLowerCase() },
    });

    if (!user) {
      // Must have an invitation
      const invite = await this.prisma.userInvitation.findFirst({
        where: {
          email: payload.email.toLowerCase(),
          role: 'DRIVER',
          status: 'PENDING',
        },
      });

      if (!invite) {
        throw new ForbiddenException('You must be invited by a Logistics Company to sign in.');
      }

      // Create placeholder user
      user = await this.prisma.user.create({
        data: {
          email: payload.email.toLowerCase(),
          phone: invite.phone || `temp_${Date.now()}`,
          role: 'DRIVER',
          isVerified: false,
          fullName: 'New Driver',
        },
      });
    }

    if (user.role !== 'DRIVER') {
      throw new ForbiddenException('This account is not registered as a driver.');
    }

    await this.generateAndSendVerificationCode(user.id, user.email, false, 6);

    return {
      message: 'OTP sent to your email.',
    };
  }

  async driverVerifySetup(payload: DriverVerifySetupDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: payload.email.toLowerCase() },
    });

    if (!user) {
      throw new BadRequestException('User not found.');
    }

    const verificationCode = await this.prisma.verificationCode.findFirst({
      where: { userId: user.id, isUsed: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!verificationCode) throw new BadRequestException('Invalid verification code.');

    const isValid = await argon2.verify(verificationCode.code, payload.code);
    if (!isValid) throw new BadRequestException('Invalid verification code.');

    if (verificationCode.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Verification code expired.');
    }

    await this.prisma.verificationCode.update({
      where: { id: verificationCode.id },
      data: { isUsed: true },
    });

    const passwordHash = await argon2.hash(payload.password);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        ...(!user.isVerified ? { isVerified: true, emailVerifiedAt: new Date() } : {})
      },
    });

    // Check if they have a DriverProfile
    let driverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId: user.id },
    });

    if (!driverProfile) {
      // Find the invite
      const invite = await this.prisma.userInvitation.findFirst({
        where: {
          email: user.email,
          role: 'DRIVER',
          status: 'PENDING',
        },
      });

      if (invite && invite.operatorId) {
        driverProfile = await this.prisma.driverProfile.create({
          data: {
            userId: user.id,
            operatorId: invite.operatorId,
            firstName: user.fullName?.split(' ')[0] || 'Driver',
            lastName: user.fullName?.split(' ')[1] || '',
            vehicleId: invite.assignedVehicleId,
          },
        });

        await this.prisma.userInvitation.update({
          where: { id: invite.id },
          data: { status: 'ACCEPTED', acceptedByUserId: user.id, acceptedAt: new Date() },
        });
      }
    }

    const { accessToken, refreshToken } = await this.issueSession(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        driverProfile,
      },
      accessToken,
      refreshToken,
    };
  }

  async verifyEmail(payload: VerifyEmailDto) {
    const email = normalizeEmail(payload.email);
    if (!email) throw new BadRequestException('Email is required.');

    const user = await this.prisma.user.findUnique({
      where: { email },
      // @ts-ignore
      select: typeof authUserSelect !== 'undefined' ? authUserSelect : undefined,
    });

    if (!user) throw new NotFoundException('User not found.');
    if (user.isVerified) throw new BadRequestException('Email is already verified.');

    const verificationCode = await this.prisma.verificationCode.findFirst({
      where: {
        userId: user.id,
        isUsed: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verificationCode) throw new BadRequestException('Invalid verification code.');

    const isValid = await argon2.verify(verificationCode.code, payload.code);
    if (!isValid) throw new BadRequestException('Invalid verification code.');

    if (verificationCode.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Verification code has expired. Please request a new one.');
    }

    await this.prisma.$transaction([
      this.prisma.verificationCode.update({
        where: { id: verificationCode.id },
        data: { isUsed: true },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          isVerified: true,
          emailVerifiedAt: new Date(),
        },
      }),
    ]);

    const session = await this.issueSession(user.id, user.email, user.role);

    await this.mailService.sendWelcomeEmail(user.email, user.fullName || 'User');

    return { 
      message: 'Email verified successfully.',
      user,
      ...session
    };
  }

  async resendCode(payload: ResendCodeDto) {
    const email = normalizeEmail(payload.email);
    if (!email) throw new BadRequestException('Email is required.');

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) throw new NotFoundException('User not found.');
    if (user.isVerified) throw new BadRequestException('Email is already verified.');

    await this.generateAndSendVerificationCode(user.id, user.email);

    return { message: 'A new verification code has been sent to your email.' };
  }

  async forgotPassword(payload: ForgotPasswordDto) {
    const email = normalizeEmail(payload.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      return { message: 'If an account with that email exists, we have sent a reset code.' };
    }

    await this.generateAndSendVerificationCode(user.id, user.email, true);
    
    return { message: 'If an account with that email exists, we have sent a reset code.' };
  }

  async resetPassword(payload: ResetPasswordDto) {
    const email = normalizeEmail(payload.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('Invalid reset request.');

    const verificationCode = await this.prisma.verificationCode.findFirst({
      where: { userId: user.id, isUsed: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!verificationCode) throw new BadRequestException('Invalid verification code.');

    const isValid = await argon2.verify(verificationCode.code, payload.code);
    if (!isValid) throw new BadRequestException('Invalid verification code.');

    if (verificationCode.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Verification code has expired. Please request a new one.');
    }

    const passwordHash = await argon2.hash(payload.newPassword);

    await this.prisma.$transaction([
      this.prisma.verificationCode.update({
        where: { id: verificationCode.id },
        data: { isUsed: true },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.prisma.refreshToken.deleteMany({
        where: { userId: user.id },
      }),
    ]);

    return { message: 'Password reset successful. Please log in with your new password.' };
  }

  async changePasswordRequest(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    await this.generateAndSendVerificationCode(user.id, user.email, true);
    return { message: 'A verification code has been sent to your email.' };
  }

  async changePasswordVerify(userId: string, payload: ChangePasswordVerifyDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    const verificationCode = await this.prisma.verificationCode.findFirst({
      where: { userId: user.id, isUsed: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!verificationCode) throw new BadRequestException('Invalid verification code.');

    const isValid = await argon2.verify(verificationCode.code, payload.code);
    if (!isValid) throw new BadRequestException('Invalid verification code.');

    if (verificationCode.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Verification code has expired. Please request a new one.');
    }

    const passwordHash = await argon2.hash(payload.newPassword);

    await this.prisma.$transaction([
      this.prisma.verificationCode.update({
        where: { id: verificationCode.id },
        data: { isUsed: true },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
    ]);

    return { message: 'Password updated successfully.' };
  }

  private async issueSession(userId: string, email: string, role: Role) {
    const accessToken = await this.jwtService.signAsync(
      {
        sub: userId,
        email,
        role,
      },
      {
        secret: this.configService.get<string>(
          'JWT_ACCESS_SECRET',
          'deliverse-dev-access-secret',
        ),
        expiresIn: getJwtExpiry(
          this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
        ),
      },
    );

    const refreshToken = randomBytes(48).toString('hex');
    await this.prisma.refreshToken.create({
      data: {
        token: hashOpaqueToken(refreshToken),
        userId,
        expiresAt: addDuration(
          this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
        ),
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private async assertUserDoesNotExist(email?: string, phone?: string) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [email ? { email } : undefined, phone ? { phone } : undefined].filter(
          Boolean,
        ) as Prisma.UserWhereInput[],
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new ConflictException(
        'A user with this email or phone already exists.',
      );
    }
  }
}

const authUserSelect = {
  id: true,
  email: true,
  phone: true,
  fullName: true,
  gender: true,
  dateOfBirth: true,
  avatarUrl: true,
  role: true,
  primaryAuthProvider: true,
  signupChannel: true,
  isVerified: true,
  isActive: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
  notifyDelivery: true,
  notifyPayment: true,
  notifyDispatch: true,
  notifyAnnouncements: true,
  businessProfile: {
    select: {
      id: true,
      businessName: true,
      isApproved: true,
      onboardingStatus: true,
      onboardingSubmittedAt: true,
      rejectionReason: true,
    },
  },
  operatorProfile: {
    select: {
      id: true,
      companyName: true,
      isApproved: true,
      onboardingStatus: true,
      onboardingSubmittedAt: true,
      rejectionReason: true,
    },
  },
  driverProfile: {
    select: {
      id: true,
      operatorId: true,
      firstName: true,
      lastName: true,
      onboardingStatus: true,
      kycStatus: true,
      status: true,
    },
  },
  adminProfile: {
    select: {
      id: true,
      fullName: true,
      level: true,
    },
  },
} satisfies Prisma.UserSelect;

const authUserWithPasswordSelect = {
  ...authUserSelect,
  passwordHash: true,
} satisfies Prisma.UserSelect;

function sanitizeUser(
  user: Prisma.UserGetPayload<{
    select: typeof authUserWithPasswordSelect;
  }>,
) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

function normalizeEmail(email?: string | null): string | undefined {
  return email?.trim().toLowerCase();
}

function normalizePhone(phone?: string): string | undefined {
  return phone?.trim();
}

function requireValue(value: string | undefined, fieldName: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new BadRequestException(`${fieldName} is required.`);
  }

  return normalized;
}

function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function addDays(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function addDuration(duration: string): Date {
  const match = /^(\d+)([smhd])$/i.exec(duration.trim());
  if (!match) {
    return addDays(7);
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };

  return new Date(Date.now() + value * multipliers[unit]);
}

function getJwtExpiry(value: string): number | `${number}${'s' | 'm' | 'h' | 'd'}` {
  const match = /^(\d+)([smhd])$/i.exec(value.trim());
  if (!match) {
    return '15m';
  }

  return `${match[1]}${match[2].toLowerCase() as 's' | 'm' | 'h' | 'd'}` as `${number}${'s' | 'm' | 'h' | 'd'}`;
}
