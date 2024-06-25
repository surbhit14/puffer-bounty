const { Web3 } = require('web3');
const fetch = require('node-fetch');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const { MongoClient } = require('mongodb');


// MongoDB connection details
const mongoUrl = "mongodb+srv://surbhit:1234@cluster0.tas80.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const dbName = 'AVSData';
const registryCollectionName = 'registryAddresses';

// Infura and Web3 setup
const infuraUrl = 'https://mainnet.infura.io/v3/2bf4df7e147a4b4990678da24ad867c1';
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
    }
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
        const response = await axios.get(`https://api.dune.com/api/v1/eigenlayer/operator-to-avs-mapping?avs_name=${avsName}`, {
            headers: { 'X-DUNE-API-KEY': '9twHTOAjtbl9jLGhJAGtDPNTGMY9CyKz' }
        });

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
    fetchOperatorsForAVS
};
