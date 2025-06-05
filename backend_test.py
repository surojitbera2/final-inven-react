
import requests
import sys
import json
from datetime import datetime

class InventoryAPITester:
    def __init__(self, base_url):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.user_data = None
        self.branch_id = None
        self.vendor_id = None
        self.customer_id = None
        self.product_id = None
        self.sale_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    # For multipart/form-data
                    del headers['Content-Type']
                    response = requests.post(url, data=data, files=files, headers=headers)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            
            try:
                response_data = response.json() if response.content else {}
            except:
                response_data = {"message": "No JSON response"}
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"Response: {json.dumps(response_data, indent=2)}")

            return success, response_data

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_login(self, username, password):
        """Test login and get token"""
        success, response = self.run_test(
            "Login",
            "POST",
            "login",
            200,
            data={"username": username, "password": password}
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response['user']
            print(f"User data: {json.dumps(self.user_data, indent=2)}")
            return True
        return False

    def test_dashboard(self):
        """Test dashboard endpoint"""
        success, response = self.run_test(
            "Dashboard",
            "GET",
            "dashboard",
            200
        )
        if success:
            print(f"Dashboard data: {json.dumps(response, indent=2)}")
        return success

    def test_get_branches(self):
        """Test get branches endpoint"""
        success, response = self.run_test(
            "Get Branches",
            "GET",
            "branches",
            200
        )
        if success and len(response) > 0:
            self.branch_id = response[0]['id']
            print(f"Branch ID: {self.branch_id}")
        return success

    def test_get_vendors(self):
        """Test get vendors endpoint"""
        success, response = self.run_test(
            "Get Vendors",
            "GET",
            "vendors",
            200
        )
        if success:
            print(f"Found {len(response)} vendors")
        return success

    def test_create_vendor(self):
        """Test create vendor endpoint"""
        vendor_data = {
            "name": f"Test Vendor {datetime.now().strftime('%H%M%S')}",
            "address": "123 Test Street",
            "phone": "1234567890"
        }
        success, response = self.run_test(
            "Create Vendor",
            "POST",
            "vendors",
            200,
            data=vendor_data
        )
        if success and 'id' in response:
            self.vendor_id = response['id']
            print(f"Created vendor with ID: {self.vendor_id}")
        return success

    def test_get_customers(self):
        """Test get customers endpoint"""
        success, response = self.run_test(
            "Get Customers",
            "GET",
            "customers",
            200
        )
        if success:
            print(f"Found {len(response)} customers")
        return success

    def test_create_customer(self):
        """Test create customer endpoint"""
        customer_data = {
            "name": f"Test Customer {datetime.now().strftime('%H%M%S')}",
            "address": "456 Test Avenue",
            "phone": "0987654321"
        }
        success, response = self.run_test(
            "Create Customer",
            "POST",
            "customers",
            200,
            data=customer_data
        )
        if success and 'id' in response:
            self.customer_id = response['id']
            print(f"Created customer with ID: {self.customer_id}")
        return success

    def test_get_products(self):
        """Test get products endpoint"""
        success, response = self.run_test(
            "Get Products",
            "GET",
            "products",
            200
        )
        if success:
            print(f"Found {len(response)} products")
        return success

    def test_create_product(self):
        """Test create product endpoint"""
        if not self.vendor_id:
            print("❌ Cannot create product without vendor ID")
            return False
            
        product_data = {
            "name": f"Test Product {datetime.now().strftime('%H%M%S')}",
            "vendor_id": self.vendor_id,
            "quantity": 100,
            "purchase_price": 50.0,
            "selling_price": 100.0
        }
        success, response = self.run_test(
            "Create Product",
            "POST",
            "products",
            200,
            data=product_data
        )
        if success and 'id' in response:
            self.product_id = response['id']
            print(f"Created product with ID: {self.product_id}")
        return success

    def test_get_stock(self):
        """Test get stock endpoint"""
        success, response = self.run_test(
            "Get Stock",
            "GET",
            "stock",
            200
        )
        if success:
            print(f"Stock data: {json.dumps(response, indent=2)}")
        return success

    def test_create_sale(self):
        """Test create sale endpoint"""
        if not self.customer_id or not self.product_id:
            print("❌ Cannot create sale without customer and product IDs")
            return False
            
        sale_data = {
            "customer_id": self.customer_id,
            "items": [
                {
                    "product_id": self.product_id,
                    "quantity": 5,
                    "selling_price": 100.0
                }
            ]
        }
        success, response = self.run_test(
            "Create Sale",
            "POST",
            "sales",
            200,
            data=sale_data
        )
        if success and 'id' in response:
            self.sale_id = response['id']
            print(f"Created sale with ID: {self.sale_id}")
        return success

    def test_get_sales(self):
        """Test get sales endpoint"""
        success, response = self.run_test(
            "Get Sales",
            "GET",
            "sales",
            200
        )
        if success:
            print(f"Found {len(response)} sales")
        return success

    def test_generate_invoice(self):
        """Test invoice generation endpoint"""
        if not self.sale_id:
            print("❌ Cannot generate invoice without sale ID")
            return False
            
        success, _ = self.run_test(
            "Generate Invoice",
            "GET",
            f"sales/{self.sale_id}/invoice",
            200
        )
        return success

    def test_get_company(self):
        """Test get company endpoint"""
        success, response = self.run_test(
            "Get Company",
            "GET",
            "company",
            200
        )
        if success:
            print(f"Company data: {json.dumps(response, indent=2)}")
        return success

def main():
    # Get the backend URL from environment variable or use default
    backend_url = "https://08c71467-638c-486d-b376-3f7e5914e5ae.preview.emergentagent.com/api"
    
    print(f"Testing API at: {backend_url}")
    
    # Setup tester
    tester = InventoryAPITester(backend_url)
    
    # Run tests
    if not tester.test_login("admin", "admin123"):
        print("❌ Login failed, stopping tests")
        return 1

    # Test dashboard
    tester.test_dashboard()
    
    # Test branches
    tester.test_get_branches()
    
    # Test vendors
    tester.test_get_vendors()
    tester.test_create_vendor()
    
    # Test customers
    tester.test_get_customers()
    tester.test_create_customer()
    
    # Test products
    tester.test_get_products()
    tester.test_create_product()
    
    # Test stock
    tester.test_get_stock()
    
    # Test sales
    tester.test_get_sales()
    tester.test_create_sale()
    
    # Test invoice generation
    tester.test_generate_invoice()
    
    # Test company
    tester.test_get_company()
    
    # Print results
    print(f"\n📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())
