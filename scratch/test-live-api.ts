async function testLiveApi() {
  try {
    const res = await fetch('https://racho-api-staging.onrender.com/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId: '00000000-0000-0000-0000-000000000000',
        description: 'test bar',
        amount: 9900,
        splitType: 'ITEMIZED',
        taxAmount: 900,
        payers: [{ userId: '00000000-0000-0000-0000-000000000000', amountPaid: 9900 }],
        items: [
          {
            name: 'cerveja',
            unitPrice: 1500,
            quantity: 5,
            totalPrice: 7500,
            assignedUserIds: ['00000000-0000-0000-0000-000000000000']
          }
        ]
      })
    });
    console.log('Status:', res.status);
    const body = await res.json();
    console.log('Body:', body);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testLiveApi();
