function drain(
    battery,
    cost,
    exact
) {
    if (battery.level >= cost) {
        battery.level -= cost;
        return cost;
    }
    if (exact === true) {
        return 0;
    }
    cost = battery.level;
    battery.level = 0;
    return cost;
}

function recharge(
    battery,
    charge
) {
    if (charge < battery.maximum) {
        battery.level += charge;
        if (battery.level > battery.maximum) {
            battery.level = battery.maximum;
        }
    }
}

export default Object.freeze({
    drain,
    recharge
});
