import { createExpenseSchema } from '../packages/shared/src/schemas/expense.schema';

function testZodParse() {
  const payloadWithoutTotalPrice = {
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
        assignedUserIds: ['c5d42626-f5d1-44db-a330-7f81348e81ec']
      },
      {
        name: 'bolinho',
        unitPrice: 500,
        quantity: 3,
        assignedUserIds: ['c5d42626-f5d1-44db-a330-7f81348e81ec']
      }
    ]
  };

  const res = createExpenseSchema.safeParse(payloadWithoutTotalPrice);
  console.log('safeParse success:', res.success);
  if (!res.success) {
    console.log('Error issues:', JSON.stringify(res.error.issues, null, 2));
  } else {
    console.log('Parsed data:', res.data);
  }
}

testZodParse();
