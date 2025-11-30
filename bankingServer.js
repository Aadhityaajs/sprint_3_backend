import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Banking transaction endpoint
app.post('/api/transaction/external', (req, res) => {
  console.log('=== PAYMENT REQUEST RECEIVED ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Request Body:', JSON.stringify(req.body, null, 2));
  console.log('================================');

  // Always return success
  res.status(200).json({ 
    success: true, 
    message: 'Payment successful',
    transactionId: `TXN${Date.now()}`,
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Banking API is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Banking API server running on http://localhost:${PORT}`);
  console.log(`📍 Transaction endpoint: POST http://localhost:${PORT}/api/transaction/external`);
});