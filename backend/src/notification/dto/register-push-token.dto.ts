import { IsEnum, IsString, MinLength } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @MinLength(20)
  token: string;

  @IsEnum(['android', 'ios'])
  platform: 'android' | 'ios';
}
