import requests
import time

def measure_response_time(url):
    try:
        start_time = time.time()
        response = requests.get(url)
        end_time = time.time()
        response_time = end_time - start_time
        
        print(f"Time: {response_time:.3f} seconds")
    except requests.RequestException as e:
        print(f"Error: {e}")

# Example usage
url = "http://37.27.124.169:32005"
measure_response_time(url)
