import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiOperation({ summary: 'User signup' })
  @ApiCreatedResponse({ description: 'User successfully created' })
  async signup(@Body() signupData: SignupDto) {
    return this.authService.create(signupData);
  }

  //TODO: post login

  //TODO: post refresh token

}