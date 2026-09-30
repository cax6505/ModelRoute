export const motionEasing = {
  standard: [0.2, 0, 0, 1] as const,
  emphasized: [0.16, 1, 0.3, 1] as const,
};

export const motionDuration = {
  micro: 0.12,
  base: 0.22,
  page: 0.42,
};

export const motionSpring = {
  ui: { stiffness: 380, damping: 32 },
  layout: { stiffness: 260, damping: 30 },
};

export const pageMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: motionDuration.page, ease: motionEasing.emphasized },
};
