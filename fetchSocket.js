const { Web3 } = require('web3');
const fetch = require('node-fetch');

// Connect to Ethereum node
const infuraUrl = 'https://mainnet.infura.io/v3/2bf4df7e147a4b4990678da24ad867c1';
const web3 = new Web3(infuraUrl);

const contractAddress = '0x0BAAc79acD45A023E19345c352d8a7a83C4e5656'; // Address of registry contract
//Find address of registry contracts
const contractAbi = [
    {
        "constant": true,
        "inputs": [
            {
                "name": "operator",
                "type": "address"
            }
        ],
        "name": "getOperatorId",
        "outputs": [
            {
                "name": "",
                "type": "bytes32"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    }
];

// Create contract instance
const contract = new web3.eth.Contract(contractAbi, contractAddress);

// Function to get operator ID from address
async function getOperatorId(operatorAddress) {
    try {
        const checksumAddress = web3.utils.toChecksumAddress(operatorAddress);
        const operatorId = await contract.methods.getOperatorId(checksumAddress).call();
        return operatorId;
    } catch (error) {
        console.error(`Error fetching operator ID for ${operatorAddress}: ${error.message}`);
        return null;
    }
}

// Function to fetch operator addresses from the Dune API
async function fetchOperatorAddresses() {
    const duneApiUrl = 'https://api.dune.com/api/v1/eigenlayer/operator-to-avs-mapping?filters=avs_name=EigenDA';
    const headers = {
        'X-DUNE-API-KEY': '9twHTOAjtbl9jLGhJAGtDPNTGMY9CyKz'
    };

    try {
        const response = await fetch(duneApiUrl, { headers });
        const data = await response.json();

        if (data && data.result.rows.length > 0) {
            const operatorAddresses = data.result.rows.map(operator => operator.operator_contract_address);
            return operatorAddresses;
        } else {
            console.warn('No operator addresses found.');
            return [];
        }
    } catch (error) {
        console.error(`Error fetching operator addresses: ${error.message}`);
        return [];
    }
}

// Function to fetch the operator socket using operator ID
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

// Fetch operator IDs for multiple addresses and get their sockets
async function fetchOperatorIdsAndSockets() {
    const operatorAddresses = await fetchOperatorAddresses();
    if (operatorAddresses.length === 0) return;

    for (const operatorAddress of operatorAddresses) {
        const operatorId = await getOperatorId(operatorAddress);
        if (operatorId && operatorId !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
            console.log(`Operator ID for address ${operatorAddress}: ${operatorId}`);

            const socket = await fetchOperatorSocket(operatorId);
            if (socket) {
                const ipAddress = socket.split(':')[0];
                console.log(`Socket for operator ID ${operatorId}: ${socket}`);
                console.log(`IP Address: ${ipAddress}`);
            }
        } else {
            console.warn(`Operator ID for address ${operatorAddress} returned 0, indicating it might not be a registered operator.`);
        }
    }
}

// Execute the function to fetch operator IDs and sockets
fetchOperatorIdsAndSockets();
