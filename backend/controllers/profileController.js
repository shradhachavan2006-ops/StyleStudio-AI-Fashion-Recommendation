const User = require('../models/User');

// Helper: clean value
const clean = (v) => {
    if (v === '' || v === null || v === undefined) return undefined;
    return v;
};

// PUT /api/profile/body
exports.updateBodyProfile = async (req, res) => {
    try {
        const userId = req.user.id;

        const {
            gender,
            skinTone,
            skinUndertone,
            bodyType,
            height,
            weight,
            age,
            hairColor,
            hairType,
            hairLength,
            eyeColor,
            colorPreferences,
            additionalNotes,
            style_preference,
            lifestyle,
            weather_preference,
            location_type,
            // Phase 1 personalisation
            season,
            personality,
            lifestyleType,
        } = req.body;

        const update = {
            onboardingDone: true,
        };

        // -------- ROOT --------
        if (clean(gender)) update.gender = gender;

        // -------- BODY --------
        if (clean(skinTone)) update['bodyCharacteristics.skinTone'] = skinTone;
        if (clean(skinUndertone)) update['bodyCharacteristics.skinUndertone'] = skinUndertone;
        if (clean(bodyType)) update['bodyCharacteristics.bodyType'] = bodyType;

        if (height !== undefined) update['bodyCharacteristics.height'] = Number(height);
        if (weight !== undefined) update['bodyCharacteristics.weight'] = Number(weight);
        if (age !== undefined) update['bodyCharacteristics.age'] = Number(age);

        if (clean(hairColor)) update['bodyCharacteristics.hairColor'] = hairColor;
        if (clean(hairType)) update['bodyCharacteristics.hairType'] = hairType;
        if (clean(hairLength)) update['bodyCharacteristics.hairLength'] = hairLength;
        if (clean(eyeColor)) update['bodyCharacteristics.eyeColor'] = eyeColor;

        update['bodyCharacteristics.colorPreferences'] = Array.isArray(colorPreferences)
            ? colorPreferences
            : [];

        if (additionalNotes !== undefined) {
            update['bodyCharacteristics.additionalNotes'] = additionalNotes;
        }

        // -------- STYLE --------
        if (clean(style_preference))
            update['stylePreferences.style_preference'] = style_preference;

        if (clean(lifestyle))
            update['stylePreferences.lifestyle'] = lifestyle;

        if (clean(weather_preference))
            update['stylePreferences.weather_preference'] = weather_preference;

        if (clean(location_type))
            update['stylePreferences.location_type'] = location_type;

        // -------- PERSONALISATION (Phase 1) --------
        if (clean(season))        update.season        = season;
        if (clean(personality))   update.personality   = personality;
        if (clean(lifestyleType)) update.lifestyleType = lifestyleType;

        // -------- UPDATE --------
        const user = await User.findByIdAndUpdate(
            userId,
            { $set: update },
            {
                new: true,
                runValidators: true,
            }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            message: 'Profile updated successfully',
            user,
        });

    } catch (err) {
        console.error('❌ updateBodyProfile error:', err);
        res.status(500).json({
            message: 'Server error',
            error: err.message,
        });
    }
};

// GET /api/profile/body
exports.getBodyProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);

    } catch (err) {
        console.error('❌ getBodyProfile error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};