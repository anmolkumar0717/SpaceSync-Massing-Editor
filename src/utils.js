export const COLORS = Array.from({ length: 200 }, (_, i) => {
    const hue = (i * 137.5) % 360;
    return `hsl(${hue}, 70%, 50%)`;
});

let colorIndex = 0;

export function getColor() {
    return COLORS[colorIndex++ % COLORS.length];
}