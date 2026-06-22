import { IsEnum, IsOptional, IsString } from 'class-validator';

enum OAuthProviderDto {
  GOOGLE = 'GOOGLE',
  APPLE = 'APPLE',
}

export class OAuthSignupDto {
  @IsEnum(OAuthProviderDto)
  provider!: OAuthProviderDto;

  @IsString()
  idToken!: string;

  @IsOptional()
  @IsString()
  nonce?: string;
}
