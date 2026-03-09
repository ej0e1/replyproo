import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        tenantMembers: {
          include: {
            tenant: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Email atau kata laluan tidak sah');
    }

    const passwordValid = await compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Email atau kata laluan tidak sah');
    }

    const tenants = user.tenantMembers.map((member) => ({
      tenantId: member.tenantId,
      role: member.role,
      name: member.tenant.name,
      slug: member.tenant.slug,
    }));

    const activeTenant = tenants[0] ?? null;

    const payload = {
      sub: user.id,
      email: user.email,
      activeTenantId: activeTenant?.tenantId ?? null,
      roles: tenants.map((tenant) => ({ tenantId: tenant.tenantId, role: tenant.role })),
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        tenants,
      },
    };
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        createdAt: true,
        tenantMembers: {
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
                planCode: true,
              },
            },
          },
        },
      },
    });
  }
}
