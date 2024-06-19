const { Web3 } = require('web3');
const fetch = require('node-fetch');
const { execSync } = require('child_process');
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
async function fetchRegistryAddresses(avsName = null) {
    const client = new MongoClient(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(registryCollectionName);
        
        let query = {};
        if (avsName) {
            query = { avs_name: avsName };
        }

        const registries = await collection.find(query).toArray();
        return registries;
    } catch (error) {
        console.error(`Error fetching registry addresses from MongoDB: ${error.message}`);
        return [];
    } finally {
        await client.close();
    }
}

// Function to check service response time
function checkResponseTime(url) {
    try {
        const result = execSync(`curl -w "Time: %{time_total}\n" -o /dev/null -s ${url}`);
        console.log("Respone")
        return parseFloat(result.toString().split('Time: ')[1]);
    } catch (error) {
        console.error(`Error checking response time for ${url}: ${error.message}`);
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
    checkResponseTime
};
