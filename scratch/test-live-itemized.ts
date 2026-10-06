async function testLiveItemized() {
  const API_URL = 'https://racho-api-staging.onrender.com';
  try {
    const email1 = `test_payer_${Date.now()}@racho.test`;
    const regRes1 = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ana Silva', email: email1, password: 'password123' })
    });
    const regData1 = await regRes1.json();
    const token1 = regData1.accessToken;
    const user1Id = regData1.user.id;

    const groupRes = await fetch(`${API_URL}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
      body: JSON.stringify({ name: 'Grupo Teste Live Bar 3', currency: 'BRL' })
    });
    const groupData = await groupRes.json();
    const groupId = groupData.group.id;
    const inviteCode = groupData.group.inviteCode;

    const memberUserIds: string[] = [user1Id];
    for (let i = 2; i <= 5; i++) {
      const email = `test_member_${i}_${Date.now()}@racho.test`;
      const regRes = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Membro ${i}`, email, password: 'password123' })
      });
      const regData = await regRes.json();
      const memberToken = regData.accessToken;
      memberUserIds.push(regData.user.id);

      await fetch(`${API_URL}/groups/join/${inviteCode}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${memberToken}` }
      });
    }

    // CASE A: Itemized with tax 0 (amount = 9000, 2 items sum = 9000)
    const resA = await fetch(`${API_URL}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
      body: JSON.stringify({
        groupId,
        description: 'Test A No Tax',
        amount: 9000,
        taxAmount: 0,
        splitType: 'ITEMIZED',
        payers: [{ userId: user1Id, amountPaid: 9000 }],
        items: [
          { name: 'cerveja', unitPrice: 1500, quantity: 5, totalPrice: 7500, assignedUserIds: [memberUserIds[0], memberUserIds[3]] },
          { name: 'bolinho', unitPrice: 500, quantity: 3, totalPrice: 1500, assignedUserIds: [memberUserIds[0], memberUserIds[2]] }
        ]
      })
    });
    console.log('CASE A (tax=0): status', resA.status, await resA.json());

    // CASE B: Itemized with tax 900 (amount = 9900, 2 items sum 9000 + 900 = 9900)
    const resB = await fetch(`${API_URL}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
      body: JSON.stringify({
        groupId,
        description: 'Test B With Tax',
        amount: 9900,
        taxAmount: 900,
        splitType: 'ITEMIZED',
        payers: [{ userId: user1Id, amountPaid: 9900 }],
        items: [
          { name: 'cerveja', unitPrice: 1500, quantity: 5, totalPrice: 7500, assignedUserIds: [memberUserIds[0], memberUserIds[3]] },
          { name: 'bolinho', unitPrice: 500, quantity: 3, totalPrice: 1500, assignedUserIds: [memberUserIds[0], memberUserIds[2]] }
        ]
      })
    });
    console.log('CASE B (tax=900): status', resB.status, await resB.json());

  } catch (err: any) {
    console.error('Test error:', err);
  }
}

testLiveItemized();
