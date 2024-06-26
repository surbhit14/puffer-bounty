const { Web3 } = require('web3');

// Connect to Ethereum node
const infuraUrl = 'https://mainnet.infura.io/v3/3829e40831594f05a2e04ef536263af6';
const web3 = new Web3(infuraUrl);

// Contract address
const contractAddress = '0x870679e138bcdf293b7ff14dd44b70fc97e12fc0';

// ABI for the registryCoordinator method
const contractAbi = [
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

// Create contract instance
const contract = new web3.eth.Contract(contractAbi, contractAddress);

// Function to fetch the registryCoordinator address
async function getRegistryCoordinator() {
    try {
        const registryCoordinatorAddress = await contract.methods.registryCoordinator().call();
        console.log(`Registry Coordinator Address: ${registryCoordinatorAddress}`);
    } catch (error) {
        console.error(`Error fetching registryCoordinator address: ${error.message}`);
    }
}

// Execute the function to fetch the registryCoordinator address
getRegistryCoordinator();
