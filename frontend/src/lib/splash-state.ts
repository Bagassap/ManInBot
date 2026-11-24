export const splashState = { shown: false };

export const SPLASH_HOLD_S = 4.3;
export const heroDelay = () => (splashState.shown ? 0 : SPLASH_HOLD_S);
