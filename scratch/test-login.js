async function testLogin() {
  try {
    const res = await fetch('https://racho-api-staging.onrender.com/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ana@racho.app', password: 'senha123' })
    });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Response:', data);
  } catch (err) {
    console.error('Fetch Error:', err);
  }
}
testLogin();
