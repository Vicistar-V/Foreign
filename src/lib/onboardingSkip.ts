// Skip flags for post-activation onboarding gates (PIN + profile picture).
//
// IMPORTANT: These flags are IN-MEMORY only — they intentionally do NOT
// survive a full page reload. If a user hasn't set a PIN or profile
// picture yet, we want the nudge to come back every time they reload the
// app so they eventually complete it. Only the "Skip for now" button
// within a single browsing session suppresses the redirect.
//
// Contrast this with the activation-success screen, which uses
// localStorage so it stays dismissed once the user has chosen an option.

let pinSkipped = false;
let avatarSkipped = false;

export const onboardingSkip = {
  get pin() {
    return pinSkipped;
  },
  get avatar() {
    return avatarSkipped;
  },
  skipPin() {
    pinSkipped = true;
  },
  skipAvatar() {
    avatarSkipped = true;
  },
  reset() {
    pinSkipped = false;
    avatarSkipped = false;
  },
};
