const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    // ── Basic Info ─────────────────────────────────────────
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },

    gender: {
      type: String,
      enum: ['male', 'female', 'non-binary', 'prefer-not-to-say'],
      default: 'prefer-not-to-say'
    },

    // ── Body Characteristics ───────────────────────────────
    bodyCharacteristics: {

      // Skin
      skinTone: {
        type: String,
        enum: ['very-fair', 'fair', 'light', 'medium', 'olive', 'tan', 'brown', 'dark-brown', 'deep'],
        default: null
      },
      skinUndertone: {
        type: String,
        enum: ['cool', 'warm', 'neutral'],
        default: null
      },

      // Body
      bodyType: {
        type: String,
        enum: ['ectomorph', 'mesomorph', 'endomorph', 'hourglass', 'pear', 'apple', 'rectangle', 'inverted-triangle'],
        default: null
      },
      height: { type: Number, default: null },
      weight: { type: Number, default: null },
      age: { type: Number, default: null },

      // Hair
      hairColor: {
        type: String,
        enum: ['black', 'dark-brown', 'medium-brown', 'light-brown', 'dark-blonde', 'blonde', 'strawberry-blonde', 'red', 'auburn', 'grey', 'white', 'other'],
        default: 'black'
      },
      hairType: {
        type: String,
        enum: ['straight', 'wavy', 'curly', 'coily'],
        default: null
      },
      hairLength: {
        type: String,
        enum: ['bald', 'buzz-cut', 'short', 'ear-length', 'chin-length', 'shoulder-length', 'mid-back', 'long', 'very-long'],
        default: 'short'
      },

      // Eyes
      eyeColor: {
        type: String,
        enum: ['black', 'dark-brown', 'medium-brown', 'hazel', 'amber', 'green', 'blue-grey', 'blue', 'grey', 'other'],
        default: 'black'
      },

      // Style Preferences
      colorPreferences: {
        type: [String],
        enum: ['vibrant', 'pastel', 'neutral', 'dark', 'earthy', 'fresh', 'monochrome'],
        default: ['neutral']
      },

      additionalNotes: { type: String, default: '' }
    },

    // ── App Preferences ───────────────────────────────────
    favoriteTheme: { type: String, default: '' },
    onboardingDone: { type: Boolean, default: false },

    // ── ML Features ───────────────────────────────────────
    stylePreferences: {
      style_preference: {
        type: String,
        enum: ['minimal', 'bold', 'elegant', 'trendy', 'sporty', 'streetwear'],
        default: null
      },
      lifestyle: {
        type: String,
        enum: ['comfort_first', 'fashion_forward', 'active_outdoor', 'corporate_formal', 'traditional', 'experimental'],
        default: null
      },
      weather_preference: {
        type: String,
        enum: ['hot', 'cold', 'rainy', 'moderate'],
        default: null
      },
      location_type: {
        type: String,
        enum: ['urban', 'rural', 'semi-urban'],
        default: null
      }
    },

    // ── Personalisation (Phase 1 additions) ───────────────
    season: {
      type: String,
      enum: ['spring', 'summer', 'autumn', 'winter', 'all'],
      default: 'all'
    },
    personality: {
      type: String,
      enum: ['classic', 'trendy', 'bohemian', 'minimalist', 'bold', 'athletic', 'traditional'],
      default: null
    },
    // lifestyle stored here (simpler path for personalisation engine)
    lifestyleType: {
      type: String,
      enum: ['urban', 'suburban', 'rural'],
      default: 'urban'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
