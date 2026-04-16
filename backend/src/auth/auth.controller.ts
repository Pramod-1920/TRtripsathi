import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  //TODO: post signup
  @Post('signup') //auth/signup
  async signup(@Body() signupData: SignupDto) {
    return this.authService.create(signupData);
  }

  //TODO: post login

  //TODO: post refresh token

}