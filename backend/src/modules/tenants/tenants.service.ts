import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async listTenants() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        planCode: true,
        timezone: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async getTenantBySlug(slug: string) {
    return this.prisma.tenant.findUnique({
      where: { slug },
      include: {
        channels: {
          orderBy: { createdAt: 'desc' },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
              },
            },
          },
        },
      },
    });
  }
}
