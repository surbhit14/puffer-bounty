const { Web3 } = require('web3');

const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');

// MongoDB connection details
const mongoUrl = "mongodb+srv://surbhit:1234@cluster0.tas80.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const dbName = 'AVSData';
const registryCollectionName = 'registryAddresses';

// Infura and Web3 setup
const infuraUrl = 'https://mainnet.infura.io/v3/3829e40831594f05a2e04ef536263af6';
const web3 = new Web3(infuraUrl);

// ABI for the registryCoordinator method
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

// Function to fetch the registryCoordinator address
async function getRegistryCoordinator(avsContractAddress) {
    try {
        const contract = new web3.eth.Contract(registryCoordinatorAbi, avsContractAddress);
        const registryCoordinatorAddress = await contract.methods.registryCoordinator().call();
        return registryCoordinatorAddress;
    } catch (error) {
        console.error(`Error fetching registryCoordinator address for ${avsContractAddress}: ${error.message}`);
        return null;
    }
}

// Function to fetch AVS metadata from Dune API
async function fetchAvsMetadata() {
    const duneApiUrl = 'https://api.dune.com/api/v1/eigenlayer/avs-metadata';
    const headers = {
        'X-DUNE-API-KEY': '9twHTOAjtbl9jLGhJAGtDPNTGMY9CyKz'
    };

    try {
        const response = await fetch(duneApiUrl, { headers });
        const data = await response.json();
        console.log(data.result.rows);
        
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

// Function to store registry addresses in MongoDB
async function storeRegistryAddresses(db, avsMetadata) {
    const collection = db.collection(registryCollectionName);
    
    // Remove duplicate AVS entries based on avs_name
    const uniqueAvsMetadata = avsMetadata.reduce((acc, current) => {
        const x = acc.find(item => item.avs_name === current.avs_name);
        if (!x) {
            return acc.concat([current]);
        } else {
            return acc;
        }
    }, []);

    for (const avs of uniqueAvsMetadata) {
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


// Main function to fetch and store registry coordinator addresses
async function main() {
    const client = new MongoClient(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
        await client.connect();
        const db = client.db(dbName);
        
        const avsMetadata = await fetchAvsMetadata();
        await storeRegistryAddresses(db, avsMetadata);
    } catch (error) {
        console.error(`Error: ${error.message}`);
    } finally {
        await client.close();
    }
}

// Execute the main function
main();
