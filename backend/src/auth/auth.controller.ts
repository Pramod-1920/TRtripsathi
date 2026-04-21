import {
  Body,
  Controller,
  Get,
  GoneException,
  Patch,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { Role } from './constants/roles.enum';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { GetCurrentUser } from './decorators/get-current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { RolesGuard } from './guards/roles.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private getCookieOptions() {
    const isProduction = process.env.NODE_ENV === 'production';

    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? ('none' as const) : ('lax' as const),
      path: '/',
    };
  }

  private setAuthCookies(response: Response, accessToken: string, refreshToken?: string) {
    const cookieOptions = this.getCookieOptions();

    response.cookie('access_token', accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000,
    });

    if (refreshToken) {
      response.cookie('refresh_token', refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }
  }

  private clearAuthCookies(response: Response) {
    const cookieOptions = this.getCookieOptions();
    response.clearCookie('access_token', cookieOptions);
    response.clearCookie('refresh_token', cookieOptions);
  }

  @Post('signup')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Create account with phone number and password' })
  @ApiBody({ type: SignupDto })
  @ApiCreatedResponse({
    description: 'User created successfully and JWT cookies were set',
  })
  @ApiTooManyRequestsResponse({ description: 'Too many requests. Try again later.' })
  async signup(@Body() signupData: SignupDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.signup(signupData);
    this.setAuthCookies(response, result.accessToken, result.refreshToken);
    return result;
  }

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Signin with phone number and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 401,
    description: 'Invalid phone number or password',
    example: {
      statusCode: 401,
      message: 'Invalid phone number or password',
      error: 'Unauthorized',
    },
  })
  @ApiOkResponse({ description: 'Signin successful. Tokens are also set in httpOnly cookies.' })
  @ApiTooManyRequestsResponse({ description: 'Too many requests. Try again later.' })
  @ApiCookieAuth('access_token')
  @ApiCookieAuth('refresh_token')
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(loginDto);
    this.setAuthCookies(response, result.accessToken, result.refreshToken);
    return result;
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: 'Deprecated: profile update moved to PATCH /user/profile',
    deprecated: true,
  })
  @ApiResponse({ status: 410, description: 'Deprecated. Use PATCH /user/profile instead.' })
  updateProfileDeprecated() {
    throw new GoneException('This endpoint is deprecated. Use PATCH /user/profile');
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @ApiOperation({ summary: 'Refresh access and refresh tokens using refresh_token cookie' })
  @ApiOkResponse({ description: 'Tokens refreshed successfully' })
  @ApiCookieAuth('refresh_token')
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(
    @GetCurrentUser('userId') userId: string,
    @GetCurrentUser('refreshToken') refreshToken: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const result = await this.authService.refreshTokens(userId, refreshToken);
      this.setAuthCookies(response, result.accessToken, result.refreshToken);
      return result;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.clearAuthCookies(response);
      }

      throw error;
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Logout user and revoke refresh token' })
  @ApiOkResponse({ description: 'Logged out successfully' })
  async logout(
    @GetCurrentUser('userId') userId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.clearAuthCookies(response);
    return this.authService.logout(userId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current authenticated user profile from access token' })
  @ApiOkResponse({ description: 'Current user profile from token and profile data' })
  getMe(@GetCurrentUser() user: { userId: string; phoneNumber: string; role: Role }) {
    return user;
  }

  @Get('admin-only')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Admin only sample protected route' })
  @ApiOkResponse({ description: 'Accessible only by admin users' })
  adminOnly(@GetCurrentUser() user: { userId: string; phoneNumber: string; role: Role }) {
    return {
      message: 'Admin access granted',
      user,
    };
  }
}
