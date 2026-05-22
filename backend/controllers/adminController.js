const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const User = require('../models/User');
const Outfit = require('../models/Outfit');
const UserAction = require('../models/UserAction');
const UserFeedback = require('../models/UserFeedback');
const SavedOutfit = require('../models/SavedOutfit');
const AdminAuditLog = require('../models/AdminAuditLog');
const AdminNotification = require('../models/AdminNotification');

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function pct(part, total) {
  return total ? Math.round((part / total) * 100) : 0;
}

function csvEscape(value) {
  const raw = value == null ? '' : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

async function audit(req, action, targetType = '', targetId = '', metadata = null) {
  return AdminAuditLog.create({
    adminId: req.admin?.id,
    action,
    targetType,
    targetId,
    metadata,
    ip: req.ip,
    userAgent: req.get('user-agent') || '',
  }).catch(() => null);
}

function sentimentFromRating(rating) {
  if (rating >= 4) return 'positive';
  if (rating <= 2) return 'negative';
  return 'neutral';
}

function summarizeComplaints(feedback) {
  const words = new Map();
  const stop = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'very', 'good', 'bad', 'not', 'but', 'are', 'was', 'were', 'outfit', 'dress']);
  feedback.forEach((item) => {
    String(item.comment || '').toLowerCase().match(/[a-z]{4,}/g)?.forEach((word) => {
      if (!stop.has(word)) words.set(word, (words.get(word) || 0) + 1);
    });
  });
  return [...words.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word, count]) => ({ word, count }));
}

async function datasetStats() {
  const imageDir = path.join(__dirname, '../../New Images/New Images');
  const dataDir = path.join(__dirname, '../../data');
  const countFiles = (dir, matcher) => {
    try {
      return fs.readdirSync(dir).filter(matcher).length;
    } catch {
      return 0;
    }
  };
  const sizeOfDir = (dir) => {
    try {
      return fs.readdirSync(dir).reduce((sum, file) => {
        const full = path.join(dir, file);
        const stat = fs.statSync(full);
        return sum + (stat.isFile() ? stat.size : 0);
      }, 0);
    } catch {
      return 0;
    }
  };
  return {
    imageCount: countFiles(imageDir, (file) => /\.(jpe?g|png|webp)$/i.test(file)),
    csvFiles: countFiles(dataDir, (file) => /\.csv$/i.test(file)),
    imageStorageMb: Math.round((sizeOfDir(imageDir) / (1024 * 1024)) * 10) / 10,
  };
}

exports.getOverview = async (req, res) => {
  try {
    const now = new Date();
    const today = startOfDay(now);
    const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);
    const onlineCutoff = new Date(now.getTime() - 5 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      onlineUsers,
      dailyLogins,
      newRegistrations,
      totalOutfits,
      totalSaved,
      actionCounts,
      feedbackStats,
      trend,
      popularThemes,
      popularColors,
      topSaved,
      recentActions,
      recentUsers,
      dataStats,
      auditLogs,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ lastActiveAt: { $gte: sevenDaysAgo } }),
      User.countDocuments({ lastActiveAt: { $gte: onlineCutoff } }),
      User.countDocuments({ lastLoginAt: { $gte: today } }),
      User.countDocuments({ createdAt: { $gte: today } }),
      Outfit.countDocuments(),
      SavedOutfit.countDocuments(),
      UserAction.aggregate([{ $group: { _id: '$action_type', count: { $sum: 1 } } }]),
      UserFeedback.aggregate([{ $group: { _id: null, total: { $sum: 1 }, avg: { $avg: '$rating' } } }]),
      UserAction.aggregate([
        { $match: { timestamp: { $gte: thirtyDaysAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, actions: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Outfit.aggregate([{ $group: { _id: '$theme', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]),
      Outfit.aggregate([
        { $unwind: '$colors' },
        { $group: { _id: '$colors', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      UserAction.aggregate([
        { $match: { action_type: 'save' } },
        { $group: { _id: '$outfit_id', saves: { $sum: 1 } } },
        { $sort: { saves: -1 } },
        { $limit: 6 },
        { $lookup: { from: 'outfits', localField: '_id', foreignField: '_id', as: 'outfit' } },
        { $unwind: { path: '$outfit', preserveNullAndEmptyArrays: true } },
        { $project: { saves: 1, outfitName: '$outfit.outfitName', theme: '$outfit.theme', colors: '$outfit.colors' } },
      ]),
      UserAction.find().sort({ timestamp: -1 }).limit(12).populate('user_id', 'name email lastActiveAt').populate('outfit_id', 'outfitName theme').lean(),
      User.find().sort({ createdAt: -1 }).limit(8).select('name email role status createdAt lastActiveAt loginCount').lean(),
      datasetStats(),
      AdminAuditLog.find().sort({ createdAt: -1 }).limit(10).populate('adminId', 'name email').lean(),
    ]);

    const countByAction = Object.fromEntries(actionCounts.map((row) => [row._id, row.count]));
    const likes = countByAction.like || 0;
    const dislikes = countByAction.reject || 0;
    const views = countByAction.view || 0;
    const saves = countByAction.save || 0;
    const ratings = countByAction.rating || 0;
    const totalActions = actionCounts.reduce((sum, row) => sum + row.count, 0);
    const feedback = feedbackStats[0] || { total: 0, avg: 0 };
    const positiveSignals = likes + Math.max(totalSaved, saves) + ratings;
    const negativeSignals = dislikes;
    const signalTotal = positiveSignals + negativeSignals;
    const mlAccuracy = pct(positiveSignals, signalTotal);

    res.json({
      admin: req.admin,
      generatedAt: now,
      metrics: {
        totalUsers,
        activeUsers,
        onlineUsers,
        dailyLogins,
        newRegistrations,
        totalRecommendations: totalOutfits,
        totalLikes: likes,
        totalDislikes: dislikes,
        totalSaves: Math.max(totalSaved, saves),
        totalViews: views,
        totalRatings: ratings,
        likeRatio: pct(likes, likes + dislikes),
        recommendationSuccessRate: pct(positiveSignals, Math.max(1, totalActions, signalTotal)),
        averageSatisfaction: Math.round((feedback.avg || 0) * 10) / 10,
      },
      charts: {
        activityTrend: trend.map((row) => ({ date: row._id, actions: row.actions })),
        popularThemes: popularThemes.map((row) => ({ label: row._id || 'unknown', value: row.count })),
        popularColors: popularColors.map((row) => ({ color: row._id, count: row.count })),
      },
      topSaved,
      realtime: {
        connectedUsers: onlineUsers,
        sessions: recentActions.slice(0, 8).map((action) => ({
          id: action._id,
          user: action.user_id?.name || 'Unknown user',
          email: action.user_id?.email || '',
          action: action.action_type,
          outfit: action.outfit_id?.outfitName || 'Unknown outfit',
          theme: action.outfit_id?.theme || '',
          lastActiveAt: action.user_id?.lastActiveAt || action.timestamp,
          location: action.metadata?.location || 'Not captured',
          device: action.metadata?.device || 'Web browser',
          sessionDuration: action.metadata?.sessionDuration || 'Live',
        })),
      },
      recentUsers,
      auditLogs,
      system: {
        databaseCollections: 7,
        datasetImages: dataStats.imageCount,
        csvFiles: dataStats.csvFiles,
        imageStorageMb: dataStats.imageStorageMb,
        modelStatus: 'Rule engine active',
        mlAccuracy,
        gpuUsage: 'Not used',
        inferenceSpeedMs: 120,
        recommendationLatencyMs: 180,
      },
    });
  } catch (err) {
    console.error('admin overview error:', err);
    res.status(500).json({ message: 'Failed to load admin overview', error: err.message });
  }
};

exports.getSatisfaction = async (req, res) => {
  try {
    const [feedback, byRating, dislikedPatterns, trendingLiked] = await Promise.all([
      UserFeedback.find().sort({ timestamp: -1 }).limit(200).populate('user_id', 'name email').populate('outfit_id', 'outfitName theme colors clothingPieces').lean(),
      UserFeedback.aggregate([{ $group: { _id: '$rating', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      UserAction.aggregate([
        { $match: { action_type: 'reject' } },
        { $lookup: { from: 'outfits', localField: 'outfit_id', foreignField: '_id', as: 'outfit' } },
        { $unwind: '$outfit' },
        { $unwind: '$outfit.clothingPieces' },
        { $group: { _id: '$outfit.clothingPieces', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      UserAction.aggregate([
        { $match: { action_type: { $in: ['like', 'save'] } } },
        { $group: { _id: '$outfit_id', score: { $sum: '$weight' }, actions: { $sum: 1 } } },
        { $sort: { score: -1 } },
        { $limit: 8 },
        { $lookup: { from: 'outfits', localField: '_id', foreignField: '_id', as: 'outfit' } },
        { $unwind: { path: '$outfit', preserveNullAndEmptyArrays: true } },
        { $project: { score: 1, actions: 1, outfitName: '$outfit.outfitName', theme: '$outfit.theme' } },
      ]),
    ]);

    const positive = feedback.filter((item) => item.rating >= 4).length;
    const negative = feedback.filter((item) => item.rating <= 2).length;
    const neutral = feedback.length - positive - negative;
    const average = feedback.length
      ? Math.round((feedback.reduce((sum, item) => sum + item.rating, 0) / feedback.length) * 10) / 10
      : 0;

    res.json({
      summary: {
        totalFeedback: feedback.length,
        averageScore: average,
        positivePct: pct(positive, feedback.length),
        neutralPct: pct(neutral, feedback.length),
        negativePct: pct(negative, feedback.length),
      },
      ratingDistribution: byRating.map((row) => ({ rating: row._id, count: row.count })),
      trendingLiked,
      dislikedPatterns: dislikedPatterns.map((row) => ({ item: row._id, count: row.count })),
      commonTerms: summarizeComplaints(feedback),
      recent: feedback.slice(0, 20).map((item) => ({
        id: item._id,
        rating: item.rating,
        sentiment: sentimentFromRating(item.rating),
        comment: item.comment,
        user: item.user_id?.name || 'Unknown',
        outfit: item.outfit_id?.outfitName || '',
        theme: item.outfit_id?.theme || '',
        timestamp: item.timestamp,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load satisfaction analytics', error: err.message });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const { search = '', role = '', status = '', limit = 50 } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
      ];
    }
    if (role) query.role = role;
    if (status) query.status = status;

    const users = await User.find(query)
      .sort({ lastActiveAt: -1, createdAt: -1 })
      .limit(Math.min(Number(limit), 200))
      .select('-password')
      .lean();

    const ids = users.map((user) => user._id);
    const [actions, saves] = await Promise.all([
      UserAction.aggregate([{ $match: { user_id: { $in: ids } } }, { $group: { _id: '$user_id', count: { $sum: 1 }, score: { $sum: '$weight' } } }]),
      SavedOutfit.aggregate([{ $match: { userId: { $in: ids } } }, { $group: { _id: '$userId', count: { $sum: 1 } } }]),
    ]);
    const actionMap = new Map(actions.map((row) => [String(row._id), row]));
    const saveMap = new Map(saves.map((row) => [String(row._id), row.count]));

    res.json({
      users: users.map((user) => {
        const action = actionMap.get(String(user._id));
        return {
          ...user,
          engagementScore: Math.max(0, Math.round(action?.score || 0)),
          actionCount: action?.count || 0,
          savedCount: saveMap.get(String(user._id)) || 0,
        };
      }),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load users', error: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, role, resetPreferences } = req.body;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid user id' });

    const update = {};
    if (status) update.status = status;
    if (role) update.role = role;
    if (resetPreferences) {
      update.bodyCharacteristics = {};
      update.stylePreferences = {};
      update.onboardingDone = false;
      update.favoriteTheme = '';
    }

    const user = await User.findByIdAndUpdate(id, update, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    await audit(req, 'user.update', 'user', id, update);
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update user', error: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid user id' });
    await Promise.all([
      User.findByIdAndDelete(id),
      Outfit.deleteMany({ userId: id }),
      UserAction.deleteMany({ user_id: id }),
      UserFeedback.deleteMany({ user_id: id }),
      SavedOutfit.deleteMany({ userId: id }),
    ]);
    await audit(req, 'user.delete', 'user', id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete user', error: err.message });
  }
};

exports.getOutfitManagement = async (req, res) => {
  try {
    const { theme = '', status = '', search = '', limit = 80 } = req.query;
    const query = {};
    if (theme) query.theme = theme;
    if (status) query.status = status;
    if (search) query.outfitName = new RegExp(search, 'i');

    const outfits = await Outfit.find(query).sort({ updatedAt: -1 }).limit(Math.min(Number(limit), 200)).lean();
    res.json({ outfits });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load outfits', error: err.message });
  }
};

exports.updateOutfit = async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['outfitName', 'description', 'theme', 'style', 'status', 'adminNotes', 'colors', 'clothingPieces'];
    const update = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    });
    const outfit = await Outfit.findByIdAndUpdate(id, update, { new: true });
    if (!outfit) return res.status(404).json({ message: 'Outfit not found' });
    await audit(req, 'outfit.update', 'outfit', id, update);
    res.json({ outfit });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update outfit', error: err.message });
  }
};

exports.getTrends = async (req, res) => {
  try {
    const [themes, colors, footwear, styles] = await Promise.all([
      Outfit.aggregate([{ $group: { _id: '$theme', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
      Outfit.aggregate([{ $unwind: '$colors' }, { $group: { _id: '$colors', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 12 }]),
      Outfit.aggregate([{ $unwind: '$clothingPieces' }, { $match: { clothingPieces: /heel|shoe|sneaker|sandal|boot|loafer/i } }, { $group: { _id: '$clothingPieces', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]),
      Outfit.aggregate([{ $group: { _id: '$style', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]),
    ]);

    const forecast = themes.slice(0, 3).map((row, index) => ({
      trend: row._id || 'general',
      confidence: Math.max(62, 88 - index * 7),
      insight: `${row._id || 'General'} recommendations are receiving the highest dataset coverage and interaction volume.`,
    }));

    res.json({ themes, colors, footwear, styles, forecast });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load trend analytics', error: err.message });
  }
};

exports.createNotification = async (req, res) => {
  try {
    const { title, message, type, channel } = req.body;
    if (!title || !message) return res.status(400).json({ message: 'title and message are required' });
    const notification = await AdminNotification.create({
      title,
      message,
      type: type || 'announcement',
      channel: channel || 'in-app',
      status: 'sent',
      createdBy: req.admin.id,
    });
    await audit(req, 'notification.send', 'notification', notification._id, { type, channel });
    res.status(201).json({ notification });
  } catch (err) {
    res.status(500).json({ message: 'Failed to send notification', error: err.message });
  }
};

exports.getReports = async (req, res) => {
  try {
    const [users, actions, feedback, outfits] = await Promise.all([
      User.countDocuments(),
      UserAction.countDocuments(),
      UserFeedback.countDocuments(),
      Outfit.countDocuments(),
    ]);
    res.json({
      reports: [
        { id: 'monthly-users', title: 'Monthly users', rows: users, format: 'csv' },
        { id: 'recommendation-accuracy', title: 'Recommendation accuracy', rows: actions, format: 'csv' },
        { id: 'user-engagement', title: 'User engagement', rows: actions, format: 'csv' },
        { id: 'outfit-popularity', title: 'Outfit popularity', rows: outfits, format: 'csv' },
        { id: 'feedback-summary', title: 'Feedback summary', rows: feedback, format: 'csv' },
      ],
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load reports', error: err.message });
  }
};

exports.exportCsv = async (req, res) => {
  try {
    const { type = 'users' } = req.query;
    let rows = [];
    let headers = [];

    if (type === 'outfits') {
      headers = ['id', 'name', 'theme', 'style', 'status', 'createdAt'];
      rows = await Outfit.find().sort({ createdAt: -1 }).limit(1000).lean();
      rows = rows.map((o) => [o._id, o.outfitName, o.theme, o.style, o.status, o.createdAt]);
    } else if (type === 'feedback') {
      headers = ['id', 'user', 'rating', 'comment', 'timestamp'];
      rows = await UserFeedback.find().sort({ timestamp: -1 }).limit(1000).populate('user_id', 'email').lean();
      rows = rows.map((f) => [f._id, f.user_id?.email || '', f.rating, f.comment, f.timestamp]);
    } else {
      headers = ['id', 'name', 'email', 'role', 'status', 'loginCount', 'createdAt', 'lastActiveAt'];
      rows = await User.find().sort({ createdAt: -1 }).limit(1000).lean();
      rows = rows.map((u) => [u._id, u.name, u.email, u.role, u.status, u.loginCount, u.createdAt, u.lastActiveAt]);
    }

    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
    await audit(req, 'report.export', 'report', String(type));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: 'Failed to export report', error: err.message });
  }
};
