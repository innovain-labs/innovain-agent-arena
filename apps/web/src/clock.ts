export const clock = (time: number) => `00:${Math.floor(time).toString().padStart(2, '0')}`;
