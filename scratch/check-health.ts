async function checkHealth() {
  const res = await fetch('https://racho-api-staging.onrender.com/health');
  console.log('Health status:', res.status, await res.json());
}
checkHealth();
