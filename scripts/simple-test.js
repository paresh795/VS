const BASE_URL = 'http://localhost:3000';

async function simpleTest() {
  console.log('🧪 Simple Test Starting...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/test-replicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: 'https://example.com/test.jpg',
        prompt: 'Test prompt'
      })
    });
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Test passed:', result);
    } else {
      const error = await response.text();
      console.log('❌ Test failed:', error);
    }
    
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

simpleTest(); 