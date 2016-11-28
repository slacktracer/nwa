function drawPropulsor(
    context,
    fillStyle,
    position,
    radians
) {
    context.save();
    context.translate(
        position[0],
        position[1]
    );
    context.rotate(radians);
    context.beginPath();
    context.moveTo(-5, 0);
    context.lineTo(-10, 5);
    context.lineTo(-10, -5);
    context.closePath();
    context.fillStyle = fillStyle;
    context.fill();
    context.restore();
}

function render(
    colours,
    flameContext,
    position,
    radians,
    shadowContext
) {

    drawPropulsor(
        flameContext,
        colours.flame,
        position,
        radians
    );

    drawPropulsor(
        shadowContext,
        colours.shadow,
        position,
        radians
    );

}

export default Object.freeze({
    render
});
