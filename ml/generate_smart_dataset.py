import pandas as pd
import random

# -------------------------------
# 🎯 POSSIBLE VALUES
# -------------------------------

genders = ["Men", "Women"]
body_shapes = ["Rectangle", "Triangle", "Oval"]
skin_tones = ["Warm", "Cool", "Neutral"]
lifestyles = ["Casual", "Formal", "Sports"]

colors = ["blue", "green", "black", "white", "grey", "red", "yellow"]

# Action → score
action_map = {
    "view": 1,
    "like": 3,
    "save": 4,
    "try_on": 5,
    "reject": 0
}

# -------------------------------
# 🧠 RULE ENGINE (CORE LOGIC)
# -------------------------------

def get_preferred_colors(skin_tone):
    if skin_tone == "Warm":
        return ["blue", "green", "yellow"]
    elif skin_tone == "Cool":
        return ["black", "grey", "white"]
    else:
        return ["blue", "white", "grey"]

def get_preferred_usage(lifestyle):
    if lifestyle == "Casual":
        return ["Casual"]
    elif lifestyle == "Formal":
        return ["Formal"]
    else:
        return ["Sports"]

def generate_action(match_score):
    # match_score: 0 to 3
    if match_score >= 2:
        return random.choices(
            ["like", "save", "try_on"],
            weights=[0.4, 0.3, 0.3]
        )[0]
    elif match_score == 1:
        return random.choices(
            ["view", "like"],
            weights=[0.7, 0.3]
        )[0]
    else:
        return random.choices(
            ["view", "reject"],
            weights=[0.4, 0.6]
        )[0]

# -------------------------------
# 📊 DATA GENERATION
# -------------------------------

data = []

for _ in range(500):  # 🔥 increase size here
    gender = random.choice(genders)
    body_shape = random.choice(body_shapes)
    skin_tone = random.choice(skin_tones)
    lifestyle = random.choice(lifestyles)

    theme = random.choice(lifestyles)
    color = random.choice(colors)

    # -------------------------------
    # 🎯 MATCH LOGIC (IMPORTANT)
    # -------------------------------
    match_score = 0

    # Rule 1: skin tone vs color
    if color in get_preferred_colors(skin_tone):
        match_score += 1

    # Rule 2: lifestyle vs theme
    if theme in get_preferred_usage(lifestyle):
        match_score += 1

    # Rule 3: simple body shape logic
    if body_shape == "Rectangle" and theme == "Casual":
        match_score += 1

    # -------------------------------
    # 🎲 ADD NOISE (REALISM)
    # -------------------------------
    if random.random() < 0.2:  # 20% noise
        match_score = random.randint(0, 3)

    # -------------------------------
    # 🎯 ACTION BASED ON MATCH
    # -------------------------------
    action = generate_action(match_score)

    row = {
        "gender": gender,
        "body_shape": body_shape,
        "skin_tone": skin_tone,
        "lifestyle": lifestyle,
        "theme": theme,
        "colors": color,
        "action_type": action,
        "interaction_score": action_map[action],
        "is_positive": 1 if action in ["like", "save", "try_on"] else 0,
        "is_negative": 1 if action == "reject" else 0
    }

    data.append(row)

# -------------------------------
# 💾 SAVE DATASET
# -------------------------------

df = pd.DataFrame(data)
df.to_csv("ml/dataset.csv", index=False)

print("✅ Smart dataset generated:", df.shape)