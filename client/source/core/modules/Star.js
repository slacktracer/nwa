import entities from 'source/core/data/entities';

function build() {
    entities.star = entities.templates.star();
}

function render(
    context,
    star
) {
    context.save();
    context.translate(
        star.position[0],
        star.position[1]
    );
    context.beginPath();
    context.moveTo(
        star.radius,
        0
    );
    context.arc(
        0,
        0,
        star.radius,
        0,
        Math.PI * 2
    );
    context.fillStyle = star.colour;
    context.fill();
    context.restore();
}

function unrender(
    star
) {
    return {
        padding: star.radius + 2,
        position: star.position
    };
}

function update(
    deltaTime,
    star,
    time,
    tinycolor
) {
    star.oscillator.value += star.oscillator.step;
    star.radius = star.baseRadius + Math.sin(star.oscillator.value) * star.oscillator.amplitude;

    if (star.radius < star.baseRadius) {
        if (Math.random() < 0.7) {
            star.colour = tinycolor(star.colour).saturate().toString();
        } else {
            star.colour = tinycolor(star.colour).desaturate().toString();
        }
    } else {
        if (Math.random() < 0.3) {
            star.colour = tinycolor(star.colour).saturate().toString();
        } else {
            star.colour = tinycolor(star.colour).desaturate().toString();
        }
    }
}

export default Object.freeze({
    build,
    render,
    unrender,
    update
});
