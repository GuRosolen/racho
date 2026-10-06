import { ExpenseService } from '../apps/api/src/modules/expenses/expense.service';
import { GroupService } from '../apps/api/src/modules/groups/group.service';
import { db } from '@racho/db';

async function testLocalService() {
  const expenseService = new ExpenseService();
  const groupService = new GroupService();

  try {
    const user1 = await db.user.create({
      data: { name: 'Ana Silva', email: `ana_${Date.now()}@racho.test`, passwordHash: 'hash' }
    });
    const user2 = await db.user.create({
      data: { name: 'Bruno Costa', email: `bruno_${Date.now()}@racho.test`, passwordHash: 'hash' }
    });

    const group = await groupService.createGroup(user1.id, { name: 'Grupo Local Test' });
    await db.groupMember.create({
      data: { groupId: group.id, userId: user2.id }
    });

    const payload = {
      groupId: group.id,
      description: 'bar local',
      amount: 9900,
      splitType: 'ITEMIZED' as any,
      taxAmount: 900,
      payers: [{ userId: user1.id, amountPaid: 9900 }],
      items: [
        {
          name: 'cerveja',
          unitPrice: 1500,
          quantity: 5,
          totalPrice: 7500,
          assignedUserIds: [user1.id, user2.id]
        },
        {
          name: 'bolinho',
          unitPrice: 500,
          quantity: 3,
          totalPrice: 1500,
          assignedUserIds: [user1.id, user2.id]
        }
      ]
    };

    console.log('Testing createExpense locally with payload:', payload);
    const exp = await expenseService.createExpense(user1.id, payload as any);
    console.log('SUCCESS! Expense created:', exp.id);
  } catch (err: any) {
    console.error('Local service Error:', err.message, err.stack);
  }
}

testLocalService();
