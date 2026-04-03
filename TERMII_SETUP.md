# Termii OTP Integration Guide

## Setup Instructions

### 1. Get Termii Credentials
- Sign up at: https://www.termii.com
- Go to Dashboard → Settings → API Credentials
- Copy your **API Key**
- Create a **Sender ID** (this will appear as the SMS header)

### 2. Add Environment Variables
Add these to your `.env` file:

```env
TERMII_API_KEY=your_termii_api_key_here
TERMII_SENDER_ID=Proxy
```

**Note:** `TERMII_SENDER_ID` defaults to "Proxy" if not specified.

### 3. Usage

The integration automatically works with your existing `sendOtp` endpoint:

```bash
POST /api/auth/sendOtp
Body: {
  "phone": "+2348123456789",  // or "08123456789"
  "verifyOption": "phone"
}
```

The system will:
1. Generate a 6-digit OTP
2. Send it via Termii SMS
3. Store OTP in database with 15-minute expiration
4. Return success response

### 4. Phone Number Format
- Supports: `+234XXXXXXXXXX` (with country code)
- Supports: `0XXXXXXXXXX` (without country code - auto-formatted to Nigeria +234)

### 5. Files Modified
- `src/services/smsService.ts` - New Termii SMS service
- `src/controllers/auth.controller.ts` - Updated to use Termii

### 6. Error Handling
- If `TERMII_API_KEY` is missing, SMS sending will fail gracefully
- Check server logs for detailed Termii API responses
- HTTP errors are caught and logged

## Testing

Use your existing OTP verification flow:

```bash
POST /api/auth/verifyOtp
Body: {
  "phone": "+2348123456789",
  "otp": "123456"
}
```

## Termii API Endpoints Used
- **Send SMS**: `https://api.ng.termii.com/api/sms/send`
- **Verify OTP**: `https://api.ng.termii.com/api/verify/check`

---

For more details, visit: https://termii.com/docs
