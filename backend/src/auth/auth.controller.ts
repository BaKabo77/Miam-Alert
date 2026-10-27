import { Body, Controller, HttpCode, HttpStatus, Ip, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AUTH_THROTTLE } from '../common/throttling.js';
import { AuthService } from './auth.service.js';
import type { AccessTokenResponse, AuthenticatedUser, UserResponse } from './auth.types.js';
import { CurrentUser } from './current-user.decorator.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { Public } from './public.decorator.js';
import { REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE_OPTIONS } from './refresh-token.js';
import { RefreshTokenCookie } from './refresh-token.decorator.js';

@Controller('auth')
@Throttle(AUTH_THROTTLE)
export class AuthController {
    constructor(private readonly auth: AuthService) { }

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
}
