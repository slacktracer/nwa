export default {
    acceleration: [0, 0],
    battery: {
        level: 100,
        maximum: 100
    },
    collisionData: {
        isColliding: false
    },
    colours: {
        crash: 'hsla(360, 100%, 100%, 0.05)',
        hull: 'hsla(360, 100%, 100%, 0.7)',
        shadow: 'hsla(360, 100%, 100%, 0.02)'
    },
    commands: {
        anticlockwise: false,
        clear: false,
        clockwise: false,
        thrust: false
    },
    crashed: false,
    force: [0, 0],
    hull: null,
    live: true,
    mass: 0.1,
    memory: {
        position: [0, 0],
        radians: Math.PI,
        renderPosition: [0, 0],
        velocity: [0, 0]
    },
    name: 'Untitled',
    position: [0, 0],
    propulsor: {
        active: false,
        colours: {
            flame: 'hsla(360, 100%, 100%, 0.4)',
            shadow: 'hsla(360, 100%, 100%, 0.05)'
        },
        efficiency: 100000
    },
    radians: Math.PI,
    radius: 10,
    renderPosition: [0, 0],
    rotationVelocity: Math.PI / 800,
    shadow: null,
    velocity: [0, 0],
    weaponsSystem: {
        missiles: {
            cost: 5,
            live: 0,
            maximum: 3
        }
    }
};
