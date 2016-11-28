import entities from 'source/core/data/entities';
import Physics from 'source/core/modules/Physics';
import events from 'source/utilities/events';

const vec2 = Physics.vec2;

function build() {

    for (
        let i = 0;
        i < entities.missiles.length;
        i += 1
    ) {
        if (entities.missiles[i].live === false) {
            return entities.missiles[i];
        }
    }

    const missile = entities.templates.missile();
    entities.missiles.push(missile);

    return missile;

}

function deactivate(missile) {
    missile.live = false;
}

function drawDetonation(
    context,
    fillStyle,
    position
) {

    const innerRadius = 20;
    const outerRadius = 10;
    const spikes = 8;
    const step = Math.PI / spikes;

    let rotation = Math.PI / 2 * 3;
    let x = position[0];
    let y = position[1];

    context.beginPath();
    context.moveTo(
        position[0],
        position[1] - outerRadius
    );

    for (
        let i = 0;
        i < spikes;
        i += 1
    ) {

        x = position[0] + Math.cos(rotation) * outerRadius;
        y = position[1] + Math.sin(rotation) * outerRadius;
        context.lineTo(x, y);
        rotation += step;

        x = position[0] + Math.cos(rotation) * innerRadius;
        y = position[1] + Math.sin(rotation) * innerRadius;
        context.lineTo(x, y);
        rotation += step;

    }

    context.lineTo(
        position[0],
        position[1] - outerRadius
    );
    context.closePath();
    context.fillStyle = fillStyle;
    context.fill();

}

function drawMissile(
    context,
    fillStyle,
    radius,
    position
) {
    context.save();
    context.translate(
        position[0],
        position[1]
    );
    context.beginPath();
    context.moveTo(
        radius,
        0
    );
    context.arc(
        0,
        0,
        radius,
        0,
        Math.PI * 2
    );
    context.fillStyle = fillStyle;
    context.fill();
    context.restore();
}

function launch(
    coreColour,
    crashColour,
    direction,
    owner,
    position,
    shadowColour,
    velocity
) {

    const missile = build();

    missile.collisionData.isColliding = false;
    missile.collisionData.target = false;
    missile.colours.core = coreColour;
    missile.colours.crash = crashColour;
    missile.colours.shadow = shadowColour;
    missile.detonated = false;
    missile.live = true;
    missile.owner = owner;

    vec2.add(
        missile.position,
        position,
        vec2.scale(
            vec2.create(),
            direction,
            20
        )
    );

    vec2.copy(
        missile.velocity,
        velocity
    );

    Physics.applyForce(
        missile,
        vec2.scale(
            vec2.create(),
            direction,
            missile.power
        )
    );

    return missile;

}

function render(
    coreContext,
    missile,
    offset,
    shadowContext
) {

    if (missile.live === false) {
        if (missile.detonated === false) {
            drawDetonation(
                shadowContext,
                missile.colours.crash,
                missile.position
            );
            missile.detonated = true;
            events.trigger(
                'detonation',
                {
                    owner: missile.owner,
                    target: missile.collisionData.target
                }
            );
        }
        return false;
    }

    missile.renderPosition = vec2.add(
        vec2.create(),
        missile.position,
        vec2.create(
            vec2.create(),
            missile.velocity,
            offset
        )
    );

    drawMissile(
        coreContext,
        missile.colours.core,
        missile.radius,
        missile.renderPosition
    );

    drawMissile(
        shadowContext,
        missile.colours.shadow,
        missile.blastRadius,
        missile.renderPosition
    );

}

function unrender(
    missile
) {
    return {
        padding: missile.radius + 1,
        position: missile.renderPosition
    };
}

function update(
    deltaTime,
    frame,
    missile,
    star
) {

    if (missile.collisionData.isColliding) {
        missile.live = false;
    }

    if (missile.live === false) {
        return false;
    }

    Physics.bind(
        missile,
        {
            height: frame.height,
            width: frame.width
        }
    );

    const pullForce = Physics.calculatePullForceFromTo(
        star,
        missile
    );

    Physics.applyForce(
        missile,
        pullForce
    );

    Physics.integrate(
        missile,
        deltaTime
    );

}

export default Object.freeze({
    build,
    deactivate,
    launch,
    render,
    unrender,
    update
});
