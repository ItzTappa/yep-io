// Path helpers for the three ship shapes. Coordinates are relative to the ship centre,
// with the ship facing +x (callers translate/rotate first).

// Starts a new path in the outline of a ship body. Does not fill or stroke.
//   circle:   radius = size
//   square:   side = size
//   triangle: nose at (size, 0)
export function traceBody(ctx, type, size) {
    ctx.beginPath();
    if (type === 'circle') {
        ctx.arc(0, 0, size, 0, Math.PI * 2);
    } else if (type === 'square') {
        ctx.rect(-size / 2, -size / 2, size, size);
    } else {
        ctx.moveTo(size, 0);
        ctx.lineTo(-size / 2, -size * 0.866);
        ctx.lineTo(-size / 2, size * 0.866);
        ctx.closePath();
    }
}

// Clips further drawing to the ship body. Wrap in ctx.save()/ctx.restore().
export function clipToBody(ctx, type, size) {
    traceBody(ctx, type, size);
    ctx.clip();
}
