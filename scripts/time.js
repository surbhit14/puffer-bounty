const express = require('express');
const net = require('net');
const { performance } = require('perf_hooks');

const app = express();
const port = 3000;

function checkPort(ip, port, timeout = 5000) {
    return new Promise((resolve) => {
        const start = performance.now();
        const socket = new net.Socket();
        let success = false;

        socket.setTimeout(timeout);

        socket.on('connect', () => {
            const end = performance.now();
            const responseTime = (end - start).toFixed(3);
            success = true;
            socket.destroy();
            resolve({ online: true, responseTime });
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve({ online: false, responseTime: null });
        });

        socket.on('error', () => {
            socket.destroy();
            resolve({ online: false, responseTime: null });
        });

        socket.on('close', () => {
            if (!success) {
                const end = performance.now();
                const responseTime = (end - start).toFixed(3);
                resolve({ online: false, responseTime });
            }
        });

        socket.connect(port, ip);
    });
}

app.get('/api/check-ports', async (req, res) => {
    const ip = req.query.ip || 'eigenda.eigenyields.org';
    const dispersalPort = parseInt(req.query.dispersal_port, 10) || 32005;
    const retrievalPort = parseInt(req.query.retrieval_port, 10) || 32004;

    const dispersalStatus = await checkPort(ip, dispersalPort);
    const retrievalStatus = await checkPort(ip, retrievalPort);

    const status = {
        dispersal_online: dispersalStatus.online,
        dispersal_socket: `${ip}:${dispersalPort}`,
        dispersal_response_time: dispersalStatus.responseTime,
        retrieval_online: retrievalStatus.online,
        retrieval_socket: `${ip}:${retrievalPort}`,
        retrieval_response_time: retrievalStatus.responseTime
    };

    res.json(status);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});
