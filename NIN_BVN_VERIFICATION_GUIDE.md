# NIN/BVN Verification Integration Guide

This backend integrates with **checkmyninbvn.com.ng** for real-time NIN (National Identification Number) and BVN (Bank Verification Number) verification services.

## Setup Instructions

### 1. Environment Configuration

Add the following environment variable to your `.env` file:

```env
NIN_BVN_API_KEY=your_api_key_here
```

### 2. Getting Your API Key

1. Visit [checkmyninbvn.com.ng](https://checkmyninbvn.com.ng)
2. Register/Login to your account
3. Navigate to **API Settings** in your dashboard
4. Generate your API key
5. Fund your wallet to start making verification requests

### 3. Pricing

| Service | Cost | Endpoint |
|---------|------|----------|
| NIN Verification | ₦150 | `/kyc/verify-nin` |
| NIN Phone Search | ₦250 | `/kyc/search-nin-phone` |
| NIN Demography Search | ₦300 | `/kyc/search-nin-demography` |
| BVN Verification | ₦150 | `/kyc/verify-bvn` |
| BVN Phone Search | ₦250 | `/kyc/search-bvn-phone` |
| Balance Check | FREE | `/kyc/verify-balance` |

## API Endpoints

### 1. Verify NIN by Number

**Endpoint:** `POST /kyc/verify-nin`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "nin": "12345678901"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "NIN verified successfully",
  "data": {
    "kyc": {
      "id": "uuid",
      "nin": "12345678901",
      "status": "PENDING",
      "userId": "user_uuid"
    },
    "verificationData": {
      "firstname": "JOHN",
      "middlename": "OLUMIDE",
      "surname": "ADEBAYO",
      "telephoneno": "08012345678",
      "residence_state": "LAGOS",
      "residence_town": "IKEJA",
      "residence_address": "15 ALLEN AVENUE",
      "residence_lga": "IKEJA",
      "birthcountry": "NIGERIA",
      "birthstate": "OGUN",
      "birthlga": "ABEOKUTA NORTH",
      "gender": "MALE",
      "nin": "12345678901",
      "birthdate": "1990-05-15",
      "photo": "base64_image_string"
    },
    "reportID": "NIN_251021154942_59E172"
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Invalid NIN format. NIN must be exactly 11 digits",
  "error": "Invalid NIN format. NIN must be exactly 11 digits",
  "statusCode": 400
}
```

---

### 2. Search NIN by Phone Number

**Endpoint:** `POST /kyc/search-nin-phone`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "phone": "08012345678"
}
```

**Response:** Same as above with NIN data retrieved

**Validation:** Phone must be 10-11 digits

---

### 3. Search NIN by Demographic Data

**Endpoint:** `POST /kyc/search-nin-demography`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "firstname": "JOHN",
  "lastname": "ADEBAYO",
  "gender": "male",
  "dob": "1990-05-15"
}
```

**Response:** Same as above with NIN data retrieved

**Required Fields:** firstname, lastname, gender, dob

---

### 4. Verify BVN Number

**Endpoint:** `POST /kyc/verify-bvn`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "bvn": "22350591353"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "BVN verified successfully",
  "data": {
    "verificationData": {
      "firstname": "JOHN",
      "middlename": "OLUMIDE",
      "lastname": "ADEBAYO",
      "phone": "08012345678",
      "email": "john.adebayo@email.com",
      "bvn": "22350591353",
      "dob": "15-May-90",
      "gender": "Male",
      "state_of_origin": "Ogun",
      "state_of_residence": "Lagos",
      "nationality": "Nigerian",
      "photo": "base64_image_string"
    },
    "reportID": "BVN_251019185403_3A7269"
  }
}
```

---

### 5. Search BVN by Phone Number

**Endpoint:** `POST /kyc/search-bvn-phone`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "phone": "08012345678"
}
```

**Response:** Same as BVN verification with BVN data retrieved

---

### 6. Check Account Balance

**Endpoint:** `GET /kyc/verify-balance`

**Authentication:** Required (Admin only)

**Response (Success):**
```json
{
  "success": true,
  "message": "Balance retrieved successfully",
  "data": {
    "balance": {
      "user_id": 123,
      "username": "your_username",
      "balance": 5000.00,
      "formatted_balance": "₦5,000.00",
      "user_type": "regular",
      "api_requests_today": 25,
      "api_limit": 1000
    }
  }
}
```

---

## Implementation Examples

### cURL Examples

#### Verify NIN
```bash
curl -X POST http://localhost:3000/kyc/verify-nin \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nin": "12345678901"
  }'
```

#### Search NIN by Phone
```bash
curl -X POST http://localhost:3000/kyc/search-nin-phone \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "08012345678"
  }'
```

#### Search NIN by Demographics
```bash
curl -X POST http://localhost:3000/kyc/search-nin-demography \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstname": "JOHN",
    "lastname": "ADEBAYO",
    "gender": "male",
    "dob": "1990-05-15"
  }'
```

#### Verify BVN
```bash
curl -X POST http://localhost:3000/kyc/verify-bvn \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bvn": "22350591353"
  }'
```

#### Check Balance (Admin)
```bash
curl -X GET http://localhost:3000/kyc/verify-balance \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

### JavaScript/Node.js Examples

#### Verify NIN
```javascript
const token = "YOUR_JWT_TOKEN";

const response = await fetch("http://localhost:3000/kyc/verify-nin", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    nin: "12345678901"
  })
});

const data = await response.json();
console.log(data);
```

#### Search NIN by Demographics
```javascript
const token = "YOUR_JWT_TOKEN";

const response = await fetch("http://localhost:3000/kyc/search-nin-demography", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    firstname: "JOHN",
    lastname: "ADEBAYO",
    gender: "male",
    dob: "1990-05-15"
  })
});

const data = await response.json();
console.log(data);
```

## Error Handling

### Common Error Responses

**Invalid NIN Format:**
```json
{
  "success": false,
  "message": "Invalid NIN format. NIN must be exactly 11 digits",
  "statusCode": 400
}
```

**Invalid API Key:**
```json
{
  "success": false,
  "message": "Invalid API key",
  "statusCode": 401
}
```

**Insufficient Balance:**
```json
{
  "success": false,
  "message": "Insufficient wallet balance",
  "statusCode": 400
}
```

**Unauthorized Access:**
```json
{
  "success": false,
  "message": "Unauthorized",
  "statusCode": 401
}
```

**Missing Required Fields:**
```json
{
  "success": false,
  "message": "Missing required fields: firstname, lastname, gender, dob",
  "statusCode": 400
}
```

## Service Details

### NinBvnVerificationService Class

Located at: `src/services/ninVerificationService.ts`

**Methods:**
- `verifyNin(nin: string)` - Verify NIN number
- `searchNinByPhone(phone: string)` - Search NIN using phone
- `searchNinByDemography(firstname, lastname, gender, dob)` - Search NIN using demographics
- `verifyBvn(bvn: string)` - Verify BVN number
- `searchBvnByPhone(phone: string)` - Search BVN using phone
- `checkBalance()` - Check account balance

All methods return a `VerificationResponse` object with status, message, and data.

## Database Schema

The NIN/BVN data is stored in the `KycVerification` table:

```prisma
model KycVerification {
  id     String @id @default(uuid())
  user   User   @relation(fields: [userId], references: [id])
  userId String @unique

  nin           String?
  selfieUrl     String?
  idCardUrl     String?
  status        KycStatus @default(PENDING)
  rejectionNote String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum KycStatus {
  PENDING
  APPROVED
  REJECTED
}
```

## Best Practices

1. **Always validate input** - NIN and BVN must be exactly 11 digits
2. **Handle errors gracefully** - Always check for error responses
3. **Monitor wallet balance** - Use the balance endpoint regularly to ensure sufficient funds
4. **Cache results** - Consider caching verification results to reduce API calls
5. **Log verification requests** - Keep records of all verification attempts for audit purposes
6. **Handle timeouts** - API requests have a 30-second timeout
7. **Respect rate limits** - Check your API limits and plan accordingly

## Consent Requirement

All verification requests automatically include `"consent": true` in the request body to ensure compliance with data protection regulations.

## Support

For issues or questions:
- Email: info@checkmyninbvn.com.ng
- Website: https://checkmyninbvn.com.ng
- Documentation: https://checkmyninbvn.com.ng/documentation

## Additional Resources

- [NIN/BVN API Documentation](https://checkmyninbvn.com.ng/documentation)
- [Terms and Conditions](https://checkmyninbvn.com.ng/terms-and-condition.php)
- [Privacy Policy](https://checkmyninbvn.com.ng/privacy-policy.php)
- [Refund Policy](https://checkmyninbvn.com.ng/refund-policy.php)
