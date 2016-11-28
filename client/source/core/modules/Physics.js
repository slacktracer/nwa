import { vec2 } from '3rd-party/gl-matrix/gl-matrix';

function applyForce(
    body,
    force
) {
    vec2.add(
        body.force,
        body.force,
        force
    );
}

function bind(
    body,
    boundary
) {
    if (body.position[0] - body.radius > boundary.width / 2) {
        body.position[0] = -boundary.width / 2 - body.radius;
    }
    if (body.position[0] + body.radius < -boundary.width / 2) {
        body.position[0] = boundary.width / 2 + body.radius;
    }
    if (body.position[1] - body.radius > boundary.height / 2) {
        body.position[1] = -boundary.height / 2 - body.radius;
    }
    if (body.position[1] + body.radius < -boundary.height / 2) {
        body.position[1] = boundary.height / 2 + body.radius;
    }
}

function calculatePullForceFromTo(
    from,
    to
) {
    const direction = vec2.normalize(
        vec2.create(),
        vec2.clone(to.position)
    );
    vec2.negate(
        direction,
        direction
    );
    const distance = vec2.distance(
        from.position,
        to.position
    );
    const pullForce = vec2.scale(
        vec2.create(),
        direction,
        from.mass * to.mass / Math.pow(distance, 2)
    );
    return pullForce;
}

function detectCollisions(
    missiles,
    ships,
    star
) {

    for (
        let i = 0;
        i < ships.length;
        i += 1
    ) {
        if (ships[i].live) {
            const distance = vec2.distance(
                ships[i].position,
                star.position
            );
            if (distance > ships[i].radius + star.radius) {
                for (
                    let j = i + 1;
                    j < ships.length;
                    j += 1
                ) {
                    if (ships[j].live) {
                        const distance = vec2.distance(
                            ships[i].position,
                            ships[j].position
                        );
                        if (distance < ships[i].radius + ships[j].radius - 2) {
                            ships[i].collisionData.isColliding = true;
                            ships[j].collisionData.isColliding = true;
                        }
                    }
                }
            } else {
                ships[i].collisionData.isColliding = true;
            }
        }
    }

    for (
        let i = 0;
        i < missiles.length;
        i += 1
    ) {
        if (missiles[i].live) {
            const distance = vec2.distance(
                missiles[i].position,
                star.position
            );
            if (distance > missiles[i].radius + star.radius) {
                for (
                    let j = 0;
                    j < ships.length;
                    j += 1
                ) {
                    if (
                        ships[j].live
                        &&
                        ships[j].collisionData.isColliding === false
                    ) {
                        const distance = vec2.distance(
                            missiles[i].position,
                            ships[j].position
                        );
                        if (distance < missiles[i].radius + ships[j].radius - 2) {
                            missiles[i].collisionData.isColliding = true;
                            missiles[i].collisionData.target = ships[j].id;
                            ships[j].collisionData.isColliding = true;
                            ships[j].collisionData.hit = true;
                            if (missiles[i].owner === ships[j].id) {
                                ships[j].collisionData.self = true;
                            }
                        }
                    }
                }
            } else {
                missiles[i].collisionData.isColliding = true;
            }
        }
    }

}

function getDirectionVector(radians) {
    return [
        Math.cos(radians),
        Math.sin(radians)
    ];
}

function integrate(
    body,
    deltaTime
) {
    vec2.scale(
        body.acceleration,
        body.force,
        1 / body.mass
    );
    vec2.scale(
        body.acceleration,
        body.acceleration,
        deltaTime / 2
    );
    vec2.add(
        body.velocity,
        body.velocity,
        body.acceleration
    );
    vec2.add(
        body.position,
        body.position,
        vec2.scale(
            vec2.create(),
            body.velocity,
            deltaTime
        )
    );
    vec2.add(
        body.velocity,
        body.velocity,
        body.acceleration
    );
    vec2.set(
        body.acceleration,
        0,
        0
    );
    vec2.set(
        body.force,
        0,
        0
    );
}

export default Object.freeze({
    applyForce,
    bind,
    calculatePullForceFromTo,
    detectCollisions,
    getDirectionVector,
    integrate,
    vec2
});
