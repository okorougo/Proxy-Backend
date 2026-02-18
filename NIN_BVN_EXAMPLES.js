/**
 * NIN/BVN Verification Integration - Quick Start Examples
 * 
 * This file contains quick examples of how to use the NIN/BVN verification
 * endpoints in your frontend or external services.
 */

// ============================================
// 1. VERIFY NIN BY NUMBER
// ============================================

// Example 1.1: Using Fetch API
async function verifyNIN(ninNumber) {
  const token = localStorage.getItem('authToken'); // Your JWT token

  try {
    const response = await fetch('http://localhost:3000/kyc/verify-nin', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        nin: ninNumber
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log('NIN Verified Successfully!');
      console.log('User Details:', result.data.verificationData);
      console.log('Report ID:', result.data.reportID);
      return result.data;
    } else {
      console.error('Verification failed:', result.message);
      return null;
    }
  } catch (error) {
    console.error('Error verifying NIN:', error);
    return null;
  }
}

// Usage
// verifyNIN('12345678901');


// ============================================
// 2. SEARCH NIN BY PHONE NUMBER
// ============================================

async function searchNINByPhone(phoneNumber) {
  const token = localStorage.getItem('authToken');

  try {
    const response = await fetch('http://localhost:3000/kyc/search-nin-phone', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: phoneNumber
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log('NIN Found by Phone!');
      console.log('User Details:', result.data.verificationData);
      return result.data;
    } else {
      console.error('Search failed:', result.message);
      return null;
    }
  } catch (error) {
    console.error('Error searching NIN:', error);
    return null;
  }
}

// Usage
// searchNINByPhone('08012345678');


// ============================================
// 3. SEARCH NIN BY DEMOGRAPHIC DATA
// ============================================

async function searchNINByDemography(firstname, lastname, gender, dob) {
  const token = localStorage.getItem('authToken');

  try {
    const response = await fetch('http://localhost:3000/kyc/search-nin-demography', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        firstname,
        lastname,
        gender,
        dob
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log('NIN Found by Demographics!');
      console.log('User Details:', result.data.verificationData);
      return result.data;
    } else {
      console.error('Search failed:', result.message);
      return null;
    }
  } catch (error) {
    console.error('Error searching NIN:', error);
    return null;
  }
}

// Usage
// searchNINByDemography('JOHN', 'ADEBAYO', 'male', '1990-05-15');


// ============================================
// 4. VERIFY BVN NUMBER
// ============================================

async function verifyBVN(bvnNumber) {
  const token = localStorage.getItem('authToken');

  try {
    const response = await fetch('http://localhost:3000/kyc/verify-bvn', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bvn: bvnNumber
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log('BVN Verified Successfully!');
      console.log('User Details:', result.data.verificationData);
      return result.data;
    } else {
      console.error('Verification failed:', result.message);
      return null;
    }
  } catch (error) {
    console.error('Error verifying BVN:', error);
    return null;
  }
}

// Usage
// verifyBVN('22350591353');


// ============================================
// 5. SEARCH BVN BY PHONE NUMBER
// ============================================

async function searchBVNByPhone(phoneNumber) {
  const token = localStorage.getItem('authToken');

  try {
    const response = await fetch('http://localhost:3000/kyc/search-bvn-phone', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: phoneNumber
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log('BVN Found by Phone!');
      console.log('User Details:', result.data.verificationData);
      return result.data;
    } else {
      console.error('Search failed:', result.message);
      return null;
    }
  } catch (error) {
    console.error('Error searching BVN:', error);
    return null;
  }
}

// Usage
// searchBVNByPhone('08012345678');


// ============================================
// 6. CHECK ACCOUNT BALANCE (ADMIN ONLY)
// ============================================

async function checkVerificationBalance() {
  const token = localStorage.getItem('authToken'); // Must be admin token

  try {
    const response = await fetch('http://localhost:3000/kyc/verify-balance', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    if (result.success) {
      console.log('Account Balance:', result.data.balance);
      console.log('Formatted Balance:', result.data.balance.formatted_balance);
      console.log('Requests Today:', result.data.balance.api_requests_today);
      return result.data.balance;
    } else {
      console.error('Failed to check balance:', result.message);
      return null;
    }
  } catch (error) {
    console.error('Error checking balance:', error);
    return null;
  }
}

// Usage (Admin only)
// checkVerificationBalance();


// ============================================
// 7. REACT COMPONENT EXAMPLE
// ============================================

// Example React component for NIN verification
/*
import React, { useState } from 'react';

export function NINVerificationForm() {
  const [nin, setNin] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleVerifyNIN = async () => {
    if (!nin || nin.length !== 11) {
      setError('NIN must be exactly 11 digits');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/kyc/verify-nin', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nin })
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.data);
        setError(null);
      } else {
        setError(data.message);
        setResult(null);
      }
    } catch (err) {
      setError('An error occurred during verification');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>NIN Verification</h2>
      <input
        type="text"
        value={nin}
        onChange={(e) => setNin(e.target.value)}
        placeholder="Enter 11-digit NIN"
        maxLength="11"
      />
      <button onClick={handleVerifyNIN} disabled={loading}>
        {loading ? 'Verifying...' : 'Verify NIN'}
      </button>

      {error && <div className="error">{error}</div>}

      {result && (
        <div className="result">
          <h3>Verification Successful!</h3>
          <p>
            Name: {result.verificationData.firstname}{' '}
            {result.verificationData.middlename} {result.verificationData.surname}
          </p>
          <p>Gender: {result.verificationData.gender}</p>
          <p>DOB: {result.verificationData.birthdate}</p>
          <p>Phone: {result.verificationData.telephoneno}</p>
          <p>State: {result.verificationData.residence_state}</p>
          {result.verificationData.photo && (
            <img src={result.verificationData.photo} alt="Photo" />
          )}
        </div>
      )}
    </div>
  );
}
*/


// ============================================
// 8. ERROR HANDLING UTILITY
// ============================================

class NINVerificationError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'NINVerificationError';
  }
}

async function verifyWithErrorHandling(nin) {
  try {
    const response = await fetch('http://localhost:3000/kyc/verify-nin', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nin })
    });

    const result = await response.json();

    if (!result.success) {
      throw new NINVerificationError(result.message, response.status);
    }

    return result.data;
  } catch (error) {
    if (error instanceof NINVerificationError) {
      console.error(`[${error.statusCode}] ${error.message}`);
    } else {
      console.error('Unexpected error:', error);
    }
    throw error;
  }
}

// Usage
/*
try {
  const data = await verifyWithErrorHandling('12345678901');
  console.log('Verification successful:', data);
} catch (error) {
  console.error('Verification failed:', error.message);
}
*/


// ============================================
// 9. VALIDATION UTILITIES
// ============================================

function validateNIN(nin) {
  if (!nin || typeof nin !== 'string') return false;
  return /^\d{11}$/.test(nin.trim());
}

function validateBVN(bvn) {
  if (!bvn || typeof bvn !== 'string') return false;
  return /^\d{11}$/.test(bvn.trim());
}

function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.replace(/\D/g, '');
  return /^\d{10,11}$/.test(cleaned);
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Usage
/*
console.log(validateNIN('12345678901')); // true
console.log(validateNIN('1234567890'));  // false
console.log(validatePhone('08012345678')); // true
console.log(validateBVN('22350591353'));  // true
*/


export {
  verifyNIN,
  searchNINByPhone,
  searchNINByDemography,
  verifyBVN,
  searchBVNByPhone,
  checkVerificationBalance,
  NINVerificationError,
  validateNIN,
  validateBVN,
  validatePhone,
  validateEmail
};
