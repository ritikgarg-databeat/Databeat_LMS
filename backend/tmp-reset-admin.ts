import { prisma } from '@/config/prisma';
import { hashPassword } from '@/utils/password.util';

async function main(): Promise<void> {
  const [command, email = 'admin@databeat.lms', newPassword] = process.argv.slice(2);

  if (command === 'show') {
    const user = await prisma.user.findUnique({ where: { email } });
    console.log(JSON.stringify(user, null, 2));
    return;
  }

  if (command === 'reset') {
    if (!newPassword) {
      throw new Error('Usage: npx ts-node -r tsconfig-paths/register tmp-reset-admin.ts reset <email> <newPassword>');
    }

    const passwordHash = await hashPassword(newPassword);
    const updated = await prisma.user.update({
      where: { email },
      data: { passwordHash, passwordChangedAt: new Date() },
    });
    console.log(`Password reset for ${email}. User id: ${updated.id}`);
    return;
  }

  throw new Error('Usage: show|reset');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
