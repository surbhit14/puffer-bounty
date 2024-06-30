const express = require('express');
const { getOperatorIdFromRegistry, fetchOperatorSocket, fetchRegistryAddresses,fetchOperatorsForAVS,getHistoricOperatorSocketUpdates,fetchAndStoreQuorumData,getQuorumCount } = require('./helpers.js');
const { MongoClient } = require('mongodb');
const axios = require('axios');
const { performance } = require('perf_hooks');
const { setDefaultResultOrder } = require("dns");
const net = require('net');
const mongoose = require('mongoose');
const { Parser } = require('json2csv');

// MongoDB connection details
// const mongoUrl = "mongodb+srv://surbhit:1234@cluster0.tas80.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
// const dbName = 'AVSData';
const mongoUrl = "mongodb+srv://surbhit:1234@cluster0.tas80.mongodb.net/AVSData?retryWrites=true&w=majority&appName=Cluster0";
// const dbName = 'AVSData';
mongoose.connect(mongoUrl);

const app = express();
const port = 3000;

app.use(express.json());

// API endpoint to fetch IP address for a specific operator
//1. endpoint which just directly fetches Ip address of the operator from operator address
//2.endpoint which returns all the registered AVSs(avs name) for this operatorAddress by checking if socket exists
//3.endpoint which checks dispersal and response time for that node
//4.endpoint to Get time series data of all (optional filter: operatorAddress)
//5. endpoint to get timeseies data of all operators in a paricular AVS
//in this basicallt call the dune api avs to operator mapping with this paricular avs (mandtory field) and now for all these operators 
//return data stored in the time series data and alo add the avs name in response of each time series data

//for the cron job use this and before cron job call a function which registers any 20 operators for monitoring(get data from Dune API)

app.get('/api/operator-ip', async (req, res) => {
    const { operatorAddress } = req.query;

    if (!operatorAddress) {
        return res.status(400).json({ error: 'operatorAddress is required' });
    }

    try {
        const registries = await fetchRegistryAddresses("EigenDA");
        let socket = "";
        let ipAddress = "";
        let operatorId = "";
        let found = false;

        for (const registry of registries) {
            console.log(registry.avs_name);
            console.log(registry.registryCoordinatorAddress);
            operatorId = await getOperatorIdFromRegistry(registry.registryCoordinatorAddress, operatorAddress);
            console.log(operatorId);

            if (operatorId && operatorId !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                socket = await fetchOperatorSocket(operatorId);
                console.log(socket);

                if (socket) {
                    ipAddress = socket.split(':')[0];
                    found = true;
                    break; // Stop the loop once we find a valid socket
                }
            }
        }

        console.log(found);

        if (found) {
            res.json({
                operatorId,
                ipAddress,
                socket
            });
        } else {
            res.status(404).json({
                operatorId: 'not registered'
            });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


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
    const { operatorAddress} = req.query;
    if (!operatorAddress) {
        return res.status(400).json({ error: 'operatorAddress is required' });
    }

    try {
        const registries = await fetchRegistryAddresses("EigenDA");
        // const registries = await fetchRegistryAddresses();

        let responseSent = false;

        for (const registry of registries) {
            console.log(registry.avs_name);
            if (responseSent) break; // Stop processing if a response has been sent

            const operatorId = await getOperatorIdFromRegistry(registry.registryCoordinatorAddress, operatorAddress);
            console.log(registry.registryCoordinatorAddress)
            if (operatorId && operatorId !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                console.log("Operator Id: ",operatorId)
                const socket = await fetchOperatorSocket(operatorId);
                console.log("Socket: ",socket);
                if (socket) {
                    const ipAddress = socket.split(':')[0];
                    console.log("IP Address: ",ipAddress);
                    const dispersalPort = 32005, retrievalPort = 32004;

                    const dispersalStatus = await checkPort(ipAddress, dispersalPort);
                    const retrievalStatus = await checkPort(ipAddress, retrievalPort);

                    const status = {
                        dispersal_online: dispersalStatus.online,
                        dispersal_socket: `${ipAddress}:${dispersalPort}`,
                        dispersal_response_time: dispersalStatus.responseTime,
                        retrieval_online: retrievalStatus.online,
                        retrieval_socket: `${ipAddress}:${retrievalPort}`,
                        retrieval_response_time: retrievalStatus.responseTime
                    };

                    res.json(status);
                    responseSent = true;
                    break; // Stop the loop once a response has been sent
                }
            }
        }

        if (!responseSent) {
            await Operator.deleteOne({ operatorAddress });
            res.status(404).json({ error: 'Operator not found' });
        }
    } catch (error) {
        if (!responseSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

const OperatorSchema = new mongoose.Schema({
    operatorAddress: String,
    avsName: String,
    optedForMonitoring: Boolean,
    createdAt: { type: Date, default: Date.now }
});

const TimeSeriesSchema = new mongoose.Schema({
    operatorAddress: String,
    dispersal_response_time: String,
    retrieval_response_time: String,
    timestamp: { type: Date, default: Date.now }
});

const StakeSchema = new mongoose.Schema({
    AVS_name: String,
    operator_address: String,
    quorumData: Array,
    operator_stake: String,
    total_stake: String
});

const Operator = mongoose.model('Operator', OperatorSchema);
const TimeSeries = mongoose.model('TimeSeries', TimeSeriesSchema);
const Stake = mongoose.model('Stake', StakeSchema);

// Endpoint to get time series data
app.get('/api/timeseries', async (req, res) => {
    const { operatorAddress } = req.query;
    const query = operatorAddress ? { operatorAddress } : {};

    try {
        const timeSeriesData = await TimeSeries.find(query).sort({ timestamp: 1 });
        res.json(timeSeriesData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to fetch the historic OperatorSocketUpdate events
app.get('/api/operator-socket-updates', async (req, res) => {
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
                const historicEvents = await getHistoricOperatorSocketUpdates(registry.registryCoordinatorAddress, operatorId);
                if (historicEvents.length > 0) {
                    results.push({
                        registryCoordinatorAddress: registry.registryCoordinatorAddress,
                        operatorId,
                        historicEvents
                    });
                }
            }
        }

        if (results.length === 0) {
            res.status(404).json({ error: 'No valid OperatorSocketUpdate events found for the operator' });
        } else {
            res.json(results);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to fetch quorum data for an operator in the AVSs
app.get('/api/operator-quorum-data', async (req, res) => {
    const { operatorAddress, avsName } = req.query;

    if (!operatorAddress) {
        return res.status(400).json({ error: 'operatorAddress is required' });
    }

    try {
        const registries = await fetchRegistryAddresses();
        const results = [];

        for (const registry of registries) {
            const operatorId = await getOperatorIdFromRegistry(registry.registryCoordinatorAddress, operatorAddress);
            const quorumCount = await getQuorumCount(registry.registryCoordinatorAddress);
            
            if (operatorId && operatorId !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                for (let quorumNumber = 0; quorumNumber < quorumCount; quorumNumber++) {
                    const quorumData = await fetchAndStoreQuorumData(registry.registryCoordinatorAddress, operatorAddress, operatorId, registry.avs_name,quorumNumber);
                    console.log("In API",quorumData);
                    if (quorumData) {
                        results.push({
                            registryCoordinatorAddress: registry.registryCoordinatorAddress,
                            operatorId,
                            quorumData,
                            quorumNumber,
                            registryName:registry.avs_name
                        });

                        const stakeRecord = new Stake({
                            AVS_name: registry.avs_name,
                            operator_address: operatorAddress,
                            operator_stake: quorumData.currentStake.toString(),
                            total_stake: quorumData.currentTotalStake.toString(),
                            weight_of_operator_for_quorum: quorumData.weightOfOperatorForQuorum.toString()
                        });
                
                        await stakeRecord.save();
                    }
                }   
            }
        }

        if (results.length === 0) {
            res.status(404).json({ error: 'No quorum data found for the operator' });
        } else {
            res.json(results);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// app.get('/api/operator-quorum-data/csv', async (req, res) => {
//     try {
//         const stakeData = await Stake.find().lean();
//         const json2csvParser = new Parser();
//         const csv = json2csvParser.parse(stakeData);

//         res.header('Content-Type', 'text/csv');
//         res.attachment('quorum_data.csv');
//         res.send(csv);
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

app.get('/api/operator-quorum-data/csv', async (req, res) => {
    try {
        const stakeData = await Stake.find().lean();

        // Modify the stakeData to format stakes and remove quorumData
        const formattedStakeData = stakeData.map(data => ({
            AVS_name: data.AVS_name,
            operator_address: data.operator_address,
            operator_stake: (isNaN(Number(data.operator_stake) / 1e18) ? 0 : Number(data.operator_stake) / 1e18).toString(),
            total_stake: (isNaN(Number(data.total_stake) / 1e18) ? 0 : Number(data.total_stake) / 1e18).toString(),
            weight_of_operator_for_quorum: (isNaN(Number(data.weight_of_operator_for_quorum) / 1e18) ? 0 : Number(data.weight_of_operator_for_quorum) / 1e18).toString()
        }));

        const fields = ['AVS_name', 'operator_address', 'operator_stake', 'total_stake', 'weight_of_operator_for_quorum'];
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(formattedStakeData);

        res.header('Content-Type', 'text/csv');
        res.attachment('quorum_data.csv');
        res.send(csv);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



app.get('/api/timeseries/csv', async (req, res) => {
    const { operatorAddress } = req.query;
    const query = operatorAddress ? { operatorAddress } : {};

    try {
        const timeSeriesData = await TimeSeries.find(query).sort({ timestamp: 1 }).lean();
        
        if (timeSeriesData.length === 0) {
            return res.status(404).json({ error: 'No time series data found' });
        }

        const fields = ['operatorAddress', 'avsId', 'avsName', 'dispersal_response_time', 'retrieval_response_time', 'timestamp'];
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(timeSeriesData);

        res.header('Content-Type', 'text/csv');
        res.attachment('timeseries_data.csv');
        res.send(csv);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/', (req, res) => {
    res.send('Server is running');
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
