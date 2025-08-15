/**
 * This service implements the Clarke-Wright Savings Algorithm to solve the Vehicle Routing Problem.
 * It takes a list of delivery nodes, a depot location, and vehicle capacity to generate
 * optimized delivery routes.
 */

/**
 * Calculates the Haversine distance between two coordinates.
 * @param {object} coord1 - { lat, lng }
 * @param {object} coord2 - { lat, lng }
 * @returns {number} Distance in kilometers.
 */
const getDistance = (coord1, coord2) => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (coord2.lat - coord1.lat) * (Math.PI / 180);
    const dLng = (coord2.lng - coord1.lng) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(coord1.lat * (Math.PI / 180)) *
        Math.cos(coord2.lat * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

/**
 * Main function to calculate routes using the Savings Matrix algorithm.
 * @param {Array<object>} nodes - Array of delivery nodes, e.g., { id, location, demand }.
 * @param {object} depotLocation - The starting and ending point for all routes.
 * @param {number} vehicleCapacity - The maximum capacity of the vehicle.
 * @returns {Array<Array<string>>} An array of trips, where each trip is an array of node IDs in sequence.
 */
const calculateSavingsMatrixRoutes = (nodes, depotLocation, vehicleCapacity) => {
    if (!nodes || nodes.length === 0) {
        return [];
    }

    // 1. Calculate savings for all pairs of nodes
    const savings = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const nodeA = nodes[i];
            const nodeB = nodes[j];
            const distADepot = getDistance(nodeA.location, depotLocation);
            const distBDepot = getDistance(nodeB.location, depotLocation);
            const distAB = getDistance(nodeA.location, nodeB.location);
            const saving = distADepot + distBDepot - distAB;
            savings.push({
                from: nodeA.id,
                to: nodeB.id,
                saving,
            });
        }
    }

    // 2. Sort savings in descending order
    savings.sort((a, b) => b.saving - a.saving);

    // 3. Initialize routes, one for each node initially
    const routes = nodes.map(node => ({
        path: [node.id],
        load: node.demand,
    }));

    // 4. Merge routes based on savings
    for (const { from, to, saving } of savings) {
        if (saving <= 0) break; // No more savings to be had

        const routeFrom = routes.find(r => r.path.includes(from));
        const routeTo = routes.find(r => r.path.includes(to));

        // Only merge if they are in different routes
        if (routeFrom !== routeTo) {
            const isFromEndpoint = routeFrom.path[0] === from || routeFrom.path[routeFrom.path.length - 1] === from;
            const isToEndpoint = routeTo.path[0] === to || routeTo.path[routeTo.path.length - 1] === to;

            // And if the connection point is an endpoint of its route
            if (isFromEndpoint && isToEndpoint) {
                // And if the merged load does not exceed capacity
                if (routeFrom.load + routeTo.load <= vehicleCapacity) {
                    // Perform the merge
                    if (routeFrom.path[routeFrom.path.length - 1] === from) {
                        routeFrom.path.reverse();
                    }
                    if (routeTo.path[0] === to) {
                        routeTo.path.reverse();
                    }

                    // New merged path and load
                    const newPath = [...routeTo.path, ...routeFrom.path];
                    const newLoad = routeFrom.load + routeTo.load;

                    // Update the 'from' route with the new merged data
                    routeFrom.path = newPath;
                    routeFrom.load = newLoad;
                    
                    // Mark the 'to' route as merged by emptying its path
                    routeTo.path = [];
                    routeTo.load = 0;
                }
            }
        }
    }

    // 5. Filter out the empty (merged) routes and return just the paths
    return routes.filter(r => r.path.length > 0).map(r => r.path);
};

module.exports = {
    calculateSavingsMatrixRoutes,
};
