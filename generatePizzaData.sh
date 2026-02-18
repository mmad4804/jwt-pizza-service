# Check if host is provided as a command line argument
if [ -z "$1" ]; then
  echo "Usage: $0 <host>"
  echo "Example: $0 http://localhost:3000"
  exit 1
fi
host=$1

# 1. Get Admin Token
response=$(curl -s -X PUT $host/api/auth -d '{"email":"a@jwt.com", "password":"admin"}' -H 'Content-Type: application/json')
token=$(echo $response | jq -r '.token')

if [ "$token" == "null" ]; then
  echo "Failed to authenticate as admin. Check credentials."
  exit 1
fi

echo "--- Cleaning up existing data ---"

# 2. Delete Existing Franchises 
# We fetch them first, then loop through and delete by ID
franchises=$(curl -s -X GET $host/api/franchise | jq -r '.[] | .id')
for id in $franchises; do
  echo "Deleting franchise $id..."
  curl -s -X DELETE "$host/api/franchise/$id" -H "Authorization: Bearer $token"
done

# Note: Usually, deleting a franchise should cascade delete its stores. 
# If your API doesn't do that, you'd need a separate loop for /api/franchise/$id/store/$storeId

echo "--- Seeding fresh data ---"

# Add users
curl -s -X POST $host/api/auth -d '{"name":"pizza diner", "email":"d@jwt.com", "password":"diner"}' -H 'Content-Type: application/json'
curl -s -X POST $host/api/auth -d '{"name":"pizza franchisee", "email":"f@jwt.com", "password":"franchisee"}' -H 'Content-Type: application/json'

# Add menu (PUT usually replaces/updates, so this is naturally "clean")
curl -s -X PUT $host/api/order/menu -H 'Content-Type: application/json' -d '{ "title":"Veggie", "description": "A garden of delight", "image":"pizza1.png", "price": 0.0038 }'  -H "Authorization: Bearer $token"
curl -s -X PUT $host/api/order/menu -H 'Content-Type: application/json' -d '{ "title":"Pepperoni", "description": "Spicy treat", "image":"pizza2.png", "price": 0.0042 }'  -H "Authorization: Bearer $token"
curl -s -X PUT $host/api/order/menu -H 'Content-Type: application/json' -d '{ "title":"Margarita", "description": "Essential classic", "image":"pizza3.png", "price": 0.0042 }'  -H "Authorization: Bearer $token"
curl -s -X PUT $host/api/order/menu -H 'Content-Type: application/json' -d '{ "title":"Crusty", "description": "A dry mouthed favorite", "image":"pizza4.png", "price": 0.0028 }'  -H "Authorization: Bearer $token"
curl -s -X PUT $host/api/order/menu -H 'Content-Type: application/json' -d '{ "title":"Charred Leopard", "description": "For those with a darker side", "image":"pizza5.png", "price": 0.0099 }'  -H "Authorization: Bearer $token"

# Add franchise and store
# We capture the new franchise ID to ensure the store is added to the correct one
new_franchise=$(curl -s -X POST $host/api/franchise -H 'Content-Type: application/json' -d '{"name": "pizzaPocket", "admins": [{"email": "f@jwt.com"}]}' -H "Authorization: Bearer $token")
franchise_id=$(echo $new_franchise | jq -r '.id')

curl -s -X POST "$host/api/franchise/$franchise_id/store" -H 'Content-Type: application/json' -d "{\"franchiseId\": $franchise_id, \"name\":\"SLC\"}" -H "Authorization: Bearer $token"

echo "Database data generated"