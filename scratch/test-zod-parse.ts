import { createExpenseSchema } from '../packages/shared/src/schemas/expense.schema';

function testZodParse() {
  const payload = {
    groupId: '523e9c6e-3b0e-4c18-aaa4-0b739b721ba4',
    description: 'bar local',
    amount: 9900,
    splitType: 'ITEMIZED',
    taxAmount: 900,
    payers: [
      {
        userId: 'c5d42626-f5d1-44db-a330-7f81348e81ec',
        amountPaid: 9900
      }
    ],
    items: [
      {
        name: 'cerveja',
        unitPrice: 1500,
        quantity: 5,
        totalPrice: 7500,
        assignedUserIds: ['c5d42626-f5d1-44db-a330-7f81348e81ec', '7fce0ad9-7e2b-40a7-9002-ee4cca8f6011']
      },
      {
        name: 'bolinho',
        unitPrice: 500,
        quantity: 3,
        totalPrice: 1500,
        assignedUserIds: ['c5d42626-f5d1-44db-a330-7f81348e81ec', '7fce0ad9-7e2b-40a7-9002-ee4cca8f6011']
      }
    ]
  };

  try {
    const result = createExpenseSchema.parse(payload);
    console.log('Zod parse SUCCESS! Parsed result:', result);
  } catch (err: any) {
    console.error('Zod parse ERROR:', err.issues || err);
  }
}

testZodParse();
