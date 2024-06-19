const express = require('express');
const { getOperatorIdFromRegistry, fetchOperatorSocket, fetchRegistryAddresses, checkResponseTime } = require('./helpers');
const { MongoClient } = require('mongodb');

// MongoDB connection details
const mongoUrl = 'mongodb://localhost:27017';
const dbName = 'operatorMetrics';

const app = express();
const port = 3000;

app.use(express.json());

// API endpoint to fetch IP address for a specific operator
app.get('/api/operator-ip', async (req, res) => {
    const { operatorAddress, avsName } = req.query;

    if (!operatorAddress) {
        return res.status(400).json({ error: 'operatorAddress is required' });
    }

    try {
        const registries = await fetchRegistryAddresses(avsName);
        const results = [];

        for (const registry of registries) {
            const operatorId = await getOperatorIdFromRegistry(registry.registryCoordinatorAddress, operatorAddress);

            if (operatorId && operatorId !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                const socket = await fetchOperatorSocket(operatorId);
                if (socket) {
                    const ipAddress = socket.split(':')[0];
                    results.push({
                        registryCoordinatorAddress: registry.registryCoordinatorAddress,
                        operatorId,
                        ipAddress,
                        socket
                    });
                } else {
                    results.push({
                        registryCoordinatorAddress: registry.registryCoordinatorAddress,
                        operatorId: 'not registered'
                    });
                }
            } else {
                results.push({
                    registryCoordinatorAddress: registry.registryCoordinatorAddress,
                    operatorId: 'not registered'
                });
            }
        }

        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to check the health/response time of an operator
app.get('/api/check-health', async (req, res) => {
    const { operatorAddress, avsName } = req.query;

    if (!operatorAddress) {
        return res.status(400).json({ error: 'operatorAddress is required' });
    }

    try {
        const registries = await fetchRegistryAddresses(avsName);

        for (const registry of registries) {
            const operatorId = await getOperatorIdFromRegistry(registry.registryCoordinatorAddress, operatorAddress);
            if (operatorId && operatorId !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                const socket = await fetchOperatorSocket(operatorId);
                if (socket) {
                    const ipAddress = socket.split(':')[0];
                    const responseTime = checkResponseTime(`http://${socket}`);
                    return res.json({ ipAddress, socket, responseTime });
                }
            }
        }
        
        res.status(404).json({ error: 'Operator ID or socket not found for the given address' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
