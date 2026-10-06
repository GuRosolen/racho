async function testStagingErrors() {
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
      body: JSON.stringify({ name: 'Grupo Staging Errors Test', currency: 'BRL' })
    });
    const groupData = await groupRes.json();
    const groupId = groupData.group.id;
    const inviteCode = groupData.group.inviteCode;

    const memberUserIds: string[] = [user1Id];
    for (let i = 2; i <= 3; i++) {
      const email = `test_member_${i}_${Date.now()}@racho.test`;
      const regRes = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Membro ${i}`, email, password: 'password123' })
      });
      const regData = await regRes.json();
      memberUserIds.push(regData.user.id);
      await fetch(`${API_URL}/groups/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${regData.accessToken}` },
        body: JSON.stringify({ inviteCode })
      });
    }

    // 1. EQUAL with wrong payer sum (amount 5000, payer 4000) -> Zod error expected
    const r1 = await fetch(`${API_URL}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
      body: JSON.stringify({
        groupId, description: 'E1', amount: 5000, splitType: 'EQUAL',
        payers: [{ userId: user1Id, amountPaid: 4000 }]
      })
    });
    console.log('1. Payer mismatch:', r1.status, await r1.json());

    // 2. ITEMIZED with item sum mismatch (amount 9900, tax 900, item sum 7000 != 9000)
    const r2 = await fetch(`${API_URL}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
      body: JSON.stringify({
        groupId, description: 'E2', amount: 9900, taxAmount: 900, splitType: 'ITEMIZED',
        payers: [{ userId: user1Id, amountPaid: 9900 }],
        items: [{ name: 'cerveja', unitPrice: 1000, quantity: 7, totalPrice: 7000, assignedUserIds: [user1Id] }]
      })
    });
    console.log('2. Item sum mismatch:', r2.status, await r2.json());

    // 3. ITEMIZED valid (amount 5000, tax 0, 1 item 5000)
    const r3 = await fetch(`${API_URL}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
      body: JSON.stringify({
        groupId, description: 'E3', amount: 5000, taxAmount: 0, splitType: 'ITEMIZED',
        payers: [{ userId: user1Id, amountPaid: 5000 }],
        items: [{ name: 'cerveja', unitPrice: 5000, quantity: 1, totalPrice: 5000, assignedUserIds: [user1Id] }]
      })
    });
    console.log('3. ITEMIZED 1 item valid:', r3.status, await r3.json());

  } catch (err: any) {
    console.error('Test error:', err);
  }
}

testStagingErrors();
