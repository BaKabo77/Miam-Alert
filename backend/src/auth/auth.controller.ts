import { Body, Controller, HttpCode, HttpStatus, Ip, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AUTH_THROTTLE } from '../common/throttling.js';
import { AuthService } from './auth.service.js';
import type { AccessTokenResponse, AuthenticatedUser, UserResponse } from './auth.types.js';
import { CurrentUser } from './current-user.decorator.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { EmailVerificationService } from './email-verification.service.js';
import { PasswordResetService } from './password-reset.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { Public } from './public.decorator.js';
import { REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE_OPTIONS } from './refresh-token.js';
import { RefreshTokenCookie } from './refresh-token.decorator.js';

@Controller('auth')
@Throttle(AUTH_THROTTLE)
export class AuthController {
    constructor(
        private readonly auth: AuthService,
        private readonly emailVerification: EmailVerificationService,
        private readonly passwordReset: PasswordResetService,
    ) { }

    // Public : on ne peut pas exiger d'être connecté pour créer son compte.
    @Public()
    @Post('register')
    register(@Body() dto: RegisterDto): Promise<UserResponse> {
        return this.auth.register(dto);
    }

    // Public : c'est la route qui permet d'obtenir un token.
    @Public()
    @Post('login')
    // 200 plutôt que le 201 par défaut des POST : une connexion ne crée pas de ressource visible.
    @HttpCode(HttpStatus.OK)
    async login(
        @Body() dto: LoginDto,
        @Ip() ip: string,
        // passthrough : on pose le cookie, et Nest envoie la réponse normalement.
        @Res({ passthrough: true }) res: Response,
    ): Promise<AccessTokenResponse> {
        const { accessToken, refreshToken } = await this.auth.login(dto,ip);
        res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
        // L'access token est renvoyé dans le corps : le front le garde en mémoire uniquement.
        return { accessToken };
    }

    // Public : l'access token a justement expiré quand on appelle cette route. C'est le refresh
    // token (cookie httpOnly, vérifié en base) qui authentifie. SameSite=Strict empêche un autre
    // site de déclencher cette requête avec le cookie de l'utilisateur (CSRF).
    @Public()
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refresh(
        @RefreshTokenCookie() currentToken: string | undefined,
        @Res({ passthrough: true }) res: Response,
    ): Promise<AccessTokenResponse> {
        const { accessToken, refreshToken } = await this.auth.refresh(currentToken);
        res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
        return { accessToken };
    }

    // Public : on doit pouvoir se déconnecter même avec un access token expiré.
    // La session est révoquée en base, pas seulement le cookie effacé côté navigateur.
    @Public()
    @Post('logout')
    @HttpCode(HttpStatus.NO_CONTENT)
    async logout(
        @RefreshTokenCookie() currentToken: string | undefined,
        @Res({ passthrough: true }) res: Response,
    ): Promise<void> {
        await this.auth.logout(currentToken);
        res.clearCookie(REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE_OPTIONS);
    }

    // Protégée (pas de @Public()) : seul le titulaire connecté change SON mot de passe (identité
    // lue dans le token) et doit fournir l'ancien. Placée sous /auth pour la limite de 10/min et
    // pour pouvoir poser le cookie de la nouvelle session (cookie limité au chemin /auth).
    @Post('change-password')
    @HttpCode(HttpStatus.OK)
    async changePassword(
        @CurrentUser() user: AuthenticatedUser,
        @Body() dto: ChangePasswordDto,
        @Res({ passthrough: true }) res: Response,
    ): Promise<AccessTokenResponse> {
        const { accessToken, refreshToken } = await this.auth.changePassword(user.id, dto);
        res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
        return { accessToken };
    }

    // Public : le lien est ouvert depuis la boîte mail, éventuellement sur un autre appareil où
    // l'on n'est pas connecté. C'est le jeton (aléatoire, à usage unique, 24 h) qui prouve que
    // l'on a accès à la boîte mail. Limitée à 10/min comme le reste de /auth.
    @Public()
    @Post('verify-email')
    @HttpCode(HttpStatus.NO_CONTENT)
    verifyEmail(@Body() dto: VerifyEmailDto, @Ip() ip: string): Promise<void> {
        return this.emailVerification.verify(dto.token, ip);
    }

    // Protégée : renvoie le lien à l'adresse du compte connecté, et à aucune autre (aucune
    // adresse n'est acceptée en paramètre). Un email par minute au plus.
    @Post('verify-email/resend')
    @HttpCode(HttpStatus.NO_CONTENT)
    resendVerification(@CurrentUser() user: AuthenticatedUser): Promise<void> {
        return this.emailVerification.resend(user.id);
    }

    // Public : par définition, on a perdu son mot de passe. Toujours 204, que l'adresse ait un
    // compte ou non (pas d'énumération des comptes). 10/min par IP, et un email par minute au
    // plus pour une même adresse.
    @Public()
    @Post('forgot-password')
    @HttpCode(HttpStatus.NO_CONTENT)
    forgotPassword(@Body() dto: ForgotPasswordDto, @Ip() ip: string): void {
        this.passwordReset.requestReset(dto.email, ip);
    }

    // Public : c'est le jeton reçu par email (aléatoire, à usage unique, 30 min) qui autorise le
    // changement. Toutes les sessions du compte sont ensuite révoquées.
    @Public()
    @Post('reset-password')
    @HttpCode(HttpStatus.NO_CONTENT)
    resetPassword(@Body() dto: ResetPasswordDto, @Ip() ip: string): Promise<void> {
        return this.passwordReset.resetPassword(dto.token, dto.newPassword, ip);
    }
}
