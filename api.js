const express = require('express');
const { getOperatorIdFromRegistry, fetchOperatorSocket, fetchRegistryAddresses, checkResponseTime,measureResponseTime } = require('./helpers');
const { MongoClient } = require('mongodb');
const axios = require('axios');
const { performance } = require('perf_hooks');
const { setDefaultResultOrder } = require("dns");
const net = require('net');

// setDefaultResultOrder("ipv4first");

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
    // return res.json({ operatorAddress, avsName });

    // if (!operatorAddress) {
    //     return res.status(400).json({ error: 'operatorAddress is required' });
    // }

    try {
        const registries = await fetchRegistryAddresses(avsName);

        for (const registry of registries) {
            const operatorId = await getOperatorIdFromRegistry(registry.registryCoordinatorAddress, operatorAddress);
            if (operatorId && operatorId !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                const socket = await fetchOperatorSocket(operatorId);
                if (socket) {
                    // const ipAddress = socket.split(':')[0];
                    console.log(socket)
                    // const start = performance.now();
                    // await axios.get(`http://${socket}`);
                    // const end = performance.now();
                    // const responseTime = (end - start) / 1000;
                    // console.log(responseTime)
                    // res.send(`Response time: ${responseTime.toFixed(3)} seconds`);
                    // const responseTime = checkResponseTime(`http://${socket}`);
                    const responseTime = await measureResponseTime(socket);

                    console.log("Response:" ,responseTime)
                    return res.json({ ipAddress, socket, latency });
                }
            }
        }
        
        res.status(404).json({ error: 'Operator ID or socket not found for the given address' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

function isPortOpen(ip, port, timeout = 5000) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(timeout);
        
        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });
        
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });
        
        socket.on('error', () => {
            socket.destroy();
            resolve(false);
        });
        
        socket.connect(port, ip);
    });
}

app.get('/api/check-ports', async (req, res) => {
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
                console.log(socket)
                if (socket) {
                    const ipAddress = socket.split(':')[0];
                    console.log(ipAddress);
                    const dispersal_port = 32005, retrieval_port = 32004;
                    const dispersal_online = await isPortOpen(ipAddress, dispersal_port);
                    const retrieval_online = await isPortOpen(ipAddress, retrieval_port);
                    
                    const status = {
                        "dispersal_online": dispersal_online,
                        "dispersal_socket": `${ipAddress}:${dispersal_port}`,
                        "retrieval_online": retrieval_online,
                        "retrieval_socket": `${ipAddress}:${retrieval_port}`
                    };
                
                    res.json(status);
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
