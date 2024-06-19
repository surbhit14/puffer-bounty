import socket
import subprocess

# Remote server details
REMOTE_IP = "49.12.132.48"
PORTS = [32005, 32004]  # Add any other ports you want to check

def check_port(ip, port):
    """Check if a TCP port is open."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(5)  # Timeout after 5 seconds
        result = sock.connect_ex((ip, port))
        return result == 0

def measure_latency(ip):
    """Measure latency to the IP address using ping."""
    try:
        output = subprocess.check_output(["ping", "-n", "4", ip], stderr=subprocess.STDOUT)
        return output.decode()
    except subprocess.CalledProcessError as e:
        return e.output.decode()
    except FileNotFoundError:
        return "Ping command not found. Please ensure it's installed on your system."

def scan_ports(ip, ports):
    """Scan specified ports to check if they are open."""
    open_ports = []
    for port in ports:
        if check_port(ip, port):
            open_ports.append(port)
    return open_ports

def main():
    print(f"Checking ports on {REMOTE_IP}")
    open_ports = scan_ports(REMOTE_IP, PORTS)
    print(f"Open ports: {open_ports}")

    print(f"\nMeasuring latency to {REMOTE_IP}")
    latency = measure_latency(REMOTE_IP)
    print(latency)

if __name__ == "__main__":
    main()


# from web3 import Web3

# # Connect to Ethereum node
# web3 = Web3(Web3.HTTPProvider('https://mainnet.infura.io/v3/2FFVrFmr6Ntymq7AJ3kfkFUhtN9'))

# # Replace with the actual EigenLayer contract address and ABI
# contract_address = '0xd3e09a0c2A9A6FDf5E92aE65D3CC090A4dF8EECF'#address of resgitry contract

# contract_abi = [
#     {
#         "constant": True,
#         "inputs": [
#             {
#                 "name": "operator",
#                 "type": "address"
#             }
#         ],
#         "name": "getOperatorId",
#         "outputs": [
#             {
#                 "name": "",
#                 "type": "bytes32"
#             }
#         ],
#         "payable": False,
#         "stateMutability": "view",
#         "type": "function"
#     }
# ]

# # # Create contract instance
# # contract = web3.eth.contract(address=contract_address, abi=contract_abi)

# # # Function to get operator ID from address
# # def get_operator_id(operator_address):
# #     operator_id = contract.functions.getOperatorId(operator_address).call()
# #     return operator_id

# # # Fetch operator ID for the given operator address
# # operator_address = "0x5accc90436492f24e6af278569691e2c942a676d"
# # checksum_address = Web3.to_checksum_address(operator_address)
# # operator_id = get_operator_id(checksum_address)

# # print(operator_id)
# # print("Operator ID:", operator_id.hex())
