const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const admin = require('../controllers/adminController');

router.use(auth, adminAuth);

router.get('/overview', admin.getOverview);
router.get('/satisfaction', admin.getSatisfaction);
router.get('/users', admin.getUsers);
router.patch('/users/:id', admin.updateUser);
router.delete('/users/:id', admin.deleteUser);
router.get('/outfits', admin.getOutfitManagement);
router.patch('/outfits/:id', admin.updateOutfit);
router.get('/trends', admin.getTrends);
router.post('/notifications', admin.createNotification);
router.get('/reports', admin.getReports);
router.get('/reports/export', admin.exportCsv);

module.exports = router;
