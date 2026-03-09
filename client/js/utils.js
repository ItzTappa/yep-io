export const distance = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
export const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);