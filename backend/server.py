from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Form, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import bcrypt
import jwt
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
import io
import base64
from collections import defaultdict

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'inventory_db')]

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# JWT Configuration
SECRET_KEY = "your-secret-key-change-this-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 * 24 * 60  # 30 days

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    password_hash: str
    role: str  # 'admin' or 'user'
    branch_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str = 'user'
    branch_id: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class Branch(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    code: str
    address: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class BranchCreate(BaseModel):
    name: str
    code: str
    address: str

class Company(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: str
    phone: str
    logo_base64: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CompanyUpdate(BaseModel):
    name: str
    address: str
    phone: str
    logo_base64: Optional[str] = None

class Vendor(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: str
    phone: str
    branch_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class VendorCreate(BaseModel):
    name: str
    address: str
    phone: str

class Customer(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: str
    phone: str
    branch_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CustomerCreate(BaseModel):
    name: str
    address: str
    phone: str

class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    vendor_id: str
    quantity: int
    purchase_price: float
    selling_price: float
    branch_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ProductCreate(BaseModel):
    name: str
    vendor_id: str
    quantity: int
    purchase_price: float
    selling_price: float

class Sale(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_id: str
    items: List[Dict[str, Any]]  # [{"product_id": "", "quantity": 0, "selling_price": 0}]
    total_amount: float
    branch_id: str
    invoice_number: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class SaleCreate(BaseModel):
    customer_id: str
    items: List[Dict[str, Any]]

# Utility functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"username": username})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        return User(**user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

def get_user_branch_filter(user: User):
    if user.role == 'admin':
        return {}  # Admin can see all branches
    return {"branch_id": user.branch_id}

# Initialize default data
async def init_default_data():
    # Create default admin
    admin_exists = await db.users.find_one({"role": "admin"})
    if not admin_exists:
        admin_user = User(
            username="admin",
            email="admin@abc.com",
            password_hash=hash_password("admin123"),
            role="admin"
        )
        await db.users.insert_one(admin_user.dict())
    
    # Create default branches
    branch_a_exists = await db.branches.find_one({"code": "BRA"})
    if not branch_a_exists:
        branch_a = Branch(name="Branch A", code="BRA", address="Branch A Address")
        await db.branches.insert_one(branch_a.dict())
    
    branch_b_exists = await db.branches.find_one({"code": "BRB"})
    if not branch_b_exists:
        branch_b = Branch(name="Branch B", code="BRB", address="Branch B Address")
        await db.branches.insert_one(branch_b.dict())
    
    # Create default company
    company_exists = await db.company.find_one({})
    if not company_exists:
        company = Company(
            name="ABC Pvt Ltd",
            address="Singur, Hooghly",
            phone="+917545212547"
        )
        await db.company.insert_one(company.dict())

# Routes
@api_router.post("/login")
async def login(user_data: UserLogin):
    user = await db.users.find_one({"username": user_data.username})
    if not user or not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account is deactivated")
    
    access_token = create_access_token(data={"sub": user["username"]})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "role": user["role"],
            "branch_id": user.get("branch_id")
        }
    }

@api_router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# Dashboard routes
@api_router.get("/dashboard")
async def get_dashboard(current_user: User = Depends(get_current_user)):
    branch_filter = get_user_branch_filter(current_user)
    
    # Get total sales
    sales_pipeline = [
        {"$match": branch_filter},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
    ]
    total_sales_result = await db.sales.aggregate(sales_pipeline).to_list(1)
    total_sales = total_sales_result[0]["total"] if total_sales_result else 0
    
    # Get total purchase value (products * purchase_price * quantity)
    products_pipeline = [
        {"$match": branch_filter},
        {"$group": {"_id": None, "total": {"$sum": {"$multiply": ["$purchase_price", "$quantity"]}}}}
    ]
    total_purchase_result = await db.products.aggregate(products_pipeline).to_list(1)
    total_purchase = total_purchase_result[0]["total"] if total_purchase_result else 0
    
    # Get monthly sales (last 12 months)
    monthly_sales_pipeline = [
        {"$match": branch_filter},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m", "date": "$created_at"}},
            "amount": {"$sum": "$total_amount"}
        }},
        {"$sort": {"_id": 1}},
        {"$limit": 12}
    ]
    monthly_sales = await db.sales.aggregate(monthly_sales_pipeline).to_list(12)
    
    # Get stock count
    stock_count = await db.products.count_documents(branch_filter)
    
    return {
        "total_sales": total_sales,
        "total_purchase": total_purchase,
        "stock_count": stock_count,
        "monthly_sales": monthly_sales
    }

# Branch management (Admin only)
@api_router.get("/branches", response_model=List[Branch])
async def get_branches(admin_user: User = Depends(require_admin)):
    branches = await db.branches.find().to_list(100)
    return [Branch(**branch) for branch in branches]

@api_router.post("/branches", response_model=Branch)
async def create_branch(branch_data: BranchCreate, admin_user: User = Depends(require_admin)):
    # Check if code already exists
    existing = await db.branches.find_one({"code": branch_data.code})
    if existing:
        raise HTTPException(status_code=400, detail="Branch code already exists")
    
    branch = Branch(**branch_data.dict())
    await db.branches.insert_one(branch.dict())
    return branch

@api_router.put("/branches/{branch_id}", response_model=Branch)
async def update_branch(branch_id: str, branch_data: BranchCreate, admin_user: User = Depends(require_admin)):
    existing = await db.branches.find_one({"id": branch_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    # Check if code conflicts with other branches
    code_conflict = await db.branches.find_one({"code": branch_data.code, "id": {"$ne": branch_id}})
    if code_conflict:
        raise HTTPException(status_code=400, detail="Branch code already exists")
    
    updated_branch = Branch(id=branch_id, **branch_data.dict())
    await db.branches.update_one({"id": branch_id}, {"$set": updated_branch.dict()})
    return updated_branch

@api_router.delete("/branches/{branch_id}")
async def delete_branch(branch_id: str, admin_user: User = Depends(require_admin)):
    # Check if branch has data
    has_users = await db.users.find_one({"branch_id": branch_id})
    has_products = await db.products.find_one({"branch_id": branch_id})
    
    if has_users or has_products:
        raise HTTPException(status_code=400, detail="Cannot delete branch with existing data")
    
    result = await db.branches.delete_one({"id": branch_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Branch not found")
    return {"message": "Branch deleted successfully"}

# User management (Admin only)
@api_router.get("/users", response_model=List[User])
async def get_users(admin_user: User = Depends(require_admin)):
    users = await db.users.find().to_list(100)
    return [User(**user) for user in users]

@api_router.post("/users", response_model=User)
async def create_user(user_data: UserCreate, admin_user: User = Depends(require_admin)):
    # Check if username exists
    existing = await db.users.find_one({"username": user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        role=user_data.role,
        branch_id=user_data.branch_id
    )
    await db.users.insert_one(user.dict())
    return user

# Company management
@api_router.get("/company")
async def get_company(current_user: User = Depends(get_current_user)):
    company = await db.company.find_one({})
    return Company(**company) if company else None

@api_router.put("/company")
async def update_company(company_data: CompanyUpdate, admin_user: User = Depends(require_admin)):
    company = await db.company.find_one({})
    if company:
        updated_company = Company(id=company["id"], **company_data.dict())
        await db.company.update_one({"id": company["id"]}, {"$set": updated_company.dict()})
    else:
        updated_company = Company(**company_data.dict())
        await db.company.insert_one(updated_company.dict())
    return updated_company

# Vendor management
@api_router.get("/vendors", response_model=List[Vendor])
async def get_vendors(current_user: User = Depends(get_current_user)):
    branch_filter = get_user_branch_filter(current_user)
    vendors = await db.vendors.find(branch_filter).to_list(100)
    return [Vendor(**vendor) for vendor in vendors]

@api_router.post("/vendors", response_model=Vendor)
async def create_vendor(vendor_data: VendorCreate, current_user: User = Depends(get_current_user)):
    # For non-admin users, use their assigned branch
    if current_user.role != 'admin':
        if not current_user.branch_id:
            raise HTTPException(status_code=400, detail="User must be assigned to a branch")
        branch_id = current_user.branch_id
    else:
        # For admin users, use the first available branch as default
        branches = await db.branches.find().to_list(1)
        if not branches:
            raise HTTPException(status_code=400, detail="No branches available")
        branch_id = branches[0]["id"]
    
    vendor = Vendor(branch_id=branch_id, **vendor_data.dict())
    await db.vendors.insert_one(vendor.dict())
    return vendor

# Customer management
@api_router.get("/customers", response_model=List[Customer])
async def get_customers(current_user: User = Depends(get_current_user)):
    branch_filter = get_user_branch_filter(current_user)
    customers = await db.customers.find(branch_filter).to_list(100)
    return [Customer(**customer) for customer in customers]

@api_router.post("/customers", response_model=Customer)
async def create_customer(customer_data: CustomerCreate, current_user: User = Depends(get_current_user)):
    # For non-admin users, use their assigned branch
    if current_user.role != 'admin':
        if not current_user.branch_id:
            raise HTTPException(status_code=400, detail="User must be assigned to a branch")
        branch_id = current_user.branch_id
    else:
        # For admin users, use the first available branch as default
        branches = await db.branches.find().to_list(1)
        if not branches:
            raise HTTPException(status_code=400, detail="No branches available")
        branch_id = branches[0]["id"]
    
    customer = Customer(branch_id=branch_id, **customer_data.dict())
    await db.customers.insert_one(customer.dict())
    return customer

# Product management
@api_router.get("/products", response_model=List[Product])
async def get_products(current_user: User = Depends(get_current_user)):
    branch_filter = get_user_branch_filter(current_user)
    products = await db.products.find(branch_filter).to_list(100)
    return [Product(**product) for product in products]

@api_router.post("/products", response_model=Product)
async def create_product(product_data: ProductCreate, current_user: User = Depends(get_current_user)):
    # For non-admin users, use their assigned branch
    if current_user.role != 'admin':
        if not current_user.branch_id:
            raise HTTPException(status_code=400, detail="User must be assigned to a branch")
        branch_id = current_user.branch_id
    else:
        # For admin users, use the first available branch as default
        branches = await db.branches.find().to_list(1)
        if not branches:
            raise HTTPException(status_code=400, detail="No branches available")
        branch_id = branches[0]["id"]
    
    product = Product(branch_id=branch_id, **product_data.dict())
    await db.products.insert_one(product.dict())
    return product

# Stock management
@api_router.get("/stock")
async def get_stock(current_user: User = Depends(get_current_user)):
    branch_filter = get_user_branch_filter(current_user)
    
    stock_pipeline = [
        {"$match": branch_filter},
        {"$group": {
            "_id": "$name",
            "total_quantity": {"$sum": "$quantity"},
            "total_value": {"$sum": {"$multiply": ["$quantity", "$purchase_price"]}},
            "selling_value": {"$sum": {"$multiply": ["$quantity", "$selling_price"]}}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    stock_data = await db.products.aggregate(stock_pipeline).to_list(1000)
    
    total_stock_value = sum(item["total_value"] for item in stock_data)
    
    return {
        "stock_items": stock_data,
        "total_stock_value": total_stock_value
    }

# Sales management
@api_router.get("/sales", response_model=List[Sale])
async def get_sales(current_user: User = Depends(get_current_user)):
    branch_filter = get_user_branch_filter(current_user)
    sales = await db.sales.find(branch_filter).sort("created_at", -1).to_list(100)
    return [Sale(**sale) for sale in sales]

@api_router.post("/sales", response_model=Sale)
async def create_sale(sale_data: SaleCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != 'admin' and not current_user.branch_id:
        raise HTTPException(status_code=400, detail="User must be assigned to a branch")
    
    branch_id = current_user.branch_id if current_user.role != 'admin' else current_user.branch_id
    
    # Calculate total amount and update stock
    total_amount = 0
    for item in sale_data.items:
        product = await db.products.find_one({"id": item["product_id"], "branch_id": branch_id})
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item['product_id']} not found")
        
        if product["quantity"] < item["quantity"]:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for product {product['name']}")
        
        total_amount += item["quantity"] * item["selling_price"]
        
        # Update product quantity
        await db.products.update_one(
            {"id": item["product_id"]},
            {"$inc": {"quantity": -item["quantity"]}}
        )
    
    # Generate invoice number
    sales_count = await db.sales.count_documents({"branch_id": branch_id})
    invoice_number = f"INV-{branch_id[-3:]}-{sales_count + 1:04d}"
    
    sale = Sale(
        customer_id=sale_data.customer_id,
        items=sale_data.items,
        total_amount=total_amount,
        branch_id=branch_id,
        invoice_number=invoice_number
    )
    
    await db.sales.insert_one(sale.dict())
    return sale

# PDF Invoice generation
@api_router.get("/sales/{sale_id}/invoice")
async def generate_invoice(sale_id: str, current_user: User = Depends(get_current_user)):
    sale = await db.sales.find_one({"id": sale_id})
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    # Check branch access
    if current_user.role != 'admin' and sale["branch_id"] != current_user.branch_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get related data
    customer = await db.customers.find_one({"id": sale["customer_id"]})
    company = await db.company.find_one({})
    
    # Create PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    story = []
    styles = getSampleStyleSheet()
    
    # Company header
    if company:
        title_style = ParagraphStyle('Title', parent=styles['Title'], spaceAfter=20)
        story.append(Paragraph(f"<b>{company['name']}</b>", title_style))
        story.append(Paragraph(f"{company['address']}<br/>Phone: {company['phone']}", styles['Normal']))
        story.append(Spacer(1, 20))
    
    # Invoice details
    story.append(Paragraph(f"<b>INVOICE #{sale['invoice_number']}</b>", styles['Heading2']))
    story.append(Paragraph(f"Date: {sale['created_at'].strftime('%Y-%m-%d')}", styles['Normal']))
    story.append(Spacer(1, 20))
    
    # Customer details
    if customer:
        story.append(Paragraph("<b>Bill To:</b>", styles['Heading3']))
        story.append(Paragraph(f"{customer['name']}<br/>{customer['address']}<br/>Phone: {customer['phone']}", styles['Normal']))
        story.append(Spacer(1, 20))
    
    # Items table
    table_data = [['Product', 'Quantity', 'Price', 'Total']]
    
    for item in sale['items']:
        product = await db.products.find_one({"id": item["product_id"]})
        product_name = product['name'] if product else 'Unknown Product'
        table_data.append([
            product_name,
            str(item['quantity']),
            f"₹{item['selling_price']:.2f}",
            f"₹{item['quantity'] * item['selling_price']:.2f}"
        ])
    
    table_data.append(['', '', 'Total:', f"₹{sale['total_amount']:.2f}"])
    
    table = Table(table_data, colWidths=[3*inch, 1*inch, 1.5*inch, 1.5*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 14),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    story.append(table)
    doc.build(story)
    
    buffer.seek(0)
    
    # Save to file system temporarily
    invoice_path = f"/tmp/invoice_{sale_id}.pdf"
    with open(invoice_path, "wb") as f:
        f.write(buffer.getvalue())
    
    return FileResponse(
        invoice_path,
        media_type="application/pdf",
        filename=f"invoice_{sale['invoice_number']}.pdf"
    )

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    await init_default_data()
    logger.info("Default data initialized")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
