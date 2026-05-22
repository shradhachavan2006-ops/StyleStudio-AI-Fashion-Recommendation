require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const recommendationRoutes = require('./routes/recommendationRoutes');

const app = express();


// =============================
// ✅ ENSURE FOLDERS EXIST
// =============================


// =============================
// ✅ MIDDLEWARE
// =============================
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// =============================
// ✅ STATIC FILES (VERY IMPORTANT)
// =============================

// 🔥 ADD THIS (YOUR FIX)
app.use('/images', express.static(path.join(__dirname, '../New Images/New Images')));

// ⚠️ If above doesn't work, try this instead:
// app.use('/images', express.static(path.join(__dirname, 'data/images')));


// =============================
// ✅ ROUTES
// =============================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/outfits', require('./routes/outfit'));
app.use('/api/saved-outfits', require('./routes/savedOutfit'));   // outfit bookmarks
app.use('/api/profile', require('./routes/profile'));
app.use('/api/actions', require('./routes/actions'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/recommend', recommendationRoutes);
app.use('/api/dataset', require('./routes/dataset'));  // Dataset inspection tool
app.use('/api/admin', require('./routes/admin'));


// =============================
// ✅ HEALTH CHECK
// =============================
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});


// =============================
// ✅ ERROR HANDLER
// =============================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: err.message || 'Internal Server Error'
  });
});


// =============================
// ✅ DATABASE CONNECTION
// =============================
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected to:', process.env.MONGO_URI);

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`🚀 StyleStudio API running on port ${PORT}`);
      console.log(`📸 Images available at: http://localhost:${PORT}/images/...`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });
