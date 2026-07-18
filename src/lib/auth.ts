import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { admin } from "better-auth/plugins/admin";
import { createAccessControl } from "better-auth/plugins/access";
import { organization } from "better-auth/plugins";

const ac = createAccessControl({
  user: [
    "create",
    "list",
    "set-role",
    "ban",
    "impersonate",
    "delete",
    "set-password",
    "get",
    "update",
  ],
  session: ["list", "revoke", "delete"],
});

const roles = {
  user: ac.newRole({
    user: ["get", "update"],
    session: [],
  }),
  freelancer: ac.newRole({
    user: ["get", "update"],
    session: [],
  }),
  admin: ac.newRole({
    user: [
      "create",
      "list",
      "set-role",
      "ban",
      "impersonate",
      "delete",
      "set-password",
      "get",
      "update",
    ],
    session: ["list", "revoke", "delete"],
  }),
};

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const count = await prisma.user.count();
          if (count === 0) {
            return { data: { ...user, role: "admin" } };
          }
          const invite = await prisma.freelancerInvite.findFirst({
            where: { email: user.email, acceptedAt: null },
            select: { id: true },
          });
          if (invite) {
            return { data: { ...user, role: "freelancer" } };
          }
        },
        after: async (user) => {
          const { emailUserWelcome, emailAdminNewUser } = await import("./notify");
          if (user.role === "freelancer") {
            await prisma.freelancerInvite.updateMany({
              where: { email: user.email, acceptedAt: null },
              data: { acceptedAt: new Date() },
            }).catch(() => {});
          }
          await emailUserWelcome(user.email, user.name).catch(() => {});
          await emailAdminNewUser(user.name, user.email).catch(() => {});
        },
      },
    },
  },
  plugins: [
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
      ac,
      roles,
    }),
    organization(),
  ],
});
