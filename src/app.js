const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const connectDB = require('./config/database');
const vectorDBService = require('./services/vectorDBService');
const rideRoutes = require('./routes/rideRoutes');
const driverPreferenceRoutes = require('./routes/driverPreferenceRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const port = process.env.PORT || 3000;

// Connect to database
connectDB();

// Initialize Vector Database (optional - will continue if not configured)
async function initializeVectorDB() {
  try {
    if (process.env.PINECONE_API_KEY && process.env.OPENAI_API_KEY) {
      await vectorDBService.initialize();
      console.log('✅ Vector Database initialized successfully');
    } else {
      console.log('⚠️  Vector Database not configured - using traditional conversation mode');
    }
  } catch (error) {
    console.log('⚠️  Vector Database initialization failed - using traditional conversation mode');
    console.error('Vector DB Error:', error.message);
  }
}

// Initialize vector database
initializeVectorDB();

// Trust proxy for rate limiting (needed when behind a proxy/load balancer)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  }
});
app.use(limiter);

// CORS
app.use(cors());

// Logging middleware
app.use(morgan('dev'));

// Body parsing middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Routes
app.use('/', rideRoutes);
app.use('/driver-preferences', driverPreferenceRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

module.exports = app; 