# NIN/BVN Verification Setup Guide

## Quick Setup (5 Minutes)

### 1️⃣ Add Environment Variable

Update your `.env` file:

```env
NIN_BVN_API_KEY=your_api_key_here
```

### 2️⃣ Get Your API Key

1. Go to https://checkmyninbvn.com.ng
2. Click **Register** or **Login**
3. Navigate to **API Settings** in your dashboard
4. Click **Generate API Key**
5. Copy your API key
6. Fund your wallet (minimum ₦100 recommended)
7. Paste the key in your `.env` file

### 3️⃣ Test the Integration

Use this cURL command to test:

```bash
curl -X POST http://localhost:3000/kyc/verify-nin \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nin": "12345678901"}'
```

### 4️⃣ Expected Response

```json
{
  "success": true,
  "message": "NIN verified successfully",
  "data": {
    "kyc": {
      "id": "uuid-string",
      "nin": "12345678901",
      "status": "PENDING",
      "userId": "your-user-id"
    },
    "verificationData": {
      "firstname": "JOHN",
      "middlename": "OLUMIDE",
      "surname": "ADEBAYO",
      "telephoneno": "08012345678",
      "gender": "MALE",
      "birthdate": "1990-05-15",
      "nin": "12345678901",
      "photo": "base64_image_string"
    },
    "reportID": "NIN_251021154942_59E172"
  }
}
```

---

## 📋 Complete File Listing

### New Files Created
```
✅ src/services/ninVerificationService.ts
✅ src/types/ninBvn.types.ts
✅ NIN_BVN_VERIFICATION_GUIDE.md
✅ NIN_BVN_EXAMPLES.js
✅ NIN_BVN_IMPLEMENTATION_SUMMARY.md
✅ NIN_BVN_SETUP_GUIDE.md (this file)
```

### Modified Files
```
✅ src/controllers/kyc.controller.ts (added 6 new methods)
✅ src/routes/kyc.routes.ts (added 6 new routes)
```

### No Changes Required
```
✅ prisma/schema.prisma
✅ package.json (all dependencies already installed)
✅ Other files (backward compatible)
```

---

## 🔗 Available Endpoints

### NIN Verification

| Method | Endpoint | Cost | Purpose |
|--------|----------|------|---------|
| POST | `/kyc/verify-nin` | ₦150 | Verify NIN number |
| POST | `/kyc/search-nin-phone` | ₦250 | Find NIN by phone |
| POST | `/kyc/search-nin-demography` | ₦300 | Find NIN by demographics |

### BVN Verification

| Method | Endpoint | Cost | Purpose |
|--------|----------|------|---------|
| POST | `/kyc/verify-bvn` | ₦150 | Verify BVN number |
| POST | `/kyc/search-bvn-phone` | ₦250 | Find BVN by phone |

### Admin Only

| Method | Endpoint | Cost | Purpose |
|--------|----------|------|---------|
| GET | `/kyc/verify-balance` | FREE | Check wallet balance |

---

## 🔐 Authentication

All endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

The balance check endpoint additionally requires the user to have the `ADMIN` role.

---

## 📝 Request/Response Examples

### Example 1: Verify NIN
```
POST /kyc/verify-nin
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "nin": "12345678901"
}

Response:
200 OK
{
  "success": true,
  "message": "NIN verified successfully",
  "data": { ... }
}
```

### Example 2: Search NIN by Phone
```
POST /kyc/search-nin-phone
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "phone": "08012345678"
}

Response:
200 OK
{
  "success": true,
  "message": "NIN found successfully",
  "data": { ... }
}
```

### Example 3: Search NIN by Demographics
```
POST /kyc/search-nin-demography
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "firstname": "JOHN",
  "lastname": "ADEBAYO",
  "gender": "male",
  "dob": "1990-05-15"
}

Response:
200 OK
{
  "success": true,
  "message": "NIN found successfully",
  "data": { ... }
}
```

### Example 4: Verify BVN
```
POST /kyc/verify-bvn
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "bvn": "22350591353"
}

Response:
200 OK
{
  "success": true,
  "message": "BVN verified successfully",
  "data": { ... }
}
```

### Example 5: Check Balance (Admin)
```
GET /kyc/verify-balance
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (ADMIN token)

Response:
200 OK
{
  "success": true,
  "message": "Balance retrieved successfully",
  "data": {
    "balance": {
      "balance": 5000.00,
      "formatted_balance": "₦5,000.00",
      "api_requests_today": 25
    }
  }
}
```

---

## ✅ Validation Rules

### NIN Validation
- Must be exactly **11 digits**
- No special characters or spaces
- Example: `12345678901` ✅
- Invalid: `1234567890` ❌ (10 digits)
- Invalid: `123-456-789-01` ❌ (contains dashes)

### BVN Validation
- Must be exactly **11 digits**
- No special characters or spaces
- Example: `22350591353` ✅
- Invalid: `2235059135` ❌ (10 digits)

### Phone Validation
- Should be 10-11 digits
- Supports Nigerian format: `08012345678` ✅
- Supports: `2348012345678` ✅
- Supports: `8012345678` ✅

### Date of Birth (Demographics Search)
- Format: `YYYY-MM-DD`
- Example: `1990-05-15` ✅
- Invalid: `05/15/1990` ❌
- Invalid: `15-May-90` ❌

---

## 🔧 Integration with Frontend

### React Example
```typescript
import { useState } from 'react';

function NinVerification() {
  const [nin, setNin] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleVerify = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/kyc/verify-nin', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nin })
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.data.verificationData);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        type="text"
        value={nin}
        onChange={(e) => setNin(e.target.value)}
        placeholder="Enter NIN"
        maxLength="11"
      />
      <button onClick={handleVerify} disabled={loading}>
        {loading ? 'Verifying...' : 'Verify'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
```

---

## 🐛 Troubleshooting

### "API key not configured"
**Solution:** Add `NIN_BVN_API_KEY` to your `.env` file and restart the server.

### "Insufficient wallet balance"
**Solution:** Fund your wallet at https://checkmyninbvn.com.ng

### "Invalid NIN format"
**Solution:** Ensure NIN is exactly 11 digits with no special characters.

### "Invalid API key"
**Solution:** Check your API key is correct in `.env`. Regenerate if needed.

### "Unauthorized"
**Solution:** Provide a valid JWT token in the Authorization header.

### "Request timeout"
**Solution:** API took longer than 30 seconds. Try again or contact support.

### "Forbidden" (on balance endpoint)
**Solution:** Only admins can check balance. Use an admin JWT token.

---

## 📊 Monitoring

### Check Balance Regularly
```bash
curl -X GET http://localhost:3000/kyc/verify-balance \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Monitor Costs
- Each verification costs money
- Track your usage to optimize costs
- Set up alerts when balance is low

### Suggested Monitoring
- Check balance daily
- Log all verification attempts
- Archive successful verifications
- Track failed attempts

---

## 🚀 Production Checklist

- [ ] API key configured in `.env`
- [ ] Wallet funded with sufficient balance
- [ ] JWT token middleware working
- [ ] Database migrations applied
- [ ] Error handling tested
- [ ] Rate limiting configured (recommended)
- [ ] Logging enabled
- [ ] Balance monitoring set up
- [ ] Documentation shared with team
- [ ] Test endpoints with real data

---

## 📚 Documentation Files

Read these in order:

1. **NIN_BVN_SETUP_GUIDE.md** (this file) - Quick setup
2. **NIN_BVN_VERIFICATION_GUIDE.md** - Complete API reference
3. **NIN_BVN_EXAMPLES.js** - Code examples
4. **NIN_BVN_IMPLEMENTATION_SUMMARY.md** - Technical details

---

## 💡 Tips & Best Practices

✅ **Validate input before sending** - Catch errors early  
✅ **Cache results** - Reduce API calls and costs  
✅ **Handle timeouts** - Implement retry logic  
✅ **Log errors** - Keep records for debugging  
✅ **Monitor balance** - Prevent service interruption  
✅ **Test with test data** - Don't waste money in testing  
✅ **Use environment variables** - Keep secrets safe  
✅ **Implement rate limiting** - Prevent abuse  
✅ **Notify users** - Show verification status  
✅ **Store results** - Keep audit trail  

---

## 🆘 Getting Help

### API Support
- **Email:** info@checkmyninbvn.com.ng
- **Website:** https://checkmyninbvn.com.ng
- **Docs:** https://checkmyninbvn.com.ng/documentation

### Integration Support
- Check the `NIN_BVN_EXAMPLES.js` file
- Review the `NIN_BVN_VERIFICATION_GUIDE.md`
- Check error messages for solutions

---

## 📞 Quick Reference

| What | Where |
|------|-------|
| API Key | `.env` → `NIN_BVN_API_KEY` |
| Service | `src/services/ninVerificationService.ts` |
| Controller | `src/controllers/kyc.controller.ts` |
| Routes | `src/routes/kyc.routes.ts` |
| Types | `src/types/ninBvn.types.ts` |
| Examples | `NIN_BVN_EXAMPLES.js` |
| Guide | `NIN_BVN_VERIFICATION_GUIDE.md` |
| Summary | `NIN_BVN_IMPLEMENTATION_SUMMARY.md` |

---

## ✨ You're All Set!

Your NIN/BVN verification integration is now ready to use. Start verifying NINs and BVNs in your application!

**Need help?** Check the documentation files or contact support.

**Happy verifying!** 🎉

---

**Last Updated:** February 18, 2026  
**Version:** 1.0.0
