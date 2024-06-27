const { Web3 } = require('web3');
const fetch = require('node-fetch');
const { exec } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');


const execAsync = promisify(exec);

const { MongoClient } = require('mongodb');


// MongoDB connection details
const mongoUrl = "mongodb+srv://surbhit:1234@cluster0.tas80.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const dbName = 'AVSData';
const registryCollectionName = 'registryAddresses';

// Infura and Web3 setup
const infuraUrl = 'https://mainnet.infura.io/v3/3829e40831594f05a2e04ef536263af6';
const web3 = new Web3(infuraUrl);

// ABI for registryCoordinator method
const registryCoordinatorAbi = [
    {
        "constant": true,
        "inputs": [],
        "name": "registryCoordinator",
        "outputs": [
            {
                "name": "",
                "type": "address"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "bytes32", "name": "operatorId", "type": "bytes32" },
            { "indexed": false, "internalType": "string", "name": "socket", "type": "string" }
        ],
        "name": "OperatorSocketUpdate",
        "type": "event"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "stakeRegistry",
        "outputs": [
            {
                "name": "",
                "type": "address"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "quorumCount",
        "outputs": [
            {
                "name": "",
                "type": "uint8"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
];

const stakeRegistryAbi = [
    // Add relevant ABI for StakeRegistry
    {
        "constant": true,
        "inputs": [
            {
                "name": "operatorId",
                "type": "bytes32"
            },
            {
                "name": "quorumNumber",
                "type": "uint8"
            }
        ],
        "name": "getStakeHistory",
        "outputs": [
            {
                "components": [
                    {
                        "name": "updateBlockNumber",
                        "type": "uint32"
                    },
                    {
                        "name": "nextUpdateBlockNumber",
                        "type": "uint32"
                    },
                    {
                        "name": "stake",
                        "type": "uint96"
                    }
                ],
                "name": "",
                "type": "tuple[]"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [
            {
                "name": "quorumNumber",
                "type": "uint8"
            }
        ],
        "name": "getTotalStakeHistory",
        "outputs": [
            {
                "components": [
                    {
                        "name": "updateBlockNumber",
                        "type": "uint32"
                    },
                    {
                        "name": "nextUpdateBlockNumber",
                        "type": "uint32"
                    },
                    {
                        "name": "stake",
                        "type": "uint96"
                    }
                ],
                "name": "",
                "type": "tuple[]"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [
            {
                "name": "operatorId",
                "type": "bytes32"
            },
            {
                "name": "quorumNumber",
                "type": "uint8"
            }
        ],
        "name": "getCurrentStake",
        "outputs": [
            {
                "name": "",
                "type": "uint96"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [
            {
                "name": "quorumNumber",
                "type": "uint8"
            }
        ],
        "name": "getCurrentTotalStake",
        "outputs": [
            {
                "name": "",
                "type": "uint96"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
];


// Function to fetch AVS metadata from Dune API
async function fetchAvsMetadata() {
    const duneApiUrl = 'https://api.dune.com/api/v1/eigenlayer/avs-metadata';
    const headers = {
        'X-DUNE-API-KEY': '9twHTOAjtbl9jLGhJAGtDPNTGMY9CyKz'
    };

    try {
        const response = await fetch(duneApiUrl, { headers });
        const data = await response.json();
        console.log(data)

        if (data && data.result.rows.length > 0) {
            return data.result.rows;
        } else {
            console.warn('No AVS metadata found.');
            return [];
        }
    } catch (error) {
        console.error(`Error fetching AVS metadata: ${error.message}`);
        return [];
    }
}

// Function to fetch registry coordinator address
async function getRegistryCoordinator(avsAddress) {
    const contract = new web3.eth.Contract(registryCoordinatorAbi, avsAddress);
    try {
        const registryCoordinatorAddress = await contract.methods.registryCoordinator().call();
        return registryCoordinatorAddress;
    } catch (error) {
        console.error(`Error fetching registryCoordinator address for ${avsAddress}: ${error.message}`);
        return null;
    }
}

// Function to store registry addresses in MongoDB
async function storeRegistryAddresses(db, avsMetadata) {
    const collection = db.collection(registryCollectionName);
    for (const avs of avsMetadata) {
        const registryCoordinatorAddress = await getRegistryCoordinator(avs.avs_contract_address);
        if (registryCoordinatorAddress) {
            await collection.updateOne(
                { avs_name: avs.avs_name },
                { $set: { registryCoordinatorAddress } },
                { upsert: true }
            );
            console.log(`Stored registry coordinator address for AVS ${avs.avs_name}`);
        }
    }
}

// Function to get operator ID from address using a specific registry contract
async function getOperatorIdFromRegistry(registryAddress, operatorAddress) {
    const contractAbi = [
        {
            "constant": true,
            "inputs": [
                { "name": "operator", "type": "address" }
            ],
            "name": "getOperatorId",
            "outputs": [
                { "name": "", "type": "bytes32" }
            ],
            "payable": false,
            "stateMutability": "view",
            "type": "function"
        }
    ];
    
    const contract = new web3.eth.Contract(contractAbi, registryAddress);
    
    try {
        const checksumAddress = web3.utils.toChecksumAddress(operatorAddress);
        const operatorId = await contract.methods.getOperatorId(checksumAddress).call();
        return operatorId;
    } catch (error) {
        console.error(`Error fetching operator ID for ${operatorAddress} from registry ${registryAddress}: ${error.message}`);
        return null;
    }
}

// Function to fetch operator socket using operator ID
async function fetchOperatorSocket(operatorId) {
    const apiUrl = `https://dataapi.eigenda.xyz/api/v1/operators-info/port-check?operator_id=${operatorId}`;
    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        if (data && data.dispersal_socket) {
            return data.dispersal_socket;
        } else {
            console.warn(`No socket found for operator ID ${operatorId}`);
            return null;
        }
    } catch (error) {
        console.error(`Error fetching socket for operator ID ${operatorId}: ${error.message}`);
        return null;
    }
}

// Function to fetch registry addresses from MongoDB
async function fetchRegistryAddresses() {
    const client = new MongoClient(mongoUrl);
    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(registryCollectionName);
        
        const registries = await collection.find().toArray();
        return registries;
    } catch (error) {
        console.error(`Error fetching registry addresses from MongoDB: ${error.message}`);
        return [];
    } finally {
        await client.close();
    }
}

// Function to check service response time
// Function to check service response time

//curl -w "Time: %{time_total}\n" -o /dev/null -s http://129.213.106.122:32004
function checkResponseTime(url) {

    const curlCommand = `curl -w "Time: %{time_total}\\n" -o /dev/null -s ${url}`;
    console.log(`Executing command: ${curlCommand}`);

    try {
        const curlVersion = execSync('curl --version');
        console.log('curl is available:', curlVersion.toString());
        const stdout = execSync(curlCommand);
        const result = execSync('echo Hello, world!');
        console.log(result)
        res.send(`Command output: ${result.toString()}`);
        console.log(`stdout: ${stdout.toString()}`);
        res.send(`Response time: ${stdout.toString().trim()} seconds`);
    } catch (error) {
        console.error(`execSync error: ${error}`);
        console.error(`stderr: ${error.stderr.toString()}`);
        res.status(500).send(`Error executing curl command: ${error.stderr.toString() || error.message}`);
    }
    // try {
    //     console.log(url);
    //     const command = `curl -w "Time: %{time_total}" -o /dev/null -s ${url}`;
    //     console.log(command);
    //     const result = execSync(command);
    //     console.log("Result is",result);
    //     return result
    //     // return parseFloat(result.toString().split('Time: ')[1]);
    // } catch (error) {
    //     console.error(`Error checking response time for ${url}: ${error.message}`);
    //     return null;
    // }
}

async function checkPort(ip, port) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(5000); // Timeout after 5 seconds

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

async function measureLatency(ip) {
    console.log(ip);
    try {
        const { stdout } = await execAsync(`ping -c 4 ${ip}`);
        return stdout;
    } catch (error) {
        throw new Error(`Ping error: ${error.stderr || error.message}`);
    }
}

async function scanPorts(ip, ports = PORTS) {
    const openPorts = [];
    for (const port of ports) {
        const isOpen = await checkPort(ip, port);
        if (isOpen) {
            openPorts.push(port);
        }
    }
    return openPorts;
}

async function measureResponseTime(ipWithSocket) {
    return new Promise((resolve, reject) => {
        const curlCommand = `curl -w "Time: %{time_total}\\n" -o /dev/null -s http://${ipWithSocket}`;
        const cmd = `curl -w "Time: %{time_total}\\n" -o /dev/null -s http://37.27.124.169:32005`
        console.log(cmd)
        exec(curlCommand, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error: ${error}`);
                return;
              }
              if (stderr) {
                console.error(`stderr: ${stderr}`);
                return;
              }
              console.log(`stdout: ${stdout}`);
        });
    });
}

async function fetchOperatorsForAVS(avsName) {
    try {
        console.log(avsName)
        const url = `https://api.dune.com/api/v1/eigenlayer/operator-to-avs-mapping?api_key=9twHTOAjtbl9jLGhJAGtDPNTGMY9CyKz&limit=99&filters=avs_name%20%3D%20%22${avsName}%22`;
        const headers = {
            'X-DUNE-API-KEY': '9twHTOAjtbl9jLGhJAGtDPNTGMY9CyKz'
        };
        console.log(url)
        const response = await axios.get(url, {
            headers: { 'X-DUNE-API-KEY': '9twHTOAjtbl9jLGhJAGtDPNTGMY9CyKz' }
        });
        // console.log(response.data.result.rows)
        const operators = response.data.result.rows.map(row => ({
            operator_contract_address: row.operator_contract_address,
            operator_name: row.operator_name,
            operator_website: row.operator_website,
            registered_time: row.registered_time
        }));
        
        return operators;
    } catch (error) {
        console.error('Error fetching operators for AVS:', error);
        return [];
    }
}
const isValidSocket = (socket) => {
    const socketParts = socket.split(':');
    if (socketParts.length !== 2) return false; // Ensure it's in the format hostname:port

    const hostname = socketParts[0];
    const port = socketParts[1];

    return true;
};

async function getHistoricOperatorSocketUpdates(registryAddress, operatorId) {
    const registryCoordinatorContract = new web3.eth.Contract(registryCoordinatorAbi, registryAddress);
    try {
        const events = await registryCoordinatorContract.getPastEvents('OperatorSocketUpdate', {
            filter: { operatorId: operatorId },
            fromBlock: 0,
            toBlock: 'latest'
        });

        const validSockets = [];

        for (let i = events.length - 1; i >= 0; i--) {
            const event = events[i];
            const socket = event.returnValues.socket;
            if (socket && socket !== 'Not Needed' && socket !== 'no need' && socket !== '') {
                validSockets.push(socket);
            }
        }

        return validSockets;
    } catch (error) {
        console.error(`Error fetching OperatorSocketUpdate events for operatorId ${operatorId}: ${error.message}`);
        return [];
    }
}

async function getQuorumCount(registryCoordinatorAddress){
    const registryCoordinatorContract = new web3.eth.Contract(registryCoordinatorAbi, registryCoordinatorAddress);

    const quorumCountBigInt = await registryCoordinatorContract.methods.quorumCount().call();
    const quorumCount = Number(quorumCountBigInt);
    console.log("Count is: ",quorumCount);
    return quorumCount;
} 

async function fetchAndStoreQuorumData(registryCoordinatorAddress, operatorAddress, operatorId, avsName,quorumNumber) {
    const registryCoordinatorContract = new web3.eth.Contract(registryCoordinatorAbi, registryCoordinatorAddress);
    const client = new MongoClient(mongoUrl);
            
    try {
        await client.connect();
        const db = client.db(dbName);

        const stakeRegistryAddress = await registryCoordinatorContract.methods.stakeRegistry().call();
        const stakeRegistryContract = new web3.eth.Contract(stakeRegistryAbi, stakeRegistryAddress);
        console.log(registryCoordinatorAddress)
        console.log(stakeRegistryAddress)

            try {
                console.log(quorumNumber)
                console.log("Operator Id: ",operatorId)
                const currentStake = await stakeRegistryContract.methods.getCurrentStake(operatorId, quorumNumber).call();
                console.log("Stake: ",currentStake)
                const currentTotalStake = await stakeRegistryContract.methods.getCurrentTotalStake(quorumNumber).call();
                console.log("Total Stake: ",currentTotalStake)


                
                return {
                    currentStake:currentStake.toString(),
                    currentTotalStake:currentTotalStake.toString()
                }
            } catch (error) {
                console.log(error)
            }
        // }

        console.log(quorumData)

        return quorumData;
    } catch (error) {
        console.error(`Error fetching and storing quorum data for operatorId ${operatorId}: ${error.message}`);
        return null;
    }
}


module.exports = {
    fetchAvsMetadata,
    getRegistryCoordinator,
    storeRegistryAddresses,
    getOperatorIdFromRegistry,
    fetchOperatorSocket,
    fetchRegistryAddresses,
    checkResponseTime,
    scanPorts,
    measureLatency,
    measureResponseTime,
    fetchOperatorsForAVS,
    getHistoricOperatorSocketUpdates,
    fetchAndStoreQuorumData,
    getQuorumCount
};
