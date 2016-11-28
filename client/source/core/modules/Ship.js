import entities from 'source/core/data/entities';
import Battery from 'source/core/modules/Battery';
import Missile from 'source/core/modules/Missile';
import Physics from 'source/core/modules/Physics';
import Propulsor from 'source/core/modules/Propulsor';
import events from 'source/utilities/events';

const vec2 = Physics.vec2;

function build(
    configuration,
    hullCanvas,
    shadowCanvas
) {

    const ship = entities.templates.ship();

    ship.colours.crash = configuration.colours.crash;
    ship.colours.hull = configuration.colours.hull;
    ship.colours.shadow = configuration.colours.shadow;
    ship.id = configuration.id;
    ship.name = configuration.name;
    ship.position[0] = configuration.position[0];
    ship.position[1] = configuration.position[1];
    ship.propulsor.colours.flame = configuration.propulsor.colours.flame;
    ship.propulsor.colours.shadow = configuration.propulsor.colours.shadow;
    ship.radians = configuration.radians;
    ship.renderPosition[0] = configuration.position[0];
    ship.renderPosition[1] = configuration.position[1];
    ship.velocity[0] = configuration.velocity[0];
    ship.velocity[1] = configuration.velocity[1];

    ship.memory.position[0] = configuration.position[0];
    ship.memory.position[1] = configuration.position[1];
    ship.memory.radians = configuration.radians;
    ship.memory.renderPosition[0] = configuration.position[0];
    ship.memory.renderPosition[1] = configuration.position[1];
    ship.memory.velocity[0] = configuration.velocity[0];
    ship.memory.velocity[1] = configuration.velocity[1];

    ship.hull = prerenderHull(
        hullCanvas,
        ship
    );

    ship.shadow = prerenderShadow(
        shadowCanvas,
        ship
    );

    entities.ships.push(ship);
    entities.ships.byId[ship.id] = ship;

}

function drawCrash(
    context,
    fillStyle,
    position
) {

    const innerRadius = 20;
    const outerRadius = 30;
    const spikes = 17;
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

function drawShip(
    context,
    fillStyle,
    radius
) {
    context.beginPath();
    context.moveTo(
        radius,
        0
    );
    for (
        let i = 1;
        i < 5;
        i++
    ) {
        context.lineTo(
            radius * Math.cos(-Math.PI * 2 / 6 * i),
            radius * Math.sin(-Math.PI * 2 / 6 * i)
        );
    }
    context.lineTo(
        0,
        0
    );
    context.closePath();
    context.fillStyle = fillStyle;
    context.fill();
    return context;
}

function prerenderHull(
    canvas,
    ship
) {

    canvas.width = ship.radius * 2;
    canvas.height = ship.radius * 2;

    const context = canvas.getContext('2d');

    context.translate(
        canvas.width / 2,
        canvas.height / 2
    );

    drawShip(
        context,
        ship.colours.hull,
        ship.radius
    );

    return canvas;

}

function prerenderShadow(
    canvas,
    ship
) {

    canvas.width = ship.radius * 2;
    canvas.height = ship.radius * 2;

    const context = canvas.getContext('2d');

    context.translate(
        canvas.width / 2,
        canvas.height / 2
    );

    drawShip(
        context,
        ship.colours.shadow,
        ship.radius
    );

    return canvas;

}

function processCommands(
    deltaTime,
    ship
) {

    if (ship.commands.anticlockwise) {
        ship.radians -= ship.rotationVelocity * deltaTime;
    }

    if (ship.commands.clockwise) {
        ship.radians += ship.rotationVelocity * deltaTime;
    }

    if (ship.commands.thrust) {

        const direction = Physics.getDirectionVector(ship.radians);

        let energy = Battery.drain(
            ship.battery,
            1,
            true
        );

        energy /= ship.propulsor.efficiency;

        if (energy > 0) {

            Physics.applyForce(
                ship,
                vec2.scale(
                    vec2.create(),
                    direction,
                    energy
                )
            );

            ship.propulsor.active = true;

        } else {

            ship.propulsor.active = false;

        }

    } else {

        ship.propulsor.active = false;

    }

    if (ship.commands.fire) {

        if (ship.weaponsSystem.missiles.live < ship.weaponsSystem.missiles.maximum) {

            const energy = Battery.drain(
                ship.battery,
                ship.weaponsSystem.missiles.cost,
                true
            );

            if (energy) {
                Missile.launch(
                    ship.colours.hull,
                    ship.colours.crash,
                    Physics.getDirectionVector(ship.radians),
                    ship.id,
                    ship.position,
                    ship.colours.shadow,
                    ship.velocity
                );
                ship.weaponsSystem.missiles.live += 1;
            }

        }

        ship.commands.fire = false;

    }

    if (ship.commands.clear === true) {

        entities.missiles.forEach(function (missile) {
            if (missile.owner === ship.id) {
                Missile.deactivate(missile);
            }
        });

        ship.weaponsSystem.missiles.live = 0;

        ship.commands.clear = false;

    }
}

function render(
    hullContext,
    shadowContext,
    ship,
    offset
) {

    if (ship.live === false) {
        if (ship.crashed === false) {
            drawCrash(
                shadowContext,
                ship.colours.crash,
                ship.position
            );
            events.trigger(
                'crash',
                {
                    id: ship.id,
                    hit: ship.collisionData.hit,
                    self: ship.collisionData.self
                }
            );
            ship.crashed = true;
        }
        return false;
    }

    // velocity scaled by offset to calculate
    // extrapolated position where to render
    ship.renderPosition = vec2.add(
        vec2.create(),
        ship.position,
        vec2.create(
            vec2.create(),
            ship.velocity,
            offset
        )
    );

    vec2.copy(
        ship.renderPosition,
        [
            Math.round(ship.renderPosition[0]),
            Math.round(ship.renderPosition[1])
        ]
    );

    hullContext.save();
    hullContext.translate(
        ship.renderPosition[0],
        ship.renderPosition[1]
    );
    hullContext.rotate(ship.radians + Math.PI * 2 / 6 * 2);
    hullContext.drawImage(
        ship.hull,
        -ship.hull.width / 2,
        -ship.hull.height / 2
    );
    hullContext.restore();

    shadowContext.save();
    shadowContext.translate(
        ship.renderPosition[0],
        ship.renderPosition[1]
    );
    shadowContext.rotate(ship.radians + Math.PI * 2 / 6 * 2);
    shadowContext.drawImage(
        ship.shadow,
        -ship.shadow.width / 2,
        -ship.shadow.height / 2
    );
    shadowContext.restore();

    if (ship.propulsor.active) {

        Propulsor.render(
            ship.propulsor.colours,
            hullContext,
            ship.renderPosition,
            ship.radians,
            shadowContext
        );

    }

}

function revive(
    ship
) {
    ship.crashed = false;
    ship.collisionData.hit = false;
    ship.collisionData.isColliding = false;
    ship.collisionData.self = false;
    ship.live = true;
    ship.position[0] = ship.memory.position[0];
    ship.position[1] = ship.memory.position[1];
    ship.radians = ship.memory.radians;
    ship.renderPosition[0] = ship.memory.renderPosition[0];
    ship.renderPosition[1] = ship.memory.renderPosition[1];
    ship.velocity[0] = ship.memory.velocity[0];
    ship.velocity[1] = ship.memory.velocity[1];
}

function unrender(
    ship
) {

    if (ship.crashed === true) {
        return false;
    }

    return {
        padding: ship.radius + 5,
        position: ship.renderPosition
    };

}

function update(
    deltaTime,
    frame,
    ship,
    star
) {

    if (ship.collisionData.isColliding) {
        ship.live = false;
    }

    if (ship.live) {

        Physics.bind(
            ship,
            {
                height: frame.height,
                width: frame.width
            }
        );

        const pullForce = Physics.calculatePullForceFromTo(
            star,
            ship
        );

        Physics.applyForce(
            ship,
            pullForce
        );

        Battery.recharge(
            ship.battery,
            star.power * vec2.length(pullForce)
        );

        processCommands(
            deltaTime,
            ship
        );

        Physics.integrate(
            ship,
            deltaTime
        );

    }

}

export default Object.freeze({
    build,
    render,
    revive,
    unrender,
    update
});
